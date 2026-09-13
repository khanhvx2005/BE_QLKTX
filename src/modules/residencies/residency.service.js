/**
 * Service xử lý nghiệp vụ cho Module Residencies (Lưu trú).
 * Thực thi kỹ thuật chống tranh chấp giường nguyên tử (Conditional Atomic Update)
 * và kiểm tra giới tính phòng bắt buộc theo PRD.md §2.9 và 14-PHIEN-BAN-DON-GIAN-HOA.md §4.6.
 */

const Residency = require('./residency.model');
const Bed = require('../rooms/bed.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');

const getResidencies = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.studentId) filter.studentId = query.studentId;
  if (query.bedId) filter.bedId = query.bedId;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Residency.find(filter)
      .populate('studentId', 'fullName studentCode gender phone email className')
      .populate({
        path: 'bedId',
        select: 'bedNumber status roomId',
        populate: {
          path: 'roomId',
          select: 'roomNumber gender pricePerBed buildingId',
          populate: { path: 'buildingId', select: 'code name' },
        },
      })
      .sort('-startDate')
      .skip(skip)
      .limit(limit),
    Residency.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
  };
};

const getResidencyById = async (id, user = null) => {
  const residency = await Residency.findById(id)
    .populate('studentId', 'fullName studentCode gender phone email className')
    .populate({
      path: 'bedId',
      select: 'bedNumber status roomId',
      populate: {
        path: 'roomId',
        select: 'roomNumber gender pricePerBed buildingId',
        populate: { path: 'buildingId', select: 'code name address' },
      },
    });

  if (!residency) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi lưu trú');
  }

  // Quy tắc dữ liệu chính chủ cho sinh viên (API.md §1.4)
  if (user && user.role === 'student') {
    const studentOwnerId = residency.studentId?._id?.toString() || residency.studentId?.toString();
    if (studentOwnerId !== user.studentId?.toString()) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập thông tin lưu trú của sinh viên khác');
    }
  }

  return residency;
};

/**
 * Đăng ký xếp sinh viên vào giường.
 * Triển khai 3 quy tắc nghiệp vụ bất biến:
 * 1. Sinh viên chưa có chỗ ở đang mở (BR-21).
 * 2. Giới tính sinh viên khớp 100% giới tính phòng (BR-06, PRD §2.9 A1).
 * 3. Chiếm giường nguyên tử có điều kiện (Atomic Claim, BR-20, ARCHITECTURE §3.5).
 */
const createResidency = async (data, actorId = null) => {
  const { studentId, bedId, startDate, endDate } = data;

  // 1. Kiểm tra hồ sơ sinh viên
  const student = await Student.findById(studentId);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }
  if (student.status !== 'active') {
    throw new ApiError(422, 'STUDENT_INACTIVE', 'Sinh viên đang ở trạng thái vô hiệu hóa, không thể xếp phòng');
  }

  // 2. Kiểm tra sinh viên chưa có lưu trú active (BR-21)
  const existingActive = await Residency.findOne({
    studentId,
    status: 'active',
  });
  if (existingActive) {
    throw new ApiError(422, 'STUDENT_HAS_ACTIVE_CONTRACT', 'Sinh viên đã có hợp đồng hoặc chỗ ở đang hiệu lực');
  }

  // 3. Kiểm tra giường và khớp giới tính phòng (BR-06, PRD §2.9 A1)
  const bed = await Bed.findById(bedId).populate('roomId');
  if (!bed) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy giường');
  }
  if (!bed.roomId) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy thông tin phòng của giường này');
  }

  if (bed.roomId.gender !== student.gender) {
    const label = bed.roomId.gender === 'male' ? 'nam' : 'nữ';
    throw new ApiError(422, 'GENDER_MISMATCH', `Phòng này chỉ dành cho sinh viên ${label}`);
  }

  // 4. ⭐ CHIẾM GIƯỜNG NGUYÊN TỬ (Atomic Conditional Update, BR-20)
  // Đưa điều kiện { status: 'available' } trực tiếp vào câu lệnh cập nhật
  const claimedBed = await Bed.findOneAndUpdate(
    { _id: bedId, status: 'available' },
    { status: 'occupied' },
    { returnDocument: 'after' }
  );

  if (!claimedBed) {
    // Nếu không khớp document nào => Giường vừa bị người khác chọn hoặc đang bảo trì
    throw new ApiError(409, 'BED_NOT_AVAILABLE', 'Giường này vừa được xếp cho sinh viên khác hoặc đang bảo trì');
  }

  // 5. Tạo bản ghi Residency. Nếu có lỗi phải ROLLBACK trả lại trạng thái giường.
  try {
    const residency = await Residency.create({
      studentId,
      bedId,
      startDate,
      endDate: endDate || null,
      status: 'active',
      createdBy: actorId,
    });

    return {
      id: residency._id,
      status: residency.status,
      residency,
    };
  } catch (err) {
    // Rollback trả giường về available ngay lập tức
    await Bed.findByIdAndUpdate(bedId, { status: 'available' });
    throw err;
  }
};

/**
 * Đóng bản ghi lưu trú và giải phóng giường về 'available'.
 */
const closeResidency = async (id, actorId = null) => {
  const residency = await Residency.findById(id);
  if (!residency) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi lưu trú');
  }

  if (residency.status === 'ended' || residency.status === 'closed') {
    return { id: residency._id, status: residency.status, message: 'Lưu trú đã kết thúc trước đó' };
  }

  residency.status = 'ended';
  residency.endDate = new Date();
  await residency.save();

  // Giải phóng giường về available
  await Bed.findByIdAndUpdate(residency.bedId, { status: 'available' });

  return {
    id: residency._id,
    status: 'ended',
    bedReleased: true,
  };
};

module.exports = {
  getResidencies,
  getResidencyById,
  createResidency,
  closeResidency,
};

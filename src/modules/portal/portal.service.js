/**
 * Service xử lý nghiệp vụ cho Cổng dịch vụ Sinh viên KTX HaUI (Student Portal).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.7 (FR-60 đến FR-63).
 * 
 * ============================================================================
 * [TỐI ƯU HIỆU NĂNG - DÀNH CHO TEAM 5]:
 * - Thông tin phòng ở và bạn cùng phòng (FR-60) được Cache bằng Redis:
 *   Key: `portal:my-room:<studentId>`, TTL: 300s.
 * - Danh sách bạn cùng phòng chỉ hiển thị Họ tên và MSSV để đảm bảo tính riêng tư.
 * ============================================================================
 */

const Student = require('../students/student.model');
const Contract = require('../contracts/contract.model');
const Room = require('../rooms/room.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const ApiError = require('../../core/errors/api-error');
const cache = require('../../core/utils/cache');

/**
 * 1. Hồ sơ & Phòng ở của tôi (FR-60)
 * Trả về: Thông tin cá nhân, Tòa nhà, Số phòng, Số giường và Danh sách bạn cùng phòng
 */
const getMyRoom = async (studentId) => {
  const cacheKey = `portal:my-room:${studentId}`;

  return cache.wrap(
    cacheKey,
    async () => {
      const student = await Student.findById(studentId);
      if (!student) {
        throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
      }

      // Tìm hợp đồng đang active của sinh viên
      const contract = await Contract.findOne({
        studentId,
        status: 'active',
      }).populate({
        path: 'roomId',
        populate: { path: 'buildingId', select: 'code name description' },
      });

      if (!contract || !contract.roomId) {
        return {
          hasRoom: false,
          student: {
            studentCode: student.studentCode,
            fullName: student.fullName,
            gender: student.gender,
            phone: student.phone,
            email: student.email,
            faculty: student.faculty,
            className: student.className,
          },
          message: 'Bạn hiện chưa có phòng ở KTX đang hoạt động',
        };
      }

      const room = contract.roomId;
      const building = room.buildingId;

      // Lấy danh sách bạn cùng phòng (chỉ lấy Họ tên và MSSV để bảo mật riêng tư)
      const roommateStudentIds = room.beds
        .filter((b) => b.status === 'occupied' && b.studentId && b.studentId.toString() !== studentId.toString())
        .map((b) => b.studentId);

      const roommates = await Student.find({
        _id: { $in: roommateStudentIds },
      }).select('studentCode fullName gender className faculty');

      return {
        hasRoom: true,
        student: {
          studentCode: student.studentCode,
          fullName: student.fullName,
          gender: student.gender,
          phone: student.phone,
          email: student.email,
          faculty: student.faculty,
          className: student.className,
        },
        residence: {
          buildingCode: building.code,
          buildingName: building.name,
          roomNumber: room.roomNumber,
          floor: room.floor,
          bedNumber: contract.bedNumber,
          capacity: room.capacity,
          term: contract.term,
          startDate: contract.startDate,
          endDate: contract.endDate,
        },
        roommates,
      };
    },
    300 // Cache trong 5 phút
  );
};

/**
 * 2. Hợp đồng của tôi (FR-61)
 */
const getMyContract = async (studentId) => {
  const contract = await Contract.findOne({
    studentId,
    status: { $in: ['active', 'pending'] },
  })
    .populate({
      path: 'roomId',
      populate: { path: 'buildingId', select: 'code name' },
    })
    .sort({ createdAt: -1 });

  if (!contract) {
    return { hasContract: false, message: 'Bạn chưa có hợp đồng KTX nào' };
  }

  return {
    hasContract: true,
    contract,
  };
};

/**
 * 3. Hóa đơn cá nhân & Hóa đơn Điện nước phòng (FR-62)
 * Trả về:
 * - Hóa đơn cá nhân (Tiền phòng kỳ, Tiền cọc)
 * - Hóa đơn Điện nước của phòng (kèm số tiền chia bình quân mỗi bạn)
 */
const getMyInvoices = async (studentId) => {
  // 1. Hóa đơn cá nhân
  const personalInvoices = await Invoice.find({
    studentId,
    type: { $in: ['room_semester', 'deposit'] },
  }).sort({ createdAt: -1 });

  // 2. Tìm phòng hiện tại của sinh viên
  const activeContract = await Contract.findOne({
    studentId,
    status: 'active',
  });

  let roomUtilityInvoices = [];
  if (activeContract && activeContract.roomId) {
    roomUtilityInvoices = await Invoice.find({
      roomId: activeContract.roomId,
      type: 'utility',
    })
      .populate('studentId', 'studentCode fullName') // Người đại diện đã nộp (nếu có)
      .populate('utilityReadingId')
      .sort({ createdAt: -1 });
  }

  return {
    personalInvoices,
    roomUtilityInvoices,
  };
};

/**
 * 4. Lịch sử thanh toán & Hoàn cọc (FR-63)
 */
const getMyPayments = async (studentId) => {
  const payments = await Payment.find({ studentId })
    .populate('invoiceId', 'invoiceCode type amount description')
    .sort({ paidAt: -1 });

  return payments;
};

module.exports = {
  getMyRoom,
  getMyContract,
  getMyInvoices,
  getMyPayments,
};

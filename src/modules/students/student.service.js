/**
 * Service xử lý nghiệp vụ cho Module Students (Hồ sơ Sinh viên HaUI).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.2 (FR-10 đến FR-14).
 * 
 * ============================================================================
 * [LUỒNG NGHIỆP VỤ - DÀNH CHO TEAM 5]:
 * - Tra cứu chỗ ở: Lấy trực tiếp từ Contract (status = 'active') nối sang Room và Building.
 * - Công nợ: Lấy từ các hóa đơn cá nhân của sinh viên có status = 'unpaid'.
 * - Nhập hàng loạt qua Excel: Hỗ trợ import danh sách sinh viên nhanh chóng (FR-12b).
 * ============================================================================
 */

const Student = require('./student.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const ApiError = require('../../core/errors/api-error');

/**
 * 1. Lấy danh sách sinh viên phân trang kèm thông tin chỗ ở KTX và công nợ (FR-10)
 */
const getStudents = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.gender) filter.gender = query.gender;
  if (query.faculty) filter.faculty = query.faculty.trim();

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { studentCode: searchRegex },
      { fullName: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
    ];
  }

  const [students, total] = await Promise.all([
    Student.find(filter).sort('-createdAt').skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);

  // Bổ sung thông tin phòng ở hiện tại và công nợ cho từng sinh viên
  const items = await Promise.all(
    students.map(async (st) => {
      // 1. Tìm hợp đồng KTX đang hoạt động
      let residence = null;
      const activeContract = await Contract.findOne({
        studentId: st._id,
        status: 'active',
      }).populate({
        path: 'roomId',
        populate: { path: 'buildingId', select: 'code name' },
      });

      if (activeContract && activeContract.roomId) {
        const room = activeContract.roomId;
        residence = {
          buildingCode: room.buildingId?.code || '',
          buildingName: room.buildingId?.name || '',
          roomNumber: room.roomNumber,
          bedNumber: activeContract.bedNumber,
          term: activeContract.term,
          startDate: activeContract.startDate,
          endDate: activeContract.endDate,
        };
      }

      // 2. Tính tổng công nợ chưa trả (các hóa đơn unpaid)
      const unpaidInvoices = await Invoice.find({
        studentId: st._id,
        status: 'unpaid',
      });
      const totalDebt = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

      return {
        id: st._id.toString(),
        studentCode: st.studentCode,
        fullName: st.fullName,
        gender: st.gender,
        dob: st.dob,
        phone: st.phone,
        email: st.email || '',
        className: st.className || '',
        faculty: st.faculty || '',
        emergencyContact: st.emergencyContact || null,
        status: st.status,
        hasAccount: Boolean(st.userId),
        residence,
        totalDebt,
      };
    })
  );

  return {
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * 2. Xem chi tiết hồ sơ sinh viên kèm lịch sử hợp đồng và công nợ (FR-11)
 */
const getStudentById = async (id) => {
  const student = await Student.findById(id).populate('userId', 'email role isActive lastLoginAt');
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  // Lịch sử hợp đồng
  const contracts = await Contract.find({ studentId: id })
    .populate({
      path: 'roomId',
      populate: { path: 'buildingId', select: 'code name' },
    })
    .sort({ createdAt: -1 });

  // Lịch sử hóa đơn
  const invoices = await Invoice.find({ studentId: id }).sort({ createdAt: -1 });

  return {
    student,
    contracts,
    invoices,
  };
};

/**
 * 3. Thêm mới hồ sơ sinh viên thủ công (FR-12)
 */
const createStudent = async (data) => {
  const studentCodeUpper = data.studentCode.trim().toUpperCase();
  const existing = await Student.findOne({ studentCode: studentCodeUpper });
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', `Mã sinh viên ${studentCodeUpper} đã tồn tại trong hệ thống`);
  }

  const student = await Student.create({
    ...data,
    studentCode: studentCodeUpper,
  });

  return student;
};

/**
 * 4. Nhập sinh viên hàng loạt từ danh sách Excel (FR-12b)
 */
const importStudentsBatch = async (studentList = []) => {
  if (!Array.isArray(studentList) || studentList.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Danh sách sinh viên tải lên rỗng');
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < studentList.length; i++) {
    const item = studentList[i];
    try {
      const code = String(item.studentCode || '').trim().toUpperCase();
      if (!code) throw new Error('Thiếu mã sinh viên');
      if (!item.fullName) throw new Error('Thiếu họ và tên');

      const existing = await Student.findOne({ studentCode: code });
      if (existing) {
        errors.push({ row: i + 1, studentCode: code, error: 'MSSV đã tồn tại' });
        continue;
      }

      const created = await Student.create({
        studentCode: code,
        fullName: String(item.fullName).trim(),
        gender: item.gender === 'female' ? 'female' : 'male',
        phone: String(item.phone || '0123456789').trim(),
        email: item.email ? String(item.email).trim().toLowerCase() : `${code.toLowerCase()}@st.haui.edu.vn`,
        faculty: item.faculty || '',
        className: item.className || '',
        dob: item.dob ? new Date(item.dob) : null,
        status: 'active',
      });

      results.push(created);
    } catch (err) {
      errors.push({ row: i + 1, studentCode: item.studentCode, error: err.message });
    }
  }

  return {
    totalUploaded: studentList.length,
    successCount: results.length,
    failedCount: errors.length,
    errors,
  };
};

/**
 * 5. Cập nhật hồ sơ sinh viên (FR-13)
 */
const updateStudent = async (id, data) => {
  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  // Chặn đổi sang MSSV đã có
  if (data.studentCode) {
    const codeUpper = data.studentCode.trim().toUpperCase();
    if (codeUpper !== student.studentCode) {
      const existing = await Student.findOne({ studentCode: codeUpper });
      if (existing) {
        throw new ApiError(409, 'DUPLICATE_ENTRY', `Mã sinh viên ${codeUpper} đã tồn tại`);
      }
      student.studentCode = codeUpper;
    }
  }

  if (data.fullName) student.fullName = data.fullName;
  if (data.gender) student.gender = data.gender;
  if (data.phone) student.phone = data.phone;
  if (data.email) student.email = data.email;
  if (data.faculty !== undefined) student.faculty = data.faculty;
  if (data.className !== undefined) student.className = data.className;
  if (data.dob !== undefined) student.dob = data.dob;
  if (data.emergencyContact !== undefined) student.emergencyContact = data.emergencyContact;
  if (data.status) student.status = data.status;

  await student.save();
  return student;
};

/**
 * 6. Vô hiệu hóa sinh viên (FR-14)
 * Chặn nếu sinh viên còn hợp đồng active hoặc còn nợ tiền
 */
const disableStudent = async (id) => {
  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sinh viên');
  }

  // 1. Kiểm tra hợp đồng KTX đang hoạt động
  const activeContract = await Contract.findOne({ studentId: id, status: 'active' });
  if (activeContract) {
    throw new ApiError(422, 'STUDENT_HAS_ACTIVE_CONTRACT', 'Không thể vô hiệu hóa sinh viên đang có hợp đồng KTX hiệu lực');
  }

  // 2. Kiểm tra công nợ
  const unpaidInvoices = await Invoice.find({ studentId: id, status: 'unpaid' });
  if (unpaidInvoices.length > 0) {
    throw new ApiError(422, 'STUDENT_HAS_DEBT', 'Không thể vô hiệu hóa sinh viên còn nợ hóa đơn KTX chưa thanh toán');
  }

  student.status = 'inactive';
  await student.save();

  return student;
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  importStudentsBatch,
  updateStudent,
  disableStudent,
};

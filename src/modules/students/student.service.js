/**
 * Service xử lý nghiệp vụ cho Module Students.
 * Tuân thủ theo API.md §3 và DATA-SCHEMA.md §3.2 (Chuẩn v1.2).
 */

const Student = require('./student.model');
const Residency = require('../residencies/residency.model');
const Invoice = require('../fees/invoice.model');
const Contract = require('../contracts/contract.model');
const ApiError = require('../../core/errors/api-error');

/**
 * Lấy danh sách sinh viên có tìm kiếm, phân trang và bổ sung chỗ ở, công nợ
 */
const getStudents = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;
  const sort = query.sort || '-createdAt';

  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.gender) {
    filter.gender = query.gender;
  }

  if (query.faculty) {
    filter.faculty = query.faculty.trim();
  }

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
    Student.find(filter).sort(sort).skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);

  // Bổ sung residence, totalDebt, hasAccount cho từng sinh viên (SCR-11, SCR-81)
  const items = await Promise.all(
    students.map(async (st) => {
      // 1. Tìm thông tin lưu trú hiện tại
      let residence = null;
      const activeResidency = await Residency.findOne({ studentId: st._id, status: 'active' }).populate({
        path: 'bedId',
        select: 'bedCode roomId',
        populate: {
          path: 'roomId',
          select: 'roomNumber buildingId',
          populate: { path: 'buildingId', select: 'name code' },
        },
      });

      if (activeResidency?.bedId) {
        const bed = activeResidency.bedId;
        const room = bed.roomId;
        const building = room?.buildingId;
        residence = {
          bedCode: bed.bedCode,
          buildingName: building?.name || '',
          roomNumber: room?.roomNumber || '',
          endDate: activeResidency.endDate,
        };
      }

      // 2. Tính tổng công nợ chưa trả
      const unpaidInvoices = await Invoice.find({
        studentId: st._id,
        status: { $in: ['unpaid', 'partial', 'overdue'] },
      });
      const totalDebt = unpaidInvoices.reduce(
        (sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)),
        0
      );

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
        totalDebt,
        residence,
      };
    })
  );

  return {
    items,
    total,
    page,
    limit,
  };
};

/**
 * Lấy chi tiết một sinh viên theo ID kèm thông tin lưu trú và công nợ.
 */
const getStudentById = async (id) => {
  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  const result = student.toJSON();

  // Kiểm tra lưu trú hiện tại (Residency)
  const activeResidency = await Residency.findOne({
    studentId: student._id,
    status: 'active',
  }).populate({
    path: 'bedId',
    populate: {
      path: 'roomId',
      populate: { path: 'buildingId' },
    },
  });

  result.currentResidency = activeResidency || null;

  // Kiểm tra công nợ chưa thanh toán (Invoice)
  const unpaidInvoices = await Invoice.find({
    studentId: student._id,
    status: { $in: ['unpaid', 'partial', 'overdue'] },
  });
  result.outstandingDebt = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)),
    0
  );

  return result;
};

/**
 * Thêm mới một hồ sơ sinh viên (Staff hoặc Admin tạo).
 */
const createStudent = async (data) => {
  const codeUpper = data.studentCode.trim().toUpperCase();
  const existing = await Student.findOne({ studentCode: codeUpper });
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', 'Mã số sinh viên đã tồn tại', {
      errors: [{ field: 'studentCode', message: 'Mã số sinh viên này đã tồn tại trong hệ thống' }],
    });
  }

  const student = await Student.create({
    ...data,
    studentCode: codeUpper,
    status: 'active',
  });

  return {
    id: student._id.toString(),
    studentCode: student.studentCode,
    status: student.status,
  };
};

/**
 * Cập nhật thông tin hồ sơ sinh viên.
 */
const updateStudent = async (id, data) => {
  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên để cập nhật');
  }

  // Không cho phép đổi sang mã sinh viên đã có của người khác
  if (data.studentCode && data.studentCode.toUpperCase() !== student.studentCode) {
    const codeUpper = data.studentCode.toUpperCase();
    const conflict = await Student.findOne({
      studentCode: codeUpper,
      _id: { $ne: student._id },
    });
    if (conflict) {
      throw new ApiError(409, 'DUPLICATE_ENTRY', 'Mã số sinh viên này đã thuộc về người khác', {
        errors: [{ field: 'studentCode', message: 'Mã số sinh viên này đã tồn tại trong hệ thống' }],
      });
    }
    student.studentCode = codeUpper;
  }

  Object.assign(student, data);
  await student.save();

  return student;
};

/**
 * Vô hiệu hóa sinh viên (Soft Delete).
 * Kiểm tra các trường hợp bị chặn theo API.md §3:
 * 1. Đang có hợp đồng hiệu lực (active) -> 422 STUDENT_HAS_ACTIVE_CONTRACT
 * 2. Còn nợ chưa thanh toán -> 422 STUDENT_HAS_DEBT
 */
const deactivateStudent = async (id) => {
  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  // 1. Kiểm tra hợp đồng đang hiệu lực (v1.2 chỉ có active)
  const activeContract = await Contract.findOne({
    studentId: student._id,
    status: 'active',
  });
  if (activeContract) {
    throw new ApiError(422, 'STUDENT_HAS_ACTIVE_CONTRACT', 'Sinh viên đang có hợp đồng hiệu lực');
  }

  // 2. Kiểm tra công nợ hóa đơn chưa thanh toán
  const unpaidInvoice = await Invoice.findOne({
    studentId: student._id,
    status: { $in: ['unpaid', 'partial', 'overdue'] },
  });
  if (unpaidInvoice) {
    throw new ApiError(422, 'STUDENT_HAS_DEBT', 'Sinh viên còn công nợ chưa thanh toán');
  }

  student.status = 'inactive';
  await student.save();

  return {
    id: student._id.toString(),
    status: student.status,
  };
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deactivateStudent,
};

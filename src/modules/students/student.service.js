/**
 * Service xử lý nghiệp vụ cho Module Students.
 * Tuân thủ theo API.md §3 và DATA-SCHEMA.md §3.2.
 */

const Student = require('./student.model');
const ApiError = require('../../core/errors/api-error');

/**
 * Lấy danh sách sinh viên có tìm kiếm và phân trang.
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

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { studentCode: searchRegex },
      { fullName: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
    ];
  }

  const [items, total] = await Promise.all([
    Student.find(filter).sort(sort).skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
  };
};

/**
 * Lấy chi tiết một sinh viên theo ID kèm thông tin lưu trú và công nợ nếu có.
 */
const getStudentById = async (id) => {
  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  const result = student.toJSON();

  // Kiểm tra thông tin lưu trú hiện tại (Residency) an toàn nếu model đã được đăng ký
  try {
    const mongoose = require('mongoose');
    if (mongoose.models.Residency) {
      const residency = await mongoose.models.Residency.findOne({
        studentId: student._id,
        status: 'active',
      }).populate('bedId');
      result.currentResidency = residency || null;
    }
  } catch (err) {
    result.currentResidency = null;
  }

  // Kiểm tra công nợ chưa thanh toán (Invoice)
  try {
    const mongoose = require('mongoose');
    if (mongoose.models.Invoice) {
      const unpaidInvoices = await mongoose.models.Invoice.find({
        studentId: student._id,
        status: { $in: ['unpaid', 'partial', 'overdue'] },
      });
      const totalDebt = unpaidInvoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0);
      result.outstandingDebt = totalDebt;
    } else {
      result.outstandingDebt = 0;
    }
  } catch (err) {
    result.outstandingDebt = 0;
  }

  return result;
};

/**
 * Thêm mới một hồ sơ sinh viên (Staff hoặc Admin tạo).
 */
const createStudent = async (data) => {
  const existing = await Student.findOne({ studentCode: data.studentCode.toUpperCase() });
  if (existing) {
    throw new ApiError(409, 'STUDENT_CODE_ALREADY_EXISTS', 'Mã số sinh viên này đã tồn tại trong hệ thống');
  }

  const student = await Student.create({
    ...data,
    studentCode: data.studentCode.toUpperCase(),
    status: 'active',
  });

  return {
    id: student._id,
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
    const conflict = await Student.findOne({
      studentCode: data.studentCode.toUpperCase(),
      _id: { $ne: student._id },
    });
    if (conflict) {
      throw new ApiError(409, 'STUDENT_CODE_ALREADY_EXISTS', 'Mã số sinh viên này đã thuộc về người khác');
    }
    student.studentCode = data.studentCode.toUpperCase();
  }

  Object.assign(student, data);
  await student.save();

  return student;
};

/**
 * Vô hiệu hóa sinh viên (Soft Delete).
 * Kiểm tra các trường hợp bị chặn theo API.md §3:
 * 1. Đang có hợp đồng hiệu lực (pending / active) -> 422 STUDENT_HAS_ACTIVE_CONTRACT
 * 2. Còn nợ chưa thanh toán -> 422 STUDENT_HAS_DEBT
 */
const deactivateStudent = async (id) => {
  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  const mongoose = require('mongoose');

  // 1. Kiểm tra hợp đồng đang hiệu lực
  if (mongoose.models.Contract) {
    const activeContract = await mongoose.models.Contract.findOne({
      studentId: student._id,
      status: { $in: ['pending', 'active'] },
    });
    if (activeContract) {
      throw new ApiError(422, 'STUDENT_HAS_ACTIVE_CONTRACT', 'Sinh viên đang có hợp đồng hiệu lực');
    }
  }

  // 2. Kiểm tra công nợ hóa đơn chưa thanh toán
  if (mongoose.models.Invoice) {
    const unpaidInvoice = await mongoose.models.Invoice.findOne({
      studentId: student._id,
      status: { $in: ['unpaid', 'partial', 'overdue'] },
    });
    if (unpaidInvoice) {
      throw new ApiError(422, 'STUDENT_HAS_DEBT', 'Sinh viên còn công nợ chưa thanh toán');
    }
  }

  student.status = 'inactive';
  await student.save();

  return {
    id: student._id,
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

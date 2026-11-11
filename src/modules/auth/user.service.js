/**
 * Service xử lý nghiệp vụ Quản lý tài khoản (/api/users).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.1 (FR-06 & FR-07).
 */

const User = require('./user.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');
const { generateTemporaryPassword } = require('./auth.service');

const roleWeight = {
  admin: 1,
  staff: 2,
  student: 3,
};

/**
 * 1. Lấy danh sách tài khoản kèm thống kê summary (FR-07 - Chỉ dành cho Admin)
 */
const getUsers = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // Tính toán summary trên toàn bộ users
  const allUsers = await User.find({}).select('role isActive');
  const summary = {
    all: allUsers.length,
    admin: 0,
    staff: 0,
    student: 0,
    locked: 0,
  };

  allUsers.forEach((u) => {
    if (u.isActive === false) summary.locked += 1;
    if (summary[u.role] !== undefined) summary[u.role] += 1;
  });

  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === true || query.isActive === 'true';
  }

  let users = await User.find(filter)
    .populate('studentId', 'studentCode fullName')
    .sort({ createdAt: -1 });

  // Tìm kiếm theo email, fullName, studentCode
  if (query.search) {
    const s = query.search.trim().toLowerCase();
    users = users.filter((u) => {
      const email = u.email?.toLowerCase() || '';
      const name = u.fullName?.toLowerCase() || '';
      const stuCode = u.studentId?.studentCode?.toLowerCase() || '';
      return email.includes(s) || name.includes(s) || stuCode.includes(s);
    });
  }

  // Sắp xếp admin -> staff -> student, sau đó theo tên
  users.sort((a, b) => {
    const wA = roleWeight[a.role] || 99;
    const wB = roleWeight[b.role] || 99;
    if (wA !== wB) return wA - wB;
    return (a.fullName || '').localeCompare(b.fullName || '');
  });

  const total = users.length;
  const paginated = users.slice(skip, skip + limit);

  const items = paginated.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: Boolean(u.mustChangePassword),
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    student: u.studentId ? {
      id: u.studentId._id.toString(),
      studentCode: u.studentId.studentCode,
      fullName: u.studentId.fullName,
    } : null,
  }));

  return {
    items,
    total,
    page,
    limit,
    summary,
  };
};

/**
 * 2. Tạo tài khoản mới trực tiếp (Chỉ dành cho Admin)
 */
const createUser = async (data) => {
  const emailLower = data.email.trim().toLowerCase();

  const existing = await User.findOne({ email: emailLower });
  if (existing) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email đã được sử dụng');
  }

  let fullName = data.fullName;
  let studentDoc = null;

  if (data.role === 'student' && data.studentId) {
    studentDoc = await Student.findById(data.studentId);
    if (!studentDoc) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Sinh viên không tồn tại');
    }

    if (studentDoc.userId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Sinh viên này đã có tài khoản');
    }
    fullName = studentDoc.fullName;
  }

  const temporaryPassword = generateTemporaryPassword(8);
  const passwordHash = await User.hashPassword(temporaryPassword);

  const user = await User.create({
    email: emailLower,
    passwordHash,
    fullName,
    role: data.role,
    studentId: studentDoc ? studentDoc._id : null,
    isActive: true,
    mustChangePassword: true,
  });

  if (studentDoc) {
    studentDoc.userId = user._id;
    await studentDoc.save();
  }

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: true,
    },
    temporaryPassword,
  };
};

/**
 * 3. Cập nhật thông tin tài khoản (Chỉ dành cho Admin)
 */
const updateUser = async (id, data, actorUserId) => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  }

  if (data.email && data.email.toLowerCase() !== user.email.toLowerCase()) {
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Email đã được sử dụng bởi tài khoản khác');
    }
    user.email = data.email.toLowerCase();
  }

  if (data.fullName !== undefined) user.fullName = data.fullName;
  if (data.role !== undefined) {
    // Không thể tự hạ quyền admin của chính mình nếu là admin cuối cùng
    if (user.role === 'admin' && data.role !== 'admin') {
      const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdmins <= 1) {
        throw new ApiError(422, 'LAST_ACTIVE_ADMIN', 'Không thể hạ quyền quản trị viên duy nhất của hệ thống');
      }
    }
    user.role = data.role;
  }

  await user.save();

  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
  };
};

/**
 * 4. Khóa / Mở khóa tài khoản (FR-07 - Chỉ dành cho Admin)
 */
const updateAccountStatus = async (id, isActive, actorUserId) => {
  if (actorUserId && actorUserId.toString() === id.toString()) {
    throw new ApiError(422, 'CANNOT_MODIFY_SELF', 'Không thể tự khóa tài khoản của chính mình');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  }

  // Chống khóa admin cuối cùng
  if (user.role === 'admin' && !isActive) {
    const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
    if (activeAdmins <= 1) {
      throw new ApiError(
        422,
        'LAST_ACTIVE_ADMIN',
        'Không thể khóa quản trị viên cuối cùng đang hoạt động của hệ thống'
      );
    }
  }

  user.isActive = Boolean(isActive);
  await user.save();

  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
  };
};

/**
 * 5. Đặt lại mật khẩu tạm thời (FR-06 - Admin / Staff)
 */
const resetPassword = async (id, actorUser) => {
  if (actorUser.id.toString() === id.toString()) {
    throw new ApiError(422, 'CANNOT_MODIFY_SELF', 'Không thể tự reset mật khẩu của chính mình tại mục này');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  }

  // Staff không được reset mật khẩu của Admin
  if (actorUser.role === 'staff' && user.role === 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Cán bộ không có quyền đặt lại mật khẩu cho Quản trị viên (Admin)');
  }

  // Sinh mật khẩu tạm mới
  const temporaryPassword = generateTemporaryPassword(8);
  user.passwordHash = await User.hashPassword(temporaryPassword);
  user.mustChangePassword = true; // Bắt buộc đổi MK lần sau
  await user.save();

  return {
    email: user.email,
    fullName: user.fullName,
    temporaryPassword,
    message: 'Đặt lại mật khẩu tạm thành công. Vui lòng cung cấp mật khẩu này cho người dùng.',
  };
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  updateAccountStatus,
  resetPassword,
};

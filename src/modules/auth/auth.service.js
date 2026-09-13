/**
 * Service xử lý logic nghiệp vụ cho Module Auth.
 * Tuân thủ theo API.md §2, DATA-SCHEMA.md §3.1 và 07-PHAN-QUYEN-BAO-MAT.md.
 */

const crypto = require('crypto');
const User = require('./user.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');
const { generateToken } = require('../../core/utils/jwt');

/**
 * Đăng ký tài khoản tự phục vụ cho sinh viên.
 * Vai trò bắt buộc là 'student' ở phía server (API.md §2).
 */
const register = async (data) => {
  const { email, password, fullName, studentCode, phone, gender, className, faculty } = data;

  // 1. Kiểm tra trùng email
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được sử dụng');
  }

  // 2. Kiểm tra trùng mã số sinh viên
  const existingStudent = await Student.findOne({ studentCode: studentCode.toUpperCase() });
  if (existingStudent) {
    throw new ApiError(409, 'STUDENT_CODE_ALREADY_EXISTS', 'Mã số sinh viên này đã tồn tại trong hệ thống');
  }

  // 3. Hash mật khẩu và tạo User
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    fullName,
    role: 'student', // Bắt buộc ép role student
    isActive: true,
  });

  // 4. Tạo hồ sơ Sinh viên tương ứng liên kết với User
  let student;
  try {
    student = await Student.create({
      userId: user._id,
      fullName,
      studentCode: studentCode.toUpperCase(),
      phone,
      email: email.toLowerCase(),
      gender,
      className,
      faculty,
      status: 'active',
    });
  } catch (studentErr) {
    // Rollback user nếu tạo profile student thất bại
    await User.findByIdAndDelete(user._id);
    throw studentErr;
  }

  // 5. Sinh JWT Token (hạn 7 ngày)
  const token = generateToken({
    id: user._id,
    role: user.role,
    studentId: student._id,
    mustChangePassword: false,
  });

  return {
    token,
    expiresIn: 7 * 24 * 60 * 60, // 604800 giây
    user: {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      studentId: student._id,
      mustChangePassword: false,
    },
  };
};

/**
 * Đăng nhập hệ thống (User + Staff + Admin).
 */
const login = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ ban quản lý');
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác');
  }

  // Cập nhật thời điểm đăng nhập gần nhất
  user.lastLoginAt = new Date();
  await user.save();

  // Tìm studentId nếu người dùng là sinh viên
  let studentId = null;
  if (user.role === 'student') {
    const student = await Student.findOne({ userId: user._id });
    if (student) {
      studentId = student._id;
    }
  }

  // Sinh JWT Token (hạn 7 ngày)
  const token = generateToken({
    id: user._id,
    role: user.role,
    studentId,
    mustChangePassword: user.mustChangePassword,
  });

  return {
    token,
    expiresIn: 7 * 24 * 60 * 60,
    user: {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      studentId,
      mustChangePassword: user.mustChangePassword,
    },
  };
};

/**
 * Lấy thông tin cá nhân của người dùng hiện tại từ JWT.
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy thông tin người dùng');
  }

  let studentProfile = null;
  if (user.role === 'student') {
    studentProfile = await Student.findOne({ userId: user._id });
  }

  return {
    ...user.toJSON(),
    student: studentProfile,
  };
};

/**
 * Đổi mật khẩu cá nhân.
 */
const changePassword = async (userId, { oldPassword, newPassword }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy người dùng');
  }

  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch) {
    throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không chính xác');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  return { message: 'Đổi mật khẩu thành công' };
};

/**
 * Admin hoặc Staff đặt lại mật khẩu tạm thời cho người dùng (FR-09, API.md §2).
 * Quy tắc: Staff không được đặt lại mật khẩu của Admin!
 */
const resetPassword = async (targetUserId, actorRole) => {
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản người dùng cần reset mật khẩu');
  }

  // Quy tắc kiểm tra phân quyền bảo mật (API.md §2)
  if (actorRole === 'staff' && targetUser.role === 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Nhân viên không có quyền đặt lại mật khẩu cho tài khoản Quản trị viên');
  }

  // Sinh mật khẩu ngẫu nhiên 10 ký tự gồm chữ và số
  const temporaryPassword = crypto.randomBytes(5).toString('hex');
  targetUser.passwordHash = await User.hashPassword(temporaryPassword);
  targetUser.mustChangePassword = true;
  await targetUser.save();

  // Mật khẩu tạm trả về 1 lần duy nhất và không được ghi log
  return {
    temporaryPassword,
    mustChangePassword: true,
  };
};

module.exports = {
  register,
  login,
  getMe,
  changePassword,
  resetPassword,
};

/**
 * Service xử lý logic nghiệp vụ cho Module Auth (Xác thực & Tài khoản).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.1 (FR-01 đến FR-06).
 * 
 * ============================================================================
 * [LUỒNG XÁC THỰC CỐT LÕI - DÀNH CHO TEAM 5]:
 * 1. Đăng nhập linh hoạt (FR-01):
 *    - Đăng nhập bằng Email HOẶC Mã sinh viên (MSSV) HaUI.
 *    - Trả về JWT 7 ngày kèm cờ `mustChangePassword`.
 * 2. Cấp tài khoản tự động (FR-02):
 *    - Không mở đăng ký tự do để chống tài khoản rác/mạo danh.
 *    - Tài khoản sinh viên được sinh tự động khi duyệt đơn KTX.
 * 3. Bắt buộc đổi mật khẩu lần đầu (FR-05):
 *    - Người dùng đổi mật khẩu, hệ thống tự động tắt cờ `mustChangePassword = false`.
 * ============================================================================
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('./user.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');
const { generateToken } = require('../../core/utils/jwt');

/**
 * Sinh mật khẩu tạm ngẫu nhiên an toàn
 */
const generateTemporaryPassword = (length = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars[crypto.randomInt(0, chars.length)];
  }
  return pwd;
};

/**
 * 1. Đăng nhập hệ thống bằng Email hoặc MSSV (FR-01)
 */
const login = async ({ identifier, email, username, password }) => {
  const loginId = (identifier || username || email || '').trim();
  if (!loginId || !password) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập tài khoản (Email/MSSV) và mật khẩu');
  }

  // Tìm kiếm tài khoản theo email hoặc theo MSSV của sinh viên
  let user = await User.findOne({ email: loginId.toLowerCase() }).select('+passwordHash');
  let student = null;

  if (!user) {
    // Nếu không khớp email, thử tra cứu theo Mã sinh viên HaUI
    student = await Student.findOne({ studentCode: loginId.toUpperCase() });
    if (student && student.userId) {
      user = await User.findById(student.userId).select('+passwordHash');
    }
  }

  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không chính xác');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ ban quản lý KTX');
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không chính xác');
  }

  // Cập nhật thời điểm đăng nhập gần nhất
  user.lastLoginAt = new Date();
  await user.save();

  // Lấy studentId nếu là sinh viên
  let studentId = user.studentId;
  let studentCode = null;
  if (!student && studentId) {
    student = await Student.findById(studentId);
  }
  if (student) {
    studentId = student._id.toString();
    studentCode = student.studentCode;
  }

  // Sinh JWT Token hạn 7 ngày
  const token = generateToken({
    id: user._id.toString(),
    role: user.role,
    studentId,
    studentCode,
    mustChangePassword: Boolean(user.mustChangePassword),
  });

  return {
    token,
    expiresIn: 7 * 24 * 60 * 60, // 7 ngày
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      studentId,
      studentCode,
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  };
};

/**
 * 2. Lấy thông tin tài khoản hiện tại (FR-04)
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy thông tin người dùng');
  }

  let studentProfile = null;
  if (user.role === 'student' && user.studentId) {
    studentProfile = await Student.findById(user.studentId);
  }

  return {
    user: user.toJSON(),
    student: studentProfile,
  };
};

/**
 * 3. Đổi mật khẩu cá nhân — Bắt buộc thực hiện ở lần đăng nhập đầu tiên (FR-05)
 */
const changePassword = async (userId, { currentPassword, newPassword, confirmPassword }) => {
  if (newPassword !== confirmPassword) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Mật khẩu mới và xác nhận mật khẩu không khớp nhau');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Mật khẩu mới phải có tối thiểu 6 ký tự');
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  }

  const isCurrentMatch = await user.comparePassword(currentPassword);
  if (!isCurrentMatch) {
    throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không chính xác');
  }

  // Cập nhật mật khẩu mới và TỰ ĐỘNG TẮT cờ mustChangePassword
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();

  return {
    message: 'Đổi mật khẩu thành công! Bạn có thể sử dụng đầy đủ các chức năng của hệ thống.',
  };
};

module.exports = {
  login,
  getMe,
  changePassword,
  generateTemporaryPassword,
};

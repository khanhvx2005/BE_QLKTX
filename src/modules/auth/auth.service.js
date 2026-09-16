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
 * Sinh mật khẩu tạm thời ngẫu nhiên tuân thủ BR-85
 * (Có ít nhất chữ hoa, chữ thường, chữ số, độ dài 10 ký tự)
 */
const generateTemporaryPassword = (length = 10) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  const chars = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
  ];

  for (let i = 3; i < length; i++) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }

  // Shuffle mảng ký tự
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};

/**
 * Đăng ký tài khoản tự phục vụ cho sinh viên.
 * Vai trò bắt buộc là 'student' ở phía server (API.md §2).
 */
const register = async (data) => {
  const { email, password, fullName, studentCode, phone, gender, className, faculty } = data;

  // 1. Kiểm tra trùng email (G5: DUPLICATE_ENTRY + data.errors)
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', 'Email đã tồn tại trong hệ thống', {
      errors: [{ field: 'email', message: 'Email này đã được sử dụng' }],
    });
  }

  // 2. Kiểm tra trùng mã số sinh viên
  const existingStudent = await Student.findOne({ studentCode: studentCode.toUpperCase() });
  if (existingStudent) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', 'Mã sinh viên đã tồn tại', {
      errors: [{ field: 'studentCode', message: 'Mã số sinh viên này đã tồn tại trong hệ thống' }],
    });
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
 * Quy tắc: Staff không được đặt lại mật khẩu của Admin (BR-84); không được tự reset mình.
 */
const resetPassword = async (targetUserId, actorRole, actorUserId) => {
  // Không được tự reset mật khẩu của chính mình
  if (actorUserId && actorUserId.toString() === targetUserId.toString()) {
    throw new ApiError(422, 'CANNOT_MODIFY_SELF', 'Không thể tự đặt lại mật khẩu cho chính mình (vui lòng sử dụng tính năng Đổi mật khẩu)');
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản người dùng cần reset mật khẩu');
  }

  // Quy tắc kiểm tra phân quyền bảo mật (API.md §2, BR-84)
  if (actorRole === 'staff' && targetUser.role === 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Nhân viên không có quyền đặt lại mật khẩu cho tài khoản Quản trị viên');
  }

  // Sinh mật khẩu ngẫu nhiên 10 ký tự tuân thủ BR-85 (gồm chữ hoa, chữ thường và số)
  const temporaryPassword = generateTemporaryPassword(10);
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
  generateTemporaryPassword,
  register,
  login,
  getMe,
  changePassword,
  resetPassword,
};

/**
 * Xác thực — `docs/API.md` (repo FE) §2.
 * Đăng nhập bằng email HOẶC MSSV (FR-01). Không có đăng ký tự do (FR-02): tài khoản SV sinh ra khi duyệt đơn.
 */

const User = require('./user.model');
const Student = require('../students/student.model');
const { generateToken } = require('../../core/utils/jwt');
const { fail, fieldErrors } = require('../../core/utils/http');

const userPayload = (user) => ({
  id: String(user._id),
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  studentId: user.studentId ? String(user.studentId) : null,
  studentCode: user.studentCode ?? null,
  mustChangePassword: Boolean(user.mustChangePassword),
});

/** Luật mật khẩu mới (FR-05): ≥ 8 ký tự, có chữ và số */
const passwordErrors = (pw, field = 'newPassword') => {
  if (!pw || String(pw).length < 8) return [{ field, message: 'Mật khẩu tối thiểu 8 ký tự' }];
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return [{ field, message: 'Mật khẩu phải có cả chữ và số' }];
  return [];
};

async function login({ identifier, password } = {}) {
  const key = String(identifier || '').trim();
  if (!key || !password) {
    fieldErrors([
      ...(!key ? [{ field: 'identifier', message: 'Nhập email hoặc mã sinh viên' }] : []),
      ...(!password ? [{ field: 'password', message: 'Nhập mật khẩu' }] : []),
    ]);
  }
  const user = await User.findOne({ $or: [{ email: key.toLowerCase() }, { studentCode: key.toUpperCase() }] }).select('+passwordHash');
  // ⚠️ Kiểm mật khẩu TRƯỚC khi báo khóa: báo khóa trước là lộ cho người ngoài biết tài khoản tồn tại
  if (!user || !(await user.comparePassword(String(password)))) {
    fail(401, 'INVALID_CREDENTIALS', 'Tài khoản hoặc mật khẩu không chính xác');
  }
  if (!user.isActive) fail(403, 'ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ ban quản lý');

  user.lastLoginAt = new Date();
  await user.save();
  const payload = userPayload(user);
  return {
    data: { token: generateToken({ id: payload.id, role: payload.role }), expiresIn: 7 * 24 * 60 * 60, user: payload },
    message: 'Đăng nhập thành công',
  };
}

async function me(userId) {
  const user = await User.findById(userId);
  if (!user) fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ');
  const student = user.studentId ? await Student.findById(user.studentId).lean() : null;
  return { data: { user: userPayload(user), student: student ? { ...student, id: String(student._id), _id: undefined, __v: undefined } : null } };
}

/** Body chuẩn `{ oldPassword, newPassword }` — nhận thêm `currentPassword` cho client cũ */
async function changePassword(userId, body = {}) {
  const oldPassword = body.oldPassword ?? body.currentPassword;
  const { newPassword } = body;
  const errors = [
    ...(!oldPassword ? [{ field: 'oldPassword', message: 'Nhập mật khẩu hiện tại' }] : []),
    ...passwordErrors(newPassword),
  ];
  if (errors.length) fieldErrors(errors);

  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await user.comparePassword(String(oldPassword)))) {
    fail(400, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không chính xác');
  }
  // UC-04: mật khẩu khởi tạo là MSSV — không được đặt lại đúng giá trị đó
  if (user.studentCode && String(newPassword).toUpperCase() === user.studentCode.toUpperCase()) {
    fail(400, 'PASSWORD_SAME_AS_DEFAULT', 'Mật khẩu mới không được trùng mã sinh viên');
  }
  user.passwordHash = await User.hashPassword(String(newPassword));
  user.mustChangePassword = false;
  await user.save();
  return { data: null, message: 'Đổi mật khẩu thành công' };
}

module.exports = { login, me, changePassword, passwordErrors };

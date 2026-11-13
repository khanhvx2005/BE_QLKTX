/**
 * Tài khoản — API.md §2. Màn quản lý tài khoản chỉ Admin; đặt lại mật khẩu thì Staff làm được cho SINH VIÊN.
 * Chỉ tạo tài khoản admin/staff ở đây; tài khoản sinh viên chỉ sinh ra khi duyệt đơn (FR-02).
 */

const crypto = require('crypto');
const User = require('./user.model');
const Student = require('../students/student.model');
const { fail, fieldErrors, paginate, matches } = require('../../core/utils/http');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ORDER = { admin: 0, staff: 1, student: 2 };

/** Mật khẩu tạm 10 ký tự, có chữ và số, bỏ ký tự dễ nhầm (0/O, 1/l/I) */
const genTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const s = Array.from({ length: 10 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return /\d/.test(s) && /[A-Za-z]/.test(s) ? s : genTempPassword();
};

const userView = (u, student = null) => ({
  id: String(u._id),
  email: u.email,
  fullName: u.fullName,
  role: u.role,
  isActive: u.isActive,
  mustChangePassword: Boolean(u.mustChangePassword),
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
  student: student ? { id: String(student._id), studentCode: student.studentCode, fullName: student.fullName, gender: student.gender } : null,
});

async function viewOf(user) {
  const st = user.studentId ? await Student.findById(user.studentId).lean() : null;
  return userView(user, st);
}

async function findUser(id) {
  const u = await User.findById(id);
  if (!u) fail(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  return u;
}

const activeAdminCount = () => User.countDocuments({ role: 'admin', isActive: true });

async function assertEmailFree(email, exceptId = null) {
  const taken = await User.exists({ email, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (taken) fail(409, 'DUPLICATE_ENTRY', 'Email này đã được dùng cho tài khoản khác', { errors: [{ field: 'email', message: 'Email này đã được dùng cho tài khoản khác' }] });
}

async function list(q = {}) {
  const all = await User.find().lean();
  const students = new Map((await Student.find({ _id: { $in: all.map((u) => u.studentId).filter(Boolean) } }).lean()).map((s) => [String(s._id), s]));
  let rows = all.map((u) => userView(u, students.get(String(u.studentId))));
  if (q.role) rows = rows.filter((u) => u.role === q.role);
  if (q.isActive !== undefined && q.isActive !== '') rows = rows.filter((u) => String(u.isActive) === String(q.isActive));
  rows = rows.filter((u) => matches(q.search, [u.email, u.fullName, u.student?.studentCode]));
  rows.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.fullName.localeCompare(b.fullName, 'vi'));
  const summary = {
    all: all.length,
    admin: all.filter((u) => u.role === 'admin').length,
    staff: all.filter((u) => u.role === 'staff').length,
    student: all.filter((u) => u.role === 'student').length,
    locked: all.filter((u) => !u.isActive).length,
  };
  return { data: paginate(rows, q, { summary }) };
}

async function create(body = {}) {
  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  const errors = [];
  if (!EMAIL_RE.test(email)) errors.push({ field: 'email', message: 'Email không đúng định dạng' });
  if (!fullName) errors.push({ field: 'fullName', message: 'Nhập họ tên' });
  if (!['admin', 'staff'].includes(body.role)) errors.push({ field: 'role', message: 'Chọn vai trò quản trị viên hoặc cán bộ' });
  if (errors.length) fieldErrors(errors);
  await assertEmailFree(email);

  const temporaryPassword = genTempPassword();
  const user = await User.create({
    email, fullName, role: body.role, passwordHash: await User.hashPassword(temporaryPassword), mustChangePassword: true,
  });
  return { data: { user: userView(user), temporaryPassword }, message: 'Đã tạo tài khoản', status: 201 };
}

async function update(id, body = {}, actor) {
  const u = await findUser(id);
  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : u.email;
  const role = body.role ?? u.role;
  const errors = [];
  if (!EMAIL_RE.test(email)) errors.push({ field: 'email', message: 'Email không đúng định dạng' });
  if (u.role !== 'student' && body.fullName !== undefined && !String(body.fullName).trim()) errors.push({ field: 'fullName', message: 'Nhập họ tên' });
  if (!Object.keys(ROLE_ORDER).includes(role)) errors.push({ field: 'role', message: 'Vai trò không hợp lệ' });
  if (role !== u.role && (role === 'student' || u.role === 'student')) errors.push({ field: 'role', message: 'Không đổi được vai trò giữa sinh viên và cán bộ' });
  if (errors.length) fieldErrors(errors);
  if (role !== u.role && String(u._id) === actor.id) fail(422, 'CANNOT_MODIFY_SELF', 'Không thể tự đổi vai trò của chính mình');
  if (u.role === 'admin' && role !== 'admin' && u.isActive && (await activeAdminCount()) === 1) {
    fail(422, 'LAST_ACTIVE_ADMIN', 'Không thể đổi vai trò của quản trị viên cuối cùng đang hoạt động');
  }
  await assertEmailFree(email, u._id);
  u.email = email;
  u.role = role;
  // Họ tên tài khoản sinh viên đi theo hồ sơ sinh viên, không sửa ở đây
  if (u.role !== 'student' && body.fullName !== undefined) u.fullName = String(body.fullName).trim();
  await u.save();
  return { data: await viewOf(u), message: 'Cập nhật tài khoản thành công' };
}

async function setStatus(id, { isActive } = {}, actor) {
  if (typeof isActive !== 'boolean') fieldErrors([{ field: 'isActive', message: 'Trạng thái không hợp lệ' }]);
  const u = await findUser(id);
  if (!isActive && String(u._id) === actor.id) fail(422, 'CANNOT_MODIFY_SELF', 'Không thể tự khóa tài khoản của chính mình');
  if (!isActive && u.role === 'admin' && u.isActive && (await activeAdminCount()) === 1) {
    fail(422, 'LAST_ACTIVE_ADMIN', 'Không thể khóa quản trị viên cuối cùng đang hoạt động');
  }
  u.isActive = isActive;
  await u.save();
  return { data: await viewOf(u), message: isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản' };
}

async function resetPassword(id, actor) {
  const u = await findUser(id);
  if (actor.role === 'staff' && u.role !== 'student') fail(403, 'FORBIDDEN', 'Cán bộ chỉ đặt lại được mật khẩu tài khoản sinh viên');
  if (String(u._id) === actor.id) fail(422, 'CANNOT_MODIFY_SELF', 'Dùng chức năng Đổi mật khẩu cho tài khoản của chính mình');
  const temporaryPassword = genTempPassword();
  u.passwordHash = await User.hashPassword(temporaryPassword);
  u.mustChangePassword = true;
  await u.save();
  return { data: { temporaryPassword, mustChangePassword: true }, message: 'Đã đặt lại mật khẩu' };
}

module.exports = { list, create, update, setStatus, resetPassword };

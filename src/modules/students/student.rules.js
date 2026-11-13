/**
 * Luật hồ sơ sinh viên — DÙNG CHUNG cho đơn đăng ký công khai, thêm/sửa sinh viên và nhập Excel,
 * để hồ sơ tạo ra từ đường nào cũng sửa được bằng đường khác.
 *
 * Từ 12/11/2026: mọi trường đều bắt buộc (đơn KTX thực tế), thêm số CCCD và địa chỉ thường trú.
 * ⚠️ FE kiểm cùng luật (PublicApplyPage, StudentFormModal, studentExcel) và mock (mockApi.studentErrors) —
 *    đổi một chỗ phải đổi cả bốn, kèm `docs/API.md` §3.
 */

const { isDateString, today } = require('../../core/utils/dates');

const STUDENT_CODE_RE = /^\d{10}$/; // MSSV HaUI 10 chữ số
const PHONE_RE = /^0\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CITIZEN_ID_RE = /^\d{12}$/; // CCCD 12 chữ số

const FIELDS = ['studentCode', 'fullName', 'gender', 'dob', 'phone', 'email', 'citizenId', 'address', 'faculty', 'className', 'emergencyContact'];

const str = (v) => (typeof v === 'string' ? v.trim() : v);

/** Chuẩn hóa body: cắt khoảng trắng, MSSV giữ nguyên chữ số, email thường */
const pickStudent = (body = {}) => {
  const out = {};
  FIELDS.forEach((f) => { if (body[f] !== undefined) out[f] = str(body[f]); });
  if (out.email) out.email = String(out.email).toLowerCase();
  if (out.emergencyContact && typeof out.emergencyContact === 'object') {
    out.emergencyContact = {
      name: str(out.emergencyContact.name) || '',
      phone: str(out.emergencyContact.phone) || '',
      relationship: str(out.emergencyContact.relationship) || '',
    };
  }
  return out;
};

/** Lỗi theo trường của một hồ sơ đầy đủ (sau khi gộp với bản cũ khi sửa) */
const studentErrors = (s) => {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });
  if (!STUDENT_CODE_RE.test(String(s.studentCode || ''))) push('studentCode', 'Mã sinh viên gồm đúng 10 chữ số');
  if (!String(s.fullName || '').trim()) push('fullName', 'Nhập họ và tên');
  if (!['male', 'female'].includes(s.gender)) push('gender', 'Chọn giới tính');
  if (!isDateString(s.dob)) push('dob', 'Chọn ngày sinh');
  else if (s.dob >= today()) push('dob', 'Ngày sinh không hợp lệ');
  if (!PHONE_RE.test(String(s.phone || ''))) push('phone', 'Số điện thoại gồm 10 số, bắt đầu bằng 0');
  if (!EMAIL_RE.test(String(s.email || ''))) push('email', 'Email không đúng định dạng');
  if (!CITIZEN_ID_RE.test(String(s.citizenId || ''))) push('citizenId', 'Số CCCD gồm đúng 12 chữ số');
  if (!String(s.address || '').trim()) push('address', 'Nhập địa chỉ thường trú');
  if (!String(s.faculty || '').trim()) push('faculty', 'Nhập khoa / viện');
  if (!String(s.className || '').trim()) push('className', 'Nhập lớp');
  const ec = s.emergencyContact || {};
  if (!String(ec.name || '').trim()) push('emergencyContact.name', 'Nhập họ tên người thân');
  if (!PHONE_RE.test(String(ec.phone || ''))) push('emergencyContact.phone', 'Số điện thoại người thân gồm 10 số, bắt đầu bằng 0');
  if (!String(ec.relationship || '').trim()) push('emergencyContact.relationship', 'Nhập quan hệ (VD: Bố, Mẹ)');
  return errors;
};

module.exports = { FIELDS, pickStudent, studentErrors, STUDENT_CODE_RE, PHONE_RE, EMAIL_RE, CITIZEN_ID_RE };

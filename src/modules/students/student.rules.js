/**
 * Luật hồ sơ sinh viên HaUI — dùng chung cho cổng công khai, thêm/sửa hồ sơ và nhập Excel.
 */

const { isDateString, today } = require('../../core/utils/dates');
const { PRIORITY_TYPES } = require('../../shared/constants/enums');

const STUDENT_CODE_RE = /^\d{10}$/; // MSSV HaUI 10 chữ số (YYYY60xxxx)
const PHONE_RE = /^0\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CITIZEN_ID_RE = /^\d{12}$/; // CCCD 12 chữ số

const FIELDS = [
  'studentCode',
  'fullName',
  'gender',
  'dob',
  'phone',
  'email',
  'citizenId',
  'address',
  'faculty',
  'className',
  'priorityType',
  'hasHealthCondition',
  'healthNote',
  'emergencyContact',
];

const str = (v) => (typeof v === 'string' ? v.trim() : v);

/** Bóc năm nhập học từ 4 chữ số đầu MSSV HaUI (VD: '2026601234' -> 2026) */
const parseEnrollmentYear = (studentCode) => {
  const code = String(studentCode || '').trim();
  if (!STUDENT_CODE_RE.test(code)) return null;
  const yr = Number(code.slice(0, 4));
  return yr >= 2000 && yr <= 2100 ? yr : null;
};

/** Xác định sinh viên là Tân SV (freshman) hay khóa cũ (returning) theo năm học bắt đầu */
const cohortFromStudentCode = (studentCode, academicYearStart) => {
  const yr = parseEnrollmentYear(studentCode);
  if (!yr || !academicYearStart) return null;
  const studyYear = Number(academicYearStart) - yr + 1;
  return {
    enrollmentYear: yr,
    studyYear,
    cohort: studyYear <= 1 ? 'freshman' : 'returning',
  };
};

const pickStudent = (body = {}) => {
  const out = {};
  FIELDS.forEach((f) => {
    if (body[f] !== undefined) out[f] = str(body[f]);
  });
  if (out.email) out.email = String(out.email).toLowerCase();
  if (out.hasHealthCondition !== undefined) out.hasHealthCondition = Boolean(out.hasHealthCondition);
  if (out.studentCode) {
    const yr = parseEnrollmentYear(out.studentCode);
    if (yr) out.enrollmentYear = yr;
  }
  if (out.emergencyContact && typeof out.emergencyContact === 'object') {
    out.emergencyContact = {
      name: str(out.emergencyContact.name) || '',
      phone: str(out.emergencyContact.phone) || '',
      relationship: str(out.emergencyContact.relationship) || '',
    };
  }
  return out;
};

const studentErrors = (s) => {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });
  if (!STUDENT_CODE_RE.test(String(s.studentCode || ''))) push('studentCode', 'Mã sinh viên HaUI gồm đúng 10 chữ số (VD: 2026601234)');
  else if (!parseEnrollmentYear(s.studentCode)) push('studentCode', '4 chữ số đầu của MSSV phải là năm nhập học hợp lệ');
  if (!String(s.fullName || '').trim()) push('fullName', 'Nhập họ và tên');
  if (!['male', 'female'].includes(s.gender)) push('gender', 'Chọn giới tính');
  if (!isDateString(s.dob)) push('dob', 'Chọn ngày sinh (YYYY-MM-DD)');
  else if (s.dob >= today()) push('dob', 'Ngày sinh không hợp lệ');
  if (!PHONE_RE.test(String(s.phone || ''))) push('phone', 'Số điện thoại gồm 10 số, bắt đầu bằng 0');
  if (!EMAIL_RE.test(String(s.email || ''))) push('email', 'Email không đúng định dạng');
  if (!CITIZEN_ID_RE.test(String(s.citizenId || ''))) push('citizenId', 'Số CCCD gồm đúng 12 chữ số');
  if (!String(s.address || '').trim()) push('address', 'Nhập địa chỉ thường trú');
  if (!String(s.faculty || '').trim()) push('faculty', 'Nhập khoa / viện');
  if (!String(s.className || '').trim()) push('className', 'Nhập lớp');
  if (s.priorityType !== undefined && !PRIORITY_TYPES.includes(s.priorityType)) {
    push('priorityType', 'Diện ưu tiên không hợp lệ');
  }
  const ec = s.emergencyContact || {};
  if (!String(ec.name || '').trim()) push('emergencyContact.name', 'Nhập họ tên người thân');
  if (!PHONE_RE.test(String(ec.phone || ''))) push('emergencyContact.phone', 'Số điện thoại người thân gồm 10 số, bắt đầu bằng 0');
  if (!String(ec.relationship || '').trim()) push('emergencyContact.relationship', 'Nhập quan hệ (VD: Bố, Mẹ)');
  return errors;
};

module.exports = {
  FIELDS,
  pickStudent,
  studentErrors,
  parseEnrollmentYear,
  cohortFromStudentCode,
  STUDENT_CODE_RE,
  PHONE_RE,
  EMAIL_RE,
  CITIZEN_ID_RE,
};

/**
 * Quản lý Đợt đăng ký KTX & Quy tắc phân luồng Tân SV vs Năm 2+ theo MSSV HaUI.
 */

const RegistrationPeriod = require('./registration-period.model');
const Contract = require('../contracts/contract.model');
const { CAMPUS_SCOPE, CAMPUS_INFO, TARGET_COHORTS, CONTRACT_TERMS, PERIOD_STATUS } = require('../../shared/constants/enums');
const { cohortFromStudentCode } = require('../students/student.rules');
const { today, isDateString } = require('../../core/utils/dates');
const { fail, fieldErrors, paginate, isObjectId } = require('../../core/utils/http');

const normalize = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const facultyMatchesList = (faculty, list = []) => {
  const f = normalize(faculty);
  if (!f) return false;
  return list.some((item) => {
    const it = normalize(item);
    return it && (f === it || f.includes(it) || it.includes(f));
  });
};

const isCurrentlyOpen = (p, currentDate = today()) =>
  p.status === 'open' && String(p.startDate) <= currentDate && currentDate <= String(p.endDate);

/** Kiểm tra điều kiện hợp lệ của sinh viên (MSSV + Khoa/Ngành) với một Đợt đăng ký */
function evaluateEligibility(period, { studentCode, faculty } = {}) {
  const currentDate = today();
  if (!isCurrentlyOpen(period, currentDate)) {
    return { eligible: false, reason: 'Đợt đăng ký hiện chưa mở hoặc đã hết hạn tiếp nhận', cohortInfo: null };
  }
  const cohortInfo = studentCode ? cohortFromStudentCode(studentCode, period.academicYearStart) : null;
  if (studentCode && !cohortInfo) {
    return { eligible: false, reason: 'Mã sinh viên HaUI phải gồm đúng 10 chữ số bắt đầu bằng năm nhập học', cohortInfo: null };
  }
  if (cohortInfo && period.targetCohort !== 'all' && cohortInfo.cohort !== period.targetCohort) {
    const label = period.targetCohort === 'freshman' ? 'Tân sinh viên năm nhất' : 'Sinh viên khóa cũ (từ năm 2 trở đi)';
    return {
      eligible: false,
      reason: `Đợt này chỉ dành cho ${label} (MSSV ${studentCode} thuộc năm học thứ ${cohortInfo.studyYear})`,
      cohortInfo,
    };
  }
  if (faculty) {
    if (Array.isArray(period.allowedFaculties) && period.allowedFaculties.length && !facultyMatchesList(faculty, period.allowedFaculties)) {
      return {
        eligible: false,
        reason: `Khoa/Ngành "${faculty}" không thuộc danh sách tiếp nhận của đợt này (${period.allowedFaculties.join(', ')})`,
        cohortInfo,
      };
    }
    if (Array.isArray(period.excludedFaculties) && period.excludedFaculties.length && facultyMatchesList(faculty, period.excludedFaculties)) {
      return {
        eligible: false,
        reason: `Khoa/Ngành "${faculty}" học tập trung tại Hà Nội từ năm nhất — vui lòng chọn đợt đăng ký tại CS1/CS2`,
        cohortInfo,
      };
    }
  }
  return { eligible: true, reason: null, cohortInfo };
}

const periodView = (p, stats = null) => ({
  id: String(p._id),
  code: p.code,
  name: p.name,
  academicYearStart: p.academicYearStart,
  campus: p.campus || 'cs1',
  campusName: CAMPUS_INFO[p.campus]?.name ?? CAMPUS_INFO.cs1.name,
  targetCohort: p.targetCohort,
  allowedFaculties: p.allowedFaculties || [],
  excludedFaculties: p.excludedFaculties || [],
  allowedTerms: p.allowedTerms || [],
  startDate: p.startDate,
  endDate: p.endDate,
  paymentDeadlineDays: p.paymentDeadlineDays || 7,
  status: p.status,
  isAcceptingNow: isCurrentlyOpen(p),
  description: p.description ?? '',
  createdAt: p.createdAt,
  ...(stats ? { stats } : {}),
});

const validatePeriodBody = (body = {}, isUpdate = false) => {
  const errors = [];
  if (!isUpdate || body.code !== undefined) {
    const code = String(body.code || '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) errors.push({ field: 'code', message: 'Mã đợt gồm chữ hoa, số, - hoặc _ (3–40 ký tự)' });
  }
  if (!isUpdate || body.name !== undefined) {
    if (!String(body.name || '').trim()) errors.push({ field: 'name', message: 'Nhập tên đợt đăng ký' });
  }
  if (!isUpdate || body.academicYearStart !== undefined) {
    const yr = Number(body.academicYearStart);
    if (!Number.isInteger(yr) || yr < 2020 || yr > 2100) errors.push({ field: 'academicYearStart', message: 'Năm bắt đầu năm học không hợp lệ' });
  }
  if (body.campus !== undefined && !CAMPUS_SCOPE.includes(body.campus)) {
    errors.push({ field: 'campus', message: 'Cơ sở không hợp lệ' });
  }
  if (body.targetCohort !== undefined && !TARGET_COHORTS.includes(body.targetCohort)) {
    errors.push({ field: 'targetCohort', message: 'Đối tượng phải là freshman, returning hoặc all' });
  }
  if (!isUpdate || body.allowedTerms !== undefined) {
    if (!Array.isArray(body.allowedTerms) || !body.allowedTerms.length || !body.allowedTerms.every((t) => CONTRACT_TERMS.includes(t))) {
      errors.push({ field: 'allowedTerms', message: 'Chọn ít nhất 1 gói kỳ hạn hợp lệ' });
    }
  }
  if (!isUpdate || body.startDate !== undefined) {
    if (!isDateString(body.startDate)) errors.push({ field: 'startDate', message: 'Ngày mở đợt định dạng YYYY-MM-DD' });
  }
  if (!isUpdate || body.endDate !== undefined) {
    if (!isDateString(body.endDate)) errors.push({ field: 'endDate', message: 'Ngày đóng đợt định dạng YYYY-MM-DD' });
  }
  if (body.startDate && body.endDate && body.endDate < body.startDate) {
    errors.push({ field: 'endDate', message: 'Ngày đóng đợt phải lớn hơn hoặc bằng ngày mở đợt' });
  }
  if (body.status !== undefined && !PERIOD_STATUS.includes(body.status)) {
    errors.push({ field: 'status', message: 'Trạng thái đợt phải là upcoming, open hoặc closed' });
  }
  if (body.paymentDeadlineDays !== undefined) {
    const d = Number(body.paymentDeadlineDays);
    if (!Number.isInteger(d) || d < 1 || d > 30) errors.push({ field: 'paymentDeadlineDays', message: 'Hạn nộp phí từ 1 đến 30 ngày' });
  }
  return errors;
};

async function statsByPeriod(periodIds) {
  if (!periodIds.length) return new Map();
  const agg = await Contract.aggregate([
    { $match: { periodId: { $in: periodIds } } },
    { $group: { _id: { p: '$periodId', s: '$status' }, n: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const row of agg) {
    const key = String(row._id.p);
    const cur = map.get(key) || { total: 0, pending: 0, pending_payment: 0, active: 0, rejected: 0, cancelled: 0, terminated: 0 };
    cur[row._id.s] = (cur[row._id.s] || 0) + row.n;
    cur.total += row.n;
    map.set(key, cur);
  }
  return map;
}

async function list(q = {}) {
  const filter = {};
  if (q.campus && CAMPUS_SCOPE.includes(q.campus)) filter.campus = q.campus;
  if (q.status && PERIOD_STATUS.includes(q.status)) filter.status = q.status;
  if (q.academicYearStart) filter.academicYearStart = Number(q.academicYearStart);
  const all = await RegistrationPeriod.find(filter).sort({ startDate: -1, createdAt: -1 }).lean();
  const stats = await statsByPeriod(all.map((p) => p._id));
  const empty = { total: 0, pending: 0, pending_payment: 0, active: 0, rejected: 0, cancelled: 0, terminated: 0 };
  return { data: paginate(all.map((p) => periodView(p, stats.get(String(p._id)) || empty)), q) };
}

async function getById(id) {
  const p = isObjectId(id) ? await RegistrationPeriod.findById(id).lean() : null;
  if (!p) fail(404, 'NOT_FOUND', 'Không tìm thấy đợt đăng ký');
  const stats = await statsByPeriod([p._id]);
  return {
    data: periodView(p, stats.get(String(p._id)) || { total: 0, pending: 0, pending_payment: 0, active: 0, rejected: 0, cancelled: 0, terminated: 0 }),
  };
}

/** Công khai: GET /api/public/periods/open?studentCode=&faculty= */
async function listOpenPublic(q = {}) {
  const cur = today();
  const all = await RegistrationPeriod.find({ status: 'open', startDate: { $lte: cur }, endDate: { $gte: cur } })
    .sort({ campus: 1, startDate: 1 })
    .lean();
  const rows = all.map((p) => {
    const view = periodView(p);
    if (q.studentCode || q.faculty) {
      view.eligibility = evaluateEligibility(p, { studentCode: q.studentCode, faculty: q.faculty });
    }
    return view;
  });
  return { data: rows };
}

async function create(body = {}) {
  const errors = validatePeriodBody(body, false);
  if (errors.length) fieldErrors(errors);
  const code = String(body.code).trim().toUpperCase();
  if (await RegistrationPeriod.exists({ code })) {
    fail(409, 'DUPLICATE_ENTRY', `Mã đợt ${code} đã tồn tại`, { errors: [{ field: 'code', message: `Mã đợt ${code} đã tồn tại` }] });
  }
  const p = await RegistrationPeriod.create({
    code,
    name: String(body.name).trim(),
    academicYearStart: Number(body.academicYearStart),
    campus: body.campus || 'cs1',
    targetCohort: body.targetCohort || 'all',
    allowedFaculties: Array.isArray(body.allowedFaculties) ? body.allowedFaculties.map((s) => String(s).trim()).filter(Boolean) : [],
    excludedFaculties: Array.isArray(body.excludedFaculties) ? body.excludedFaculties.map((s) => String(s).trim()).filter(Boolean) : [],
    allowedTerms: body.allowedTerms,
    startDate: body.startDate,
    endDate: body.endDate,
    paymentDeadlineDays: Number(body.paymentDeadlineDays) || 7,
    status: body.status || 'upcoming',
    description: String(body.description || '').trim(),
  });
  return { data: periodView(p.toObject()), message: `Đã tạo đợt đăng ký ${p.name}`, status: 201 };
}

async function update(id, body = {}) {
  const p = isObjectId(id) ? await RegistrationPeriod.findById(id) : null;
  if (!p) fail(404, 'NOT_FOUND', 'Không tìm thấy đợt đăng ký');
  const next = { ...p.toObject(), ...body };
  const errors = validatePeriodBody(next, true);
  if (errors.length) fieldErrors(errors);
  if (body.name !== undefined) p.name = String(body.name).trim();
  if (body.academicYearStart !== undefined) p.academicYearStart = Number(body.academicYearStart);
  if (body.campus !== undefined) p.campus = body.campus;
  if (body.targetCohort !== undefined) p.targetCohort = body.targetCohort;
  if (Array.isArray(body.allowedFaculties)) p.allowedFaculties = body.allowedFaculties.map((s) => String(s).trim()).filter(Boolean);
  if (Array.isArray(body.excludedFaculties)) p.excludedFaculties = body.excludedFaculties.map((s) => String(s).trim()).filter(Boolean);
  if (Array.isArray(body.allowedTerms)) p.allowedTerms = body.allowedTerms;
  if (body.startDate !== undefined) p.startDate = body.startDate;
  if (body.endDate !== undefined) p.endDate = body.endDate;
  if (body.paymentDeadlineDays !== undefined) p.paymentDeadlineDays = Number(body.paymentDeadlineDays);
  if (body.status !== undefined) p.status = body.status;
  if (body.description !== undefined) p.description = String(body.description).trim();
  await p.save();
  return { data: periodView(p.toObject()), message: 'Cập nhật đợt đăng ký thành công' };
}

async function setStatus(id, { status } = {}) {
  if (!PERIOD_STATUS.includes(status)) fieldErrors([{ field: 'status', message: 'Trạng thái phải là upcoming, open hoặc closed' }]);
  const p = isObjectId(id) ? await RegistrationPeriod.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' }).lean() : null;
  if (!p) fail(404, 'NOT_FOUND', 'Không tìm thấy đợt đăng ký');
  return { data: periodView(p), message: `Đã chuyển trạng thái đợt sang ${status}` };
}

module.exports = {
  list,
  getById,
  listOpenPublic,
  create,
  update,
  setStatus,
  evaluateEligibility,
  isCurrentlyOpen,
  periodView,
};

/**
 * Sinh viên — API.md §3. Thêm hồ sơ KHÔNG tạo tài khoản (tài khoản sinh ra khi duyệt đơn, FR-02).
 */

const Student = require('./student.model');
const User = require('../auth/user.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const { pickStudent, studentErrors } = require('./student.rules');
const { fail, fieldErrors, paginate, matches } = require('../../core/utils/http');
const { loadCtx, contractView, invoiceView, debtsOf, idOf } = require('../../shared/views');

const dupCode = () => fail(409, 'DUPLICATE_ENTRY', 'Mã số sinh viên đã tồn tại', { errors: [{ field: 'studentCode', message: 'Mã số sinh viên đã tồn tại' }] });

/** List item: hồ sơ + tài khoản + nợ cá nhân + chỗ ở hiện tại `{ buildingCode, roomNumber, bedNumber }` */
async function listItems(students) {
  const ids = students.map((s) => s._id);
  const [users, active, debts] = await Promise.all([
    User.find({ studentId: { $in: ids } }).select('studentId').lean(),
    Contract.find({ studentId: { $in: ids }, status: 'active' }).lean(),
    debtsOf(ids),
  ]);
  const ctx = await loadCtx({ roomIds: active.map((c) => c.roomId) });
  const userOf = new Map(users.map((u) => [String(u.studentId), String(u._id)]));
  const contractOf = new Map(active.map((c) => [String(c.studentId), c]));
  return students.map((s) => {
    const c = contractOf.get(String(s._id));
    const room = c && ctx.rooms.get(String(c.roomId));
    const b = room && ctx.buildings.get(String(room.buildingId));
    return {
      ...Student.hydrate(s).toJSON(),
      userId: userOf.get(String(s._id)) ?? null,
      hasAccount: userOf.has(String(s._id)),
      totalDebt: debts.get(String(s._id)) ?? 0,
      residence: room ? { buildingCode: b?.code ?? null, roomNumber: room.roomNumber, bedNumber: c.bedNumber } : null,
    };
  });
}
const listItem = async (s) => (await listItems([s]))[0];

async function findStudent(id) {
  const s = await Student.findById(id).lean();
  if (!s) fail(404, 'NOT_FOUND', 'Không tìm thấy sinh viên');
  return s;
}

/** GET /students ?search=&gender=&faculty=&status=&hasAccount=&page=&limit= (FR-10) */
async function list(q = {}) {
  const filter = { status: q.status || 'active' };
  if (q.gender) filter.gender = q.gender;
  if (q.faculty) filter.faculty = q.faculty;
  let rows = (await Student.find(filter).sort({ studentCode: 1 }).lean())
    .filter((s) => matches(q.search, [s.fullName, s.studentCode, s.phone]));
  let items = await listItems(rows);
  if (q.hasAccount !== undefined && q.hasAccount !== '') items = items.filter((s) => String(s.hasAccount) === String(q.hasAccount));
  rows = null;
  return { data: paginate(items, q) };
}

/** GET /students/:id — kèm hợp đồng hiện tại, lịch sử hợp đồng, hóa đơn chưa trả (FR-11) */
async function getById(id) {
  const s = await findStudent(id);
  const contracts = await Contract.find({ studentId: s._id }).sort({ createdAt: -1 }).lean();
  const unpaid = await Invoice.find({ studentId: s._id, status: 'unpaid', scope: 'personal' }).sort({ createdAt: -1 }).lean();
  const ctx = await loadCtx({ roomIds: [...contracts.map((c) => c.roomId), ...unpaid.map((i) => i.roomId)], studentIds: [s._id] });
  const debts = await debtsOf([s._id]);
  const current = contracts.find((c) => c.status === 'active');
  return {
    data: {
      ...(await listItem(s)),
      currentContract: current ? contractView(current, ctx, debts) : null,
      contracts: contracts.map((c) => contractView(c, ctx, debts)),
      unpaidInvoices: unpaid.map((i) => invoiceView(i, ctx)),
    },
  };
}

async function create(body = {}) {
  const data = pickStudent(body);
  const errors = studentErrors(data);
  if (errors.length) fieldErrors(errors);
  if (await Student.exists({ studentCode: data.studentCode })) dupCode();
  const s = await Student.create({ ...data, status: 'active' });
  return { data: await listItem(s.toObject()), message: 'Thêm sinh viên thành công', status: 201 };
}

/** PUT /students/:id — đổi được MSSV nhưng không trùng (FR-13); tài khoản đi theo MSSV / họ tên */
async function update(id, body = {}) {
  const s = await findStudent(id);
  const patch = pickStudent(body);
  const next = { ...s, ...patch };
  const errors = studentErrors(next);
  if (errors.length) fieldErrors(errors);
  if (next.studentCode !== s.studentCode && (await Student.exists({ studentCode: next.studentCode, _id: { $ne: s._id } }))) dupCode();
  // BR-01: giường đang giữ thuộc phòng theo giới tính cũ — đổi giới tính lúc này là đưa SV nữ vào phòng nam
  if (next.gender !== s.gender && (await Contract.exists({ studentId: s._id, status: { $in: ['pending', 'active'] } }))) {
    fail(422, 'GENDER_CHANGE_NOT_ALLOWED', 'Sinh viên đang có đơn chờ duyệt hoặc đang ở, không đổi được giới tính', {
      errors: [{ field: 'gender', message: 'Đang có đơn chờ duyệt hoặc đang ở — từ chối đơn hoặc thanh lý trước khi đổi giới tính' }],
    });
  }
  await Student.updateOne({ _id: s._id }, { $set: patch });
  // Đăng nhập bằng MSSV (FR-01) → tài khoản phải mang MSSV mới
  await User.updateOne({ studentId: s._id }, { $set: { studentCode: next.studentCode, fullName: next.fullName } });
  return { data: await listItem(await Student.findById(s._id).lean()), message: 'Cập nhật thành công' };
}

/**
 * POST /students/import — { rows: [{ row, ...Student }] }, tối đa 1000 dòng (FR-12b).
 * FE đọc Excel rồi gửi JSON. Dòng hợp lệ vẫn lưu khi dòng khác lỗi; mỗi dòng báo lỗi đầu tiên kèm số dòng Excel.
 */
async function importMany({ rows } = {}) {
  if (!Array.isArray(rows) || !rows.length) fail(400, 'VALIDATION_ERROR', 'File không có dòng dữ liệu nào');
  if (rows.length > 1000) fail(400, 'VALIDATION_ERROR', 'Mỗi lần nhập tối đa 1000 dòng');
  const errors = [];
  let successCount = 0;
  const seen = new Set((await Student.find().select('studentCode').lean()).map((s) => s.studentCode));
  for (const r of rows) {
    const data = pickStudent(r);
    const err = (field, message) => errors.push({ row: r.row, studentCode: data.studentCode ?? null, field, message });
    const fieldErrs = studentErrors(data);
    if (fieldErrs.length) { err(fieldErrs[0].field, fieldErrs[0].message); continue; }
    if (seen.has(data.studentCode)) { err('studentCode', 'Mã số sinh viên đã tồn tại'); continue; }
    await Student.create({ ...data, status: 'active' });
    seen.add(data.studentCode);
    successCount += 1;
  }
  errors.sort((a, b) => a.row - b.row);
  return {
    data: { successCount, errorCount: errors.length, errors },
    message: errors.length ? `Đã nhập ${successCount} sinh viên, ${errors.length} dòng lỗi` : `Đã nhập ${successCount} sinh viên`,
  };
}

/** PATCH /students/:id/deactivate — chặn khi còn đơn chờ / hợp đồng, hoặc còn nợ (FR-14) */
async function deactivate(id) {
  const s = await findStudent(id);
  if (await Contract.exists({ studentId: s._id, status: { $in: ['pending', 'active'] } })) {
    fail(422, 'STUDENT_HAS_ACTIVE_CONTRACT', 'Sinh viên đang có hợp đồng hiệu lực hoặc đơn đăng ký chờ duyệt, không thể vô hiệu hóa');
  }
  if (((await debtsOf([s._id])).get(idOf(s)) ?? 0) > 0) fail(422, 'STUDENT_HAS_DEBT', 'Sinh viên còn công nợ chưa thanh toán');
  await Student.updateOne({ _id: s._id }, { $set: { status: 'inactive' } });
  return { data: await listItem(await Student.findById(s._id).lean()), message: 'Đã vô hiệu hóa sinh viên' };
}

module.exports = { list, getById, create, update, importMany, deactivate };

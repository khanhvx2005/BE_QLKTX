/**
 * Cổng sinh viên — API.md §9. Danh tính LUÔN lấy từ JWT (req.user.studentId), không từ query/body.
 *
 * Sinh viên xem được: hóa đơn cá nhân của mình + hóa đơn của phòng ĐANG ở.
 * ⚠️ Chuyển phòng / trả phòng thì không còn thấy hóa đơn phòng cũ — đúng ý đồ, hóa đơn phòng thuộc về người đang ở.
 */

const Student = require('../students/student.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const UtilityReading = require('../fees/utility-reading.model');
const config = require('../../core/config');
const { fail, paginate, isObjectId } = require('../../core/utils/http');
const { loadCtx, contractView, debtsOf } = require('../../shared/views');
const fees = require('../fees/fee.service');
const payments = require('../payments/payment.service');

async function me(req) {
  const st = req.user.studentId ? await Student.findById(req.user.studentId).lean() : null;
  if (!st) fail(403, 'FORBIDDEN', 'Tài khoản chưa gắn với hồ sơ sinh viên');
  return st;
}

/** Hợp đồng còn giữ giường (status lưu active — gồm cả quá hạn chưa thanh lý) */
const holdingContract = (studentId) => Contract.findOne({ studentId, status: 'active' }).lean();

/** Điều kiện Mongo: hóa đơn sinh viên được xem */
async function visibleFilter(st) {
  const c = await holdingContract(st._id);
  return { $or: [{ scope: 'personal', studentId: st._id }, ...(c ? [{ scope: 'room', roomId: c.roomId }] : [])] };
}

async function assertVisible(st, inv) {
  const c = await holdingContract(st._id);
  const ok = inv.scope === 'personal' ? String(inv.studentId) === String(st._id) : c && String(inv.roomId) === String(c.roomId);
  if (!ok) fail(403, 'FORBIDDEN', 'Bạn không có quyền truy cập dữ liệu này');
}

async function profile(req) {
  return { data: Student.hydrate(await me(req)).toJSON() };
}

async function myResidence(req) {
  const st = await me(req);
  const c = await holdingContract(st._id);
  if (!c) return { data: { hasResidence: false, contract: null, roommates: [], debtSummary: { totalDebt: 0, unpaidInvoiceCount: 0 } } };
  const mates = await Contract.find({ roomId: c.roomId, status: 'active', studentId: { $ne: st._id } }).lean();
  const ctx = await loadCtx({ roomIds: [c.roomId], studentIds: [st._id, ...mates.map((m) => m.studentId)] });
  const debts = await debtsOf([st._id]);
  return {
    data: {
      hasResidence: true,
      contract: contractView(c, ctx, debts),
      // FR-60: bạn cùng phòng chỉ lộ họ tên + MSSV
      roommates: mates.map((m) => ctx.students.get(String(m.studentId))).filter(Boolean)
        .map((s) => ({ studentCode: s.studentCode, fullName: s.fullName }))
        .sort((a, b) => a.studentCode.localeCompare(b.studentCode)),
      debtSummary: {
        totalDebt: debts.get(String(st._id)) ?? 0,
        unpaidInvoiceCount: await Invoice.countDocuments({ studentId: st._id, scope: 'personal', status: 'unpaid' }),
      },
    },
  };
}

/** Mọi hợp đồng và đơn của chính sinh viên, mới nhất trước */
async function myContracts(req) {
  const st = await me(req);
  const list = await Contract.find({ studentId: st._id }).sort({ createdAt: -1 }).lean();
  const ctx = await loadCtx({ roomIds: list.map((c) => c.roomId), studentIds: [st._id] });
  const debts = await debtsOf([st._id]);
  return { data: list.map((c) => contractView(c, ctx, debts)) };
}

/** GET /portal/my-invoices ?scope=personal|room&status=&page=&limit= (FR-62) — chưa nộp lên đầu, rồi mới nhất */
async function myInvoices(req) {
  const st = await me(req);
  const q = req.query;
  const filter = await visibleFilter(st);
  if (q.scope) filter.scope = q.scope;
  if (q.status) filter.status = q.status;
  const rows = (await fees.invoiceViews(await Invoice.find(filter).lean()))
    .sort((x, y) => (x.status === y.status ? 0 : x.status === 'unpaid' ? -1 : 1) || new Date(y.createdAt) - new Date(x.createdAt));
  return { data: paginate(rows, { limit: 100, ...q }) };
}

async function myInvoice(req) {
  const st = await me(req);
  const inv = isObjectId(req.params.id) ? await Invoice.findById(req.params.id).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  await assertVisible(st, inv);
  return fees.getInvoice(req.params.id);
}

/** GET /portal/my-invoices/:id/vietqr (FR-53). Nội dung chuyển khoản bỏ dấu `-` (app ngân hàng hay lược mất) */
async function myInvoiceVietqr(req) {
  const st = await me(req);
  const inv = isObjectId(req.params.id) ? await Invoice.findById(req.params.id).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  await assertVisible(st, inv);
  if (inv.status === 'paid') fail(409, 'INVOICE_ALREADY_PAID', `Hóa đơn ${inv.invoiceCode} đã được thanh toán`);
  const code = inv.invoiceCode.replace(/-/g, '');
  const ctx = await loadCtx({ roomIds: [inv.roomId] });
  const room = ctx.rooms.get(String(inv.roomId));
  return {
    data: {
      ...config.vietqr,
      amount: inv.amount,
      transferContent: inv.scope === 'room' ? `HAUI ${code} P${room?.roomNumber ?? ''}` : `HAUI ${code} ${st.studentCode}`,
    },
  };
}

/** GET /portal/my-payments — phiếu thu hóa đơn của mình và của phòng mình (FR-63), mới nhất trước */
async function myPayments(req) {
  const st = await me(req);
  const visible = await Invoice.find(await visibleFilter(st)).select('_id').lean();
  const list = await Payment.find({ invoiceId: { $in: visible.map((i) => i._id) } }).sort({ paidAt: -1 }).lean();
  return { data: paginate(await payments.paymentViews(list), { limit: 100, ...req.query }) };
}

/** GET /portal/my-room/utility-history ?limit=12 — chỉ tháng ĐÃ chốt của phòng đang ở (chưa chốt thì số còn đổi) */
async function myRoomUtilityHistory(req) {
  const st = await me(req);
  const c = await holdingContract(st._id);
  if (!c) return { data: [] };
  const list = await UtilityReading.find({ roomId: c.roomId, isBilled: true }).sort({ monthYear: -1 })
    .limit(Math.min(Number(req.query.limit) || 12, 24)).lean();
  return { data: list.map(fees.readingView) };
}

module.exports = {
  profile, myResidence, myContracts, myInvoices, myInvoice, myInvoiceVietqr, myPayments, myRoomUtilityHistory,
};

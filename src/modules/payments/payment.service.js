/**
 * Thu tiền và phiếu thu — API.md §8 (FR-52, FR-54). Luôn thu đủ `amount`, một hóa đơn một phiếu.
 * Hóa đơn phòng: bắt buộc chọn người nộp là SV đang ở phòng đó (BR-03, D5). Hóa đơn cá nhân: người nộp là chủ hóa đơn.
 */

const Invoice = require('../fees/invoice.model');
const Payment = require('./payment.model');
const { fail, paginate, matches, isObjectId } = require('../../core/utils/http');
const { createWithCode, yearPrefix } = require('../../core/utils/code-generator');
const { localDate } = require('../../core/utils/dates');
const { loadCtx, invoiceView, paymentView, residentsOf, byId } = require('../../shared/views');

async function collect(method, body = {}, actor) {
  const inv = isObjectId(body.invoiceId) ? await Invoice.findById(body.invoiceId).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  if (inv.status === 'paid') fail(409, 'INVOICE_ALREADY_PAID', `Hóa đơn ${inv.invoiceCode} đã được thanh toán`);
  let payerStudentId = inv.studentId;
  if (inv.scope === 'room') {
    payerStudentId = body.payerStudentId;
    const residents = await residentsOf(inv.roomId);
    if (!residents.some(({ student }) => String(student._id) === String(payerStudentId))) {
      fail(422, 'PAYER_NOT_IN_ROOM', 'Chọn người nộp là sinh viên đang ở phòng này', { errors: [{ field: 'payerStudentId', message: 'Chọn người nộp đang ở phòng này' }] });
    }
  }
  const transactionCode = method === 'vietqr' ? (String(body.transactionCode || '').trim().toUpperCase() || null) : null;
  if (transactionCode && (await Payment.exists({ transactionCode }))) {
    fail(409, 'DUPLICATE_TRANSACTION_CODE', `Mã giao dịch ${transactionCode} đã được ghi nhận`, { errors: [{ field: 'transactionCode', message: 'Mã giao dịch này đã được ghi nhận trước đó' }] });
  }
  const paidAt = new Date();
  // Đánh dấu đã thu có điều kiện `status: 'unpaid'` trước: hai cán bộ bấm cùng lúc thì chỉ một người thu được
  const updated = await Invoice.findOneAndUpdate(
    { _id: inv._id, status: 'unpaid' }, { $set: { status: 'paid', paidAt, payerStudentId } }, { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'INVOICE_ALREADY_PAID', `Hóa đơn ${inv.invoiceCode} đã được thanh toán`);
  let payment;
  try {
    payment = await createWithCode(Payment, 'paymentCode', yearPrefix('PAY'), (paymentCode) => ({
      paymentCode, invoiceId: inv._id, amount: inv.amount, method, transactionCode, note: String(body.note || '').trim(),
      paidAt, payerStudentId, collectedBy: actor.id, collectedByName: actor.fullName,
    }));
  } catch (err) {
    await Invoice.updateOne({ _id: inv._id }, { $set: { status: 'unpaid', paidAt: null, payerStudentId: null } });
    throw err;
  }
  const ctx = await loadCtx({ roomIds: [updated.roomId], studentIds: [updated.studentId, payerStudentId] });
  return {
    data: { payment: paymentView(payment.toObject(), ctx, new Map([[String(updated._id), updated]])), invoice: invoiceView(updated, ctx) },
    message: 'Đã xác nhận thu tiền',
    status: 201,
  };
}

/** Phiếu thu → view (dùng chung cho cán bộ và cổng SV) */
async function paymentViews(list) {
  const invoices = byId(await Invoice.find({ _id: { $in: list.map((p) => p.invoiceId) } }).lean());
  const ctx = await loadCtx({ roomIds: [...invoices.values()].map((i) => i.roomId), studentIds: list.map((p) => p.payerStudentId) });
  return list.map((p) => paymentView(p, ctx, invoices));
}

/** GET /payments ?method=&type=&from=&to=&search=&invoiceId=&page=&limit= — mới nhất trước, summary của cả tập đã lọc */
async function list(q = {}) {
  const filter = {};
  if (q.method) filter.method = q.method;
  if (isObjectId(q.invoiceId)) filter.invoiceId = q.invoiceId;
  let rows = await paymentViews(await Payment.find(filter).sort({ paidAt: -1 }).lean());
  if (q.type) rows = rows.filter((p) => p.invoiceType === q.type);
  // Lọc theo NGÀY Việt Nam của thời điểm thu (from/to là YYYY-MM-DD)
  if (q.from) rows = rows.filter((p) => localDate(p.paidAt) >= q.from);
  if (q.to) rows = rows.filter((p) => localDate(p.paidAt) <= q.to);
  rows = rows.filter((p) => matches(q.search, [p.paymentCode, p.invoiceCode, p.transactionCode, p.payer?.fullName, p.payer?.studentCode]));
  const sumOf = (l) => l.reduce((t, p) => t + p.amount, 0);
  const summary = { totalAmount: sumOf(rows), cashAmount: sumOf(rows.filter((p) => p.method === 'cash')), vietqrAmount: sumOf(rows.filter((p) => p.method === 'vietqr')) };
  return { data: paginate(rows, q, { summary }) };
}

module.exports = {
  collectCash: (body, actor) => collect('cash', body, actor),
  confirmVietqr: (body, actor) => collect('vietqr', body, actor),
  list,
  paymentViews,
};

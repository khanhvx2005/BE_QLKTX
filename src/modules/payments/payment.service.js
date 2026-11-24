/**
 * Thu tiền, Webhook VietQR tự động (NAPAS 247 / SePay / Casso) & Phiếu chi hoàn cọc (API.md §7).
 *
 * Điểm cốt lõi v3.0:
 *   - Chặn thu tiền hóa đơn đã `cancelled` (`409 INVOICE_CANCELLED`).
 *   - Tự động gọi `contractService.activateIfInitialPaid(inv.contractId)` sau mỗi lần gạch nợ thành công
 *     (dù qua Webhook VietQR hay thu tiền mặt) để tự nâng hợp đồng `pending_payment -> active` & sinh mã QR Check-in.
 *   - Chống ghi nhận trùng giao dịch Webhook bằng partial unique index `transactionCode` (BR-10).
 */

const Invoice = require('../fees/invoice.model');
const Payment = require('./payment.model');
const Contract = require('../contracts/contract.model');
const contractService = require('../contracts/contract.service');
const notificationService = require('../notifications/notification.service');
const config = require('../../core/config');
const { fail, fieldErrors, paginate, matches, isObjectId } = require('../../core/utils/http');
const { createWithCode, yearPrefix } = require('../../core/utils/code-generator');
const { localDate } = require('../../core/utils/dates');
const { loadCtx, invoiceView, paymentView, roomRef, residentsOf, byId } = require('../../shared/views');

async function resolveRoomPayer(inv, requestedPayerId, { allowAutoFallback = false, rawContent = '' } = {}) {
  const residents = await residentsOf(inv.roomId);
  if (requestedPayerId) {
    if (residents.some(({ student }) => String(student._id) === String(requestedPayerId))) {
      return requestedPayerId;
    }
    // Nếu phòng đã trống (tất cả đã trả phòng trước khi thanh toán hóa đơn còn tồn), cho phép SV từng ở phòng đó nộp
    if (!residents.length && isObjectId(requestedPayerId)) {
      const hadContract = await Contract.exists({ roomId: inv.roomId, studentId: requestedPayerId });
      if (hadContract) return requestedPayerId;
    }
    if (!allowAutoFallback) {
      fail(422, 'PAYER_NOT_IN_ROOM', 'Chọn người nộp là sinh viên đang ở phòng này', {
        errors: [{ field: 'payerStudentId', message: 'Chọn người nộp đang ở phòng này' }],
      });
    }
  }

  if (allowAutoFallback) {
    // Thử bắt MSSV 10 số trong nội dung chuyển khoản khớp thành viên phòng
    const codeMatch = String(rawContent || '').match(/\b\d{10}\b/);
    if (codeMatch) {
      const matched = residents.find(({ student }) => student.studentCode === codeMatch[0]);
      if (matched) return matched.student._id;
    }
    return residents[0]?.student?._id ?? null;
  }

  fail(422, 'PAYER_NOT_IN_ROOM', 'Chọn người nộp là sinh viên đang ở phòng này', {
    errors: [{ field: 'payerStudentId', message: 'Chọn người nộp đang ở phòng này' }],
  });
}

async function settleInvoice(inv, { method, payerStudentId, transactionCode = null, note = '', actor = null }) {
  if (inv.status === 'cancelled') {
    fail(409, 'INVOICE_CANCELLED', `Hóa đơn ${inv.invoiceCode} đã bị hủy, không thể thanh toán`);
  }
  if (inv.status === 'paid') {
    fail(409, 'INVOICE_ALREADY_PAID', `Hóa đơn ${inv.invoiceCode} đã được thanh toán`);
  }
  if (transactionCode && (await Payment.exists({ transactionCode }))) {
    fail(409, 'DUPLICATE_TRANSACTION_CODE', `Mã giao dịch ${transactionCode} đã được ghi nhận`, {
      errors: [{ field: 'transactionCode', message: 'Mã giao dịch này đã được ghi nhận trước đó' }],
    });
  }

  const paidAt = new Date();
  const updated = await Invoice.findOneAndUpdate(
    { _id: inv._id, status: 'unpaid' },
    { $set: { status: 'paid', paidAt, payerStudentId } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'INVOICE_ALREADY_PAID', `Hóa đơn ${inv.invoiceCode} đã được thanh toán`);

  let payment;
  try {
    payment = await createWithCode(Payment, 'paymentCode', yearPrefix('PAY'), (paymentCode) => ({
      paymentCode,
      paymentType: 'payment',
      invoiceId: inv._id,
      contractId: inv.contractId ?? null,
      amount: inv.amount,
      method,
      transactionCode,
      note: String(note || '').trim(),
      paidAt,
      payerStudentId,
      collectedBy: actor?.id ?? null,
      collectedByName: actor?.fullName ?? 'Hệ thống VietQR tự động',
    }));
  } catch (err) {
    await Invoice.updateOne({ _id: inv._id }, { $set: { status: 'unpaid', paidAt: null, payerStudentId: null } });
    throw err;
  }

  // Hook tự động kích hoạt hợp đồng pending_payment -> active + sinh mã QR Check-in khi đủ phí đầu kỳ!
  let activatedContract = null;
  if (updated.contractId && (updated.type === 'deposit' || updated.type === 'room_semester')) {
    activatedContract = await contractService.activateIfInitialPaid(updated.contractId);
  }

  // Bắn thông báo xác nhận thanh toán cho sinh viên nộp tiền (trừ khi đã bắn thông báo kích hoạt hợp đồng)
  if (!activatedContract && payerStudentId) {
    await notificationService
      .notifyStudent(payerStudentId, {
        type: 'payment',
        title: `Đã thanh toán hóa đơn ${updated.invoiceCode}`,
        content: `Hệ thống đã xác nhận thanh toán ${updated.amount.toLocaleString('vi-VN')} VNĐ cho hóa đơn ${updated.invoiceCode} (${method === 'vietqr' ? 'VietQR' : 'Tiền mặt'}).`,
        refType: 'invoice',
        refId: updated._id,
      })
      .catch(() => {});
  }

  const ctx = await loadCtx({
    roomIds: [updated.roomId],
    studentIds: [updated.studentId, payerStudentId],
  });
  return {
    payment: paymentView(payment.toObject(), ctx, new Map([[String(updated._id), updated]])),
    invoice: invoiceView(updated, ctx),
    contractActivated: Boolean(activatedContract),
    checkinCode: activatedContract?.checkinCode ?? null,
  };
}

async function collect(method, body = {}, actor) {
  const inv = isObjectId(body.invoiceId) ? await Invoice.findById(body.invoiceId).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');

  const payerStudentId =
    inv.scope === 'room' ? await resolveRoomPayer(inv, body.payerStudentId, { allowAutoFallback: false }) : inv.studentId;
  const transactionCode = method === 'vietqr' ? String(body.transactionCode || '').trim().toUpperCase() || null : null;

  const result = await settleInvoice(inv, {
    method,
    payerStudentId,
    transactionCode,
    note: body.note,
    actor,
  });

  return {
    data: result,
    message: result.contractActivated
      ? 'Đã xác nhận thu tiền và tự động kích hoạt hợp đồng (đã cấp mã QR Check-in)'
      : 'Đã xác nhận thu tiền',
    status: 201,
  };
}

/** Tìm hóa đơn theo mã nhúng trong nội dung chuyển khoản VietQR (hỗ trợ cả có và không có dấu `-`) */
async function findInvoiceFromTransferContent(content) {
  const raw = String(content || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, '');

  // 1. Thử khớp trực tiếp token bắt đầu bằng INV
  const tokens = upper.match(/INV[A-Z0-9-]*/g) || [];
  if (tokens.length) {
    const exact = await Invoice.findOne({ invoiceCode: { $in: tokens } }).lean();
    if (exact) return exact;
  }

  // 2. So khớp dạng bỏ dấu `-` (app ngân hàng thường tự bỏ dấu `-`)
  const compactTokens = new Set(tokens.map((t) => t.replace(/-/g, '')));
  const candidates = await Invoice.find({ status: { $in: ['unpaid', 'paid'] } })
    .sort({ createdAt: -1 })
    .lean();

  // Sắp theo độ dài invoiceCode giảm dần để tránh khớp tiền tố ngắn
  candidates.sort((a, b) => b.invoiceCode.length - a.invoiceCode.length);
  for (const inv of candidates) {
    const invCompact = inv.invoiceCode.replace(/-/g, '').toUpperCase();
    if (compactTokens.has(invCompact) || compact.includes(invCompact)) {
      return inv;
    }
  }
  return null;
}

/**
 * POST /api/payments/webhook/vietqr — Webhook báo có tự động chuẩn SePay / Casso.
 * Header bắt buộc: `x-webhook-secret` khớp `config.vietqr.webhookSecret`.
 * Payload: `{ content | description, transferAmount | amount, referenceCode | transactionCode, payerStudentId? }`.
 */
async function handleVietqrWebhook(headers = {}, body = {}) {
  const incomingSecret = String(headers['x-webhook-secret'] || headers['x-api-key'] || '').trim();
  if (!incomingSecret || incomingSecret !== config.vietqr.webhookSecret) {
    fail(401, 'INVALID_WEBHOOK_SECRET', 'Webhook secret không hợp lệ');
  }

  const content = String(body.content ?? body.description ?? '').trim();
  const transferAmount = Number(body.transferAmount ?? body.amount ?? 0);
  const transactionCode = String(body.referenceCode ?? body.transactionCode ?? '').trim().toUpperCase() || null;

  if (!content) fieldErrors([{ field: 'content', message: 'Thiếu nội dung chuyển khoản' }]);
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    fail(422, 'INVALID_TRANSFER_AMOUNT', 'Số tiền chuyển khoản không hợp lệ');
  }

  // BR-10: Idempotency check — nếu cùng mã giao dịch ngân hàng đã xử lý thành công trước đó -> trả về 200 an toàn
  if (transactionCode) {
    const existingPay = await Payment.findOne({ transactionCode }).lean();
    if (existingPay) {
      const existingInv = existingPay.invoiceId ? await Invoice.findById(existingPay.invoiceId).lean() : null;
      const ctx = await loadCtx({
        roomIds: [existingInv?.roomId],
        studentIds: [existingInv?.studentId, existingPay.payerStudentId],
      });
      return {
        data: {
          alreadyProcessed: true,
          payment: paymentView(existingPay, ctx, existingInv ? new Map([[String(existingInv._id), existingInv]]) : new Map()),
          invoice: existingInv ? invoiceView(existingInv, ctx) : null,
        },
        message: 'Giao dịch đã được ghi nhận trước đó (idempotent)',
      };
    }
  }

  const inv = await findInvoiceFromTransferContent(content);
  if (!inv) {
    fail(404, 'INVOICE_NOT_FOUND_IN_CONTENT', 'Không tìm thấy mã hóa đơn hợp lệ trong nội dung chuyển khoản');
  }
  if (inv.status === 'cancelled') {
    fail(409, 'INVOICE_CANCELLED', `Hóa đơn ${inv.invoiceCode} đã bị hủy`);
  }
  if (inv.status === 'paid') {
    fail(409, 'INVOICE_ALREADY_PAID', `Hóa đơn ${inv.invoiceCode} đã được thanh toán trước đó`);
  }
  if (transferAmount < inv.amount) {
    fail(
      422,
      'INVALID_TRANSFER_AMOUNT',
      `Số tiền chuyển (${transferAmount.toLocaleString('vi-VN')}đ) nhỏ hơn giá trị hóa đơn (${inv.amount.toLocaleString('vi-VN')}đ)`
    );
  }

  const payerStudentId =
    inv.scope === 'room'
      ? await resolveRoomPayer(inv, body.payerStudentId, { allowAutoFallback: true, rawContent: content })
      : inv.studentId;

  const result = await settleInvoice(inv, {
    method: 'vietqr',
    payerStudentId,
    transactionCode,
    note: `Webhook VietQR tự động (${content})`,
    actor: null,
  });

  return {
    data: { alreadyProcessed: false, ...result },
    message: result.contractActivated
      ? 'Webhook VietQR đã gạch nợ và tự động kích hoạt hợp đồng + cấp mã QR Check-in'
      : 'Webhook VietQR đã tự động gạch nợ hóa đơn',
    status: 201,
  };
}

/**
 * POST /api/payments/webhook/simulate — Giả lập ngân hàng gọi Webhook VietQR cho demo / kiểm thử.
 * Body: `{ invoiceId, payerStudentId?, referenceCode? }`.
 */
async function simulateVietqrWebhook(body = {}, actor) {
  const inv = isObjectId(body.invoiceId) ? await Invoice.findById(body.invoiceId).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  const compactCode = inv.invoiceCode.replace(/-/g, '');
  const refCode =
    String(body.referenceCode || '').trim().toUpperCase() ||
    `SIM${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 89)}`;

  return handleVietqrWebhook(
    { 'x-webhook-secret': config.vietqr.webhookSecret },
    {
      content: `HAUI ${compactCode} SIMULATED BY ${actor?.fullName || 'OPS'}`,
      transferAmount: body.transferAmount ?? inv.amount,
      referenceCode: refCode,
      payerStudentId: body.payerStudentId,
    }
  );
}

/** Chuyển danh sách phiếu thu/chi sang DTO chuẩn */
async function paymentViews(list) {
  const invoiceIds = list.map((p) => p.invoiceId).filter(Boolean);
  const invoices = byId(invoiceIds.length ? await Invoice.find({ _id: { $in: invoiceIds } }).lean() : []);
  const contractIds = list.filter((p) => !p.invoiceId && p.contractId).map((p) => p.contractId);
  const contracts = byId(contractIds.length ? await Contract.find({ _id: { $in: contractIds } }).lean() : []);

  const roomIds = [
    ...[...invoices.values()].map((i) => i.roomId),
    ...[...contracts.values()].map((c) => c.roomId),
  ];
  const ctx = await loadCtx({ roomIds, studentIds: list.map((p) => p.payerStudentId) });

  return list.map((p) => {
    const view = paymentView(p, ctx, invoices);
    if (!view.room && p.contractId) {
      const c = contracts.get(String(p.contractId));
      if (c?.roomId) {
        view.room = roomRef(ctx.rooms.get(String(c.roomId)), ctx);
      }
    }
    return view;
  });
}

/** GET /payments?paymentType=&method=&type=&from=&to=&search=&invoiceId=&page=&limit= */
async function list(q = {}) {
  const filter = {};
  if (q.paymentType) filter.paymentType = q.paymentType;
  if (q.method) filter.method = q.method;
  if (isObjectId(q.invoiceId)) filter.invoiceId = q.invoiceId;

  let rows = await paymentViews(await Payment.find(filter).sort({ paidAt: -1 }).lean());
  if (q.type) rows = rows.filter((p) => p.invoiceType === q.type);
  if (q.from) rows = rows.filter((p) => localDate(p.paidAt) >= q.from);
  if (q.to) rows = rows.filter((p) => localDate(p.paidAt) <= q.to);
  rows = rows.filter((p) =>
    matches(q.search, [p.paymentCode, p.invoiceCode, p.transactionCode, p.payer?.fullName, p.payer?.studentCode])
  );

  const sumOf = (l) => l.reduce((t, p) => t + p.amount, 0);
  const inflows = rows.filter((p) => p.paymentType !== 'refund');
  const refunds = rows.filter((p) => p.paymentType === 'refund');
  const summary = {
    totalAmount: sumOf(inflows),
    cashAmount: sumOf(inflows.filter((p) => p.method === 'cash')),
    vietqrAmount: sumOf(inflows.filter((p) => p.method === 'vietqr')),
    refundAmount: sumOf(refunds),
    refundCount: refunds.length,
  };
  return { data: paginate(rows, q, { summary }) };
}

module.exports = {
  collectCash: (body, actor) => collect('cash', body, actor),
  confirmVietqr: (body, actor) => collect('vietqr', body, actor),
  handleVietqrWebhook,
  simulateVietqrWebhook,
  list,
  paymentViews,
};

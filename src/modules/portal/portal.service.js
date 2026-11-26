/**
 * Cổng Dịch vụ Sinh viên — API.md §9 (HaUI - DMS v3.0).
 * Danh tính LUÔN lấy từ JWT (`req.user.studentId`), không bao giờ tin query/body.
 *
 * Hỗ trợ đầy đủ:
 *   - Phòng ở hiện tại (kể cả trạng thái chờ đóng phí `pending_payment` để SV thấy hóa đơn đầu kỳ)
 *   - Đăng ký / Gia hạn KTX nội bộ cho SV năm 2+ (`POST /api/portal/applications`)
 *   - Lấy mã QR Check-in bàn giao phòng (`GET /api/portal/my-contracts/:id/checkin-qr`)
 *   - Sinh mã VietQR động kèm `qrImageUrl` chuẩn NAPAS 247 (không lộ `webhookSecret`)
 *   - Phiếu yêu cầu trực tuyến (Báo hỏng / Chuyển phòng / Trả phòng) & Chuông Thông báo In-app
 */

const Student = require('../students/student.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const UtilityReading = require('../fees/utility-reading.model');
const contractService = require('../contracts/contract.service');
const requestService = require('../requests/request.service');
const notificationService = require('../notifications/notification.service');
const fees = require('../fees/fee.service');
const payments = require('../payments/payment.service');
const config = require('../../core/config');
const { CAMPUS_INFO } = require('../../shared/constants/enums');
const { fail, paginate, isObjectId } = require('../../core/utils/http');
const { loadCtx, contractView, debtsOf, roomRef } = require('../../shared/views');

async function me(req) {
  const st = req.user.studentId ? await Student.findById(req.user.studentId).lean() : null;
  if (!st) fail(403, 'FORBIDDEN', 'Tài khoản chưa gắn với hồ sơ sinh viên');
  return st;
}

/** Hợp đồng đang hiệu lực (gồm cả quá hạn chưa thanh lý) */
const activeContract = (studentId) => Contract.findOne({ studentId, status: 'active' }).lean();

/** Hợp đồng đang giữ chỗ (`active` ưu tiên trước, nếu chưa có thì trả `pending_payment`) */
async function currentContract(studentId) {
  const active = await activeContract(studentId);
  if (active) return active;
  return Contract.findOne({ studentId, status: 'pending_payment' }).sort({ createdAt: -1 }).lean();
}

/** Điều kiện Mongo: hóa đơn sinh viên được xem (cá nhân của mình + hóa đơn phòng ĐANG ở `active`) */
async function visibleFilter(st) {
  const c = await activeContract(st._id);
  return { $or: [{ scope: 'personal', studentId: st._id }, ...(c ? [{ scope: 'room', roomId: c.roomId }] : [])] };
}

async function assertVisible(st, inv) {
  const c = await activeContract(st._id);
  const ok = inv.scope === 'personal' ? String(inv.studentId) === String(st._id) : c && String(inv.roomId) === String(c.roomId);
  if (!ok) fail(403, 'FORBIDDEN', 'Bạn không có quyền truy cập dữ liệu này');
}

async function profile(req) {
  return { data: Student.hydrate(await me(req)).toJSON() };
}

async function myResidence(req) {
  const st = await me(req);
  const [c, unreadNotifications, debts] = await Promise.all([
    currentContract(st._id),
    notificationService.countUnreadForUser(req.user.id),
    debtsOf([st._id]),
  ]);

  const unpaidInvoiceCount = await Invoice.countDocuments({
    studentId: st._id,
    scope: 'personal',
    status: 'unpaid',
  });
  const debtSummary = { totalDebt: debts.get(String(st._id)) ?? 0, unpaidInvoiceCount };

  if (!c) {
    return {
      data: {
        hasResidence: false,
        hasPendingPayment: false,
        contract: null,
        roommates: [],
        debtSummary,
        unreadNotifications,
      },
    };
  }

  const isActive = c.status === 'active';
  const mates = isActive
    ? await Contract.find({ roomId: c.roomId, status: 'active', studentId: { $ne: st._id } }).lean()
    : [];
  const ctx = await loadCtx({
    roomIds: [c.roomId],
    studentIds: [st._id, ...mates.map((m) => m.studentId)],
  });

  return {
    data: {
      hasResidence: isActive,
      hasPendingPayment: c.status === 'pending_payment',
      contract: contractView(c, ctx, debts),
      roommates: mates
        .map((m) => ctx.students.get(String(m.studentId)))
        .filter(Boolean)
        .map((s) => ({ studentCode: s.studentCode, fullName: s.fullName }))
        .sort((a, b) => a.studentCode.localeCompare(b.studentCode)),
      debtSummary,
      unreadNotifications,
    },
  };
}

/** GET /portal/my-contracts */
async function myContracts(req) {
  const st = await me(req);
  const list = await Contract.find({ studentId: st._id }).sort({ createdAt: -1 }).lean();
  const ctx = await loadCtx({ roomIds: list.map((c) => c.roomId), studentIds: [st._id] });
  const debts = await debtsOf([st._id]);
  return { data: list.map((c) => contractView(c, ctx, debts)) };
}

/** POST /portal/applications — Đăng ký / Gia hạn KTX nội bộ cho SV năm 2+ đã có tài khoản */
async function applyFromPortal(req) {
  const st = await me(req);
  return contractService.applyFromPortal(st, req.body);
}

/** GET /portal/my-contracts/:id/checkin-qr — Lấy mã QR Check-in nhận phòng khi đã kích hoạt `active` */
async function myCheckinQr(req) {
  const st = await me(req);
  const c = isObjectId(req.params.id) ? await Contract.findOne({ _id: req.params.id, studentId: st._id }).lean() : null;
  if (!c) fail(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng');
  if (c.status !== 'active' || !c.checkinCode) {
    fail(409, 'CONTRACT_NOT_ACTIVE', 'Mã QR Check-in chỉ khả dụng sau khi bạn hoàn tất đóng phí và hợp đồng được kích hoạt');
  }
  const ctx = await loadCtx({ roomIds: [c.roomId], studentIds: [st._id] });
  const room = roomRef(ctx.rooms.get(String(c.roomId)), ctx);
  const cInfo = room?.campus ? CAMPUS_INFO[room.campus] : null;
  return {
    data: {
      contractId: String(c._id),
      contractCode: c.contractCode,
      checkinCode: c.checkinCode,
      isCheckedIn: Boolean(c.checkedInAt),
      checkedInAt: c.checkedInAt ?? null,
      studentCode: st.studentCode,
      studentName: st.fullName,
      room,
      officeLocation: cInfo?.officeLocation ?? 'Văn phòng Trung tâm KTX HaUI',
    },
  };
}

/** GET /portal/my-invoices?scope=&status=&page=&limit= */
async function myInvoices(req) {
  const st = await me(req);
  const q = req.query;
  const filter = await visibleFilter(st);
  if (q.scope) filter.scope = q.scope;
  if (q.status) filter.status = q.status;
  const rank = { unpaid: 0, paid: 1, cancelled: 2 };
  const rows = (await fees.invoiceViews(await Invoice.find(filter).lean())).sort(
    (x, y) => (rank[x.status] ?? 9) - (rank[y.status] ?? 9) || new Date(y.createdAt) - new Date(x.createdAt)
  );
  return { data: paginate(rows, { limit: 100, ...q }) };
}

async function myInvoice(req) {
  const st = await me(req);
  const inv = isObjectId(req.params.id) ? await Invoice.findById(req.params.id).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  await assertVisible(st, inv);
  return fees.getInvoice(req.params.id);
}

/** GET /portal/my-invoices/:id/vietqr — Sinh mã VietQR động chuẩn NAPAS 247 (không lộ webhookSecret!) */
async function myInvoiceVietqr(req) {
  const st = await me(req);
  const inv = isObjectId(req.params.id) ? await Invoice.findById(req.params.id).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  await assertVisible(st, inv);
  if (inv.status === 'cancelled') fail(409, 'INVOICE_CANCELLED', `Hóa đơn ${inv.invoiceCode} đã bị hủy`);
  if (inv.status === 'paid') fail(409, 'INVOICE_ALREADY_PAID', `Hóa đơn ${inv.invoiceCode} đã được thanh toán`);

  const code = inv.invoiceCode.replace(/-/g, '');
  const ctx = await loadCtx({ roomIds: [inv.roomId] });
  const room = ctx.rooms.get(String(inv.roomId));
  const { bankBin, bankName, accountNumber, accountName } = config.vietqr;
  const transferContent =
    inv.scope === 'room'
      ? `HAUI ${code} P${room?.roomNumber ?? ''} ${st.studentCode}`
      : `HAUI ${code} ${st.studentCode}`;
  const qrImageUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${inv.amount}&addInfo=${encodeURIComponent(
    transferContent
  )}&accountName=${encodeURIComponent(accountName)}`;

  return {
    data: {
      bankBin,
      bankName,
      accountNumber,
      accountName,
      amount: inv.amount,
      invoiceCode: inv.invoiceCode,
      transferContent,
      qrImageUrl,
      sandboxEnabled: process.env.NODE_ENV !== 'production' || process.env.ALLOW_VIETQR_SIMULATE === 'true',
    },
  };
}

/** POST /portal/my-invoices/:id/simulate-vietqr — Môi trường Test/Sandbox VietQR cho SV bấm giả lập chuyển khoản (đi qua đúng Webhook thật!) */
async function simulateMyInvoiceVietqr(req) {
  const enabled = process.env.NODE_ENV !== 'production' || process.env.ALLOW_VIETQR_SIMULATE === 'true';
  if (!enabled) {
    fail(403, 'SANDBOX_DISABLED', 'Chế độ giả lập thanh toán VietQR chỉ khả dụng trong môi trường thử nghiệm');
  }
  const st = await me(req);
  const inv = isObjectId(req.params.id) ? await Invoice.findById(req.params.id).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  await assertVisible(st, inv);
  if (inv.status === 'cancelled') fail(409, 'INVOICE_CANCELLED', `Hóa đơn ${inv.invoiceCode} đã bị hủy`);
  if (inv.status === 'paid') fail(409, 'INVOICE_ALREADY_PAID', `Hóa đơn ${inv.invoiceCode} đã được thanh toán`);

  return payments.simulateVietqrWebhook(
    { invoiceId: String(inv._id), payerStudentId: String(st._id) },
    { fullName: `${st.fullName} (Sandbox SV)` }
  );
}

/** GET /portal/my-payments — gồm cả phiếu thu hóa đơn lẫn phiếu chi hoàn cọc của SV */
async function myPayments(req) {
  const st = await me(req);
  const visible = await Invoice.find(await visibleFilter(st)).select('_id').lean();
  const list = await Payment.find({
    $or: [{ invoiceId: { $in: visible.map((i) => i._id) } }, { paymentType: 'refund', payerStudentId: st._id }],
  })
    .sort({ paidAt: -1 })
    .lean();
  return { data: paginate(await payments.paymentViews(list), { limit: 100, ...req.query }) };
}

/** GET /portal/my-room/utility-history?limit=12 */
async function myRoomUtilityHistory(req) {
  const st = await me(req);
  const c = await activeContract(st._id);
  if (!c) return { data: [] };
  const list = await UtilityReading.find({ roomId: c.roomId, isBilled: true })
    .sort({ monthYear: -1 })
    .limit(Math.min(Number(req.query.limit) || 12, 24))
    .lean();
  return { data: list.map(fees.readingView) };
}

// ================================================================ Phiếu Yêu cầu & Thông báo

async function myRequests(req) {
  const st = await me(req);
  return requestService.listByStudent(st._id, req.query);
}

async function createRequest(req) {
  const st = await me(req);
  return requestService.createByStudent(st, req.body);
}

async function cancelRequest(req) {
  const st = await me(req);
  return requestService.cancelByStudent(st._id, req.params.id);
}

async function myNotifications(req) {
  return notificationService.listForUser(req.user.id, req.query);
}

async function markNotificationRead(req) {
  return notificationService.markRead(req.user.id, req.params.id);
}

async function markAllNotificationsRead(req) {
  return notificationService.markAllRead(req.user.id);
}

module.exports = {
  profile,
  myResidence,
  myContracts,
  applyFromPortal,
  myCheckinQr,
  myInvoices,
  myInvoice,
  myInvoiceVietqr,
  simulateMyInvoiceVietqr,
  myPayments,
  myRoomUtilityHistory,
  myRequests,
  createRequest,
  cancelRequest,
  myNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};

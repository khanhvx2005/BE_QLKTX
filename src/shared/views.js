/**
 * Dạng dữ liệu TRẢ RA cho FE — một nơi duy nhất, khớp `docs/API.md` (repo FE) §1.5, §6, §8.
 * Service lấy tài liệu bằng `.lean()` rồi gọi các hàm ở đây; KHÔNG trả document populate thô
 * (FE đọc `contract.student.fullName`, `invoice.room.buildingCode`, không đọc `studentId.fullName`).
 *
 * Ngữ cảnh `ctx` gom sẵn các bảng tra (Map theo id chuỗi) để không truy vấn lặp trong vòng lặp:
 *   { rooms, buildings, students, contracts, invoices, readings }
 */

const mongoose = require('mongoose');
const Room = require('../modules/rooms/room.model');
const Building = require('../modules/rooms/building.model');
const Student = require('../modules/students/student.model');
const Contract = require('../modules/contracts/contract.model');
const Invoice = require('../modules/fees/invoice.model');
const { localDate } = require('../core/utils/dates');

const idOf = (v) => (v == null ? null : String(v._id ?? v));
const byId = (list) => new Map(list.map((x) => [String(x._id), x]));
const uniq = (list) => [...new Set(list.filter(Boolean).map(String))];

/** Tải các bảng tra theo id cần dùng. Phòng luôn kéo theo tòa. */
async function loadCtx({ roomIds = [], studentIds = [] } = {}) {
  const rooms = await Room.find({ _id: { $in: uniq(roomIds) } }).lean();
  const buildings = await Building.find({ _id: { $in: uniq(rooms.map((r) => r.buildingId)) } }).lean();
  const students = await Student.find({ _id: { $in: uniq(studentIds) } }).lean();
  return { rooms: byId(rooms), buildings: byId(buildings), students: byId(students) };
}

// ---------------------------------------------------------------- tham chiếu
const studentRef = (st) => (st ? { id: idOf(st), studentCode: st.studentCode, fullName: st.fullName, gender: st.gender } : null);
const payerRef = (st) => (st ? { id: idOf(st), studentCode: st.studentCode, fullName: st.fullName } : null);

const roomRef = (room, ctx) => {
  if (!room) return null;
  const b = ctx.buildings.get(String(room.buildingId));
  return {
    id: idOf(room), buildingId: idOf(room.buildingId), buildingCode: b?.code ?? null, buildingName: b?.name ?? null,
    roomNumber: room.roomNumber, floor: room.floor, gender: room.gender, capacity: room.capacity,
  };
};

/** Nhãn phòng ngắn "K1-302" (khớp roomLabelOf của FE) */
const roomLabel = (ref) => (ref ? `${ref.buildingCode}-${ref.roomNumber}` : '');

// ---------------------------------------------------------------- hợp đồng
/** API.md §6: `expired` = active và đã qua endDate — suy ra lúc đọc */
const contractStatusOf = (c) => (c.status === 'active' && c.endDate && c.endDate < localDate() ? 'expired' : c.status);

/**
 * Contract của API.md §6. `debts` (Map studentId → nợ cá nhân) tùy chọn — có thì kèm `totalDebt`.
 */
const contractView = (c, ctx, debts = null) => {
  const room = ctx.rooms.get(String(c.roomId));
  const st = ctx.students.get(String(c.studentId));
  const rr = roomRef(room, ctx);
  return {
    id: idOf(c),
    contractCode: c.contractCode,
    status: contractStatusOf(c),
    student: studentRef(st),
    studentId: idOf(c.studentId),
    studentCode: st?.studentCode ?? null,
    studentName: st?.fullName ?? null,
    room: rr,
    roomId: idOf(c.roomId),
    roomNumber: room?.roomNumber ?? null,
    buildingId: rr?.buildingId ?? null,
    buildingCode: rr?.buildingCode ?? null,
    buildingName: rr?.buildingName ?? null,
    bedNumber: c.bedNumber,
    term: c.term,
    pricePerMonth: c.pricePerMonth,
    totalRoomFee: c.totalRoomFee,
    depositAmount: c.depositAmount,
    startDate: c.startDate,
    endDate: c.endDate,
    createdAt: c.createdAt,
    reviewedAt: c.reviewedAt,
    approvedByName: c.reviewedByName,
    rejectionReason: c.rejectionReason,
    terminatedAt: c.terminatedAt,
    isDepositRefunded: !!c.isDepositRefunded,
    depositRefundedAt: c.depositRefundedAt,
    depositRefundedByName: c.depositRefundedByName,
    ...(debts ? { totalDebt: debts.get(String(c.studentId)) ?? 0 } : {}),
  };
};

// ---------------------------------------------------------------- hóa đơn, phiếu thu
const invoiceView = (inv, ctx) => ({
  id: idOf(inv),
  invoiceCode: inv.invoiceCode,
  type: inv.type,
  scope: inv.scope,
  amount: inv.amount,
  description: inv.description,
  createdAt: inv.createdAt,
  dueDate: inv.dueDate,
  status: inv.status,
  paidAt: inv.paidAt,
  student: inv.scope === 'personal' ? studentRef(ctx.students.get(String(inv.studentId))) : null,
  room: roomRef(ctx.rooms.get(String(inv.roomId)), ctx),
  contractId: idOf(inv.contractId),
  utilityReadingId: idOf(inv.utilityReadingId),
  monthYear: inv.monthYear,
  payer: inv.payerStudentId ? payerRef(ctx.students.get(String(inv.payerStudentId))) : null,
});

/** `invoices` là Map id → hóa đơn (lean) của các phiếu cần hiện */
const paymentView = (p, ctx, invoices) => {
  const inv = invoices.get(String(p.invoiceId));
  return {
    id: idOf(p),
    paymentCode: p.paymentCode,
    invoiceId: idOf(p.invoiceId),
    invoiceCode: inv?.invoiceCode ?? null,
    invoiceType: inv?.type ?? null,
    amount: p.amount,
    method: p.method,
    transactionCode: p.transactionCode,
    note: p.note,
    paidAt: p.paidAt,
    collectedByName: p.collectedByName,
    payer: payerRef(ctx.students.get(String(p.payerStudentId))),
    room: roomRef(ctx.rooms.get(String(inv?.roomId)), ctx),
  };
};

// ---------------------------------------------------------------- công nợ, người ở
/** Nợ cá nhân = hóa đơn personal chưa trả. Điện nước thuộc cả phòng, không cộng vào nợ riêng ai */
async function debtsOf(studentIds) {
  const rows = await Invoice.aggregate([
    { $match: { studentId: { $in: uniq(studentIds).map((id) => new mongoose.Types.ObjectId(id)) }, status: 'unpaid', scope: 'personal' } },
    { $group: { _id: '$studentId', total: { $sum: '$amount' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.total]));
}

/**
 * Người đang ở phòng = hợp đồng còn giữ giường (status lưu `active`, gồm cả quá hạn chưa thanh lý), xếp theo MSSV.
 * Trả [{ contract, student }].
 */
async function residentsOf(roomId) {
  const list = await Contract.find({ roomId, status: 'active' }).lean();
  const students = byId(await Student.find({ _id: { $in: list.map((c) => c.studentId) } }).lean());
  return list
    .map((c) => ({ contract: c, student: students.get(String(c.studentId)) }))
    .filter((x) => x.student)
    .sort((a, b) => a.student.studentCode.localeCompare(b.student.studentCode));
}

module.exports = {
  idOf, byId, uniq, loadCtx,
  studentRef, payerRef, roomRef, roomLabel,
  contractStatusOf, contractView, invoiceView, paymentView,
  debtsOf, residentsOf,
};

/**
 * Bộ chuẩn hóa dữ liệu TRẢ RA cho Frontend (HaUI - DMS v3.0).
 * Gom bảng tra theo lô (`loadCtx`) chống N+1 query và giữ DTO thống nhất giữa tất cả phân hệ.
 */

const mongoose = require('mongoose');
const Room = require('../modules/rooms/room.model');
const Building = require('../modules/rooms/building.model');
const Student = require('../modules/students/student.model');
const Contract = require('../modules/contracts/contract.model');
const Invoice = require('../modules/fees/invoice.model');
const { CAMPUS_INFO } = require('./constants/enums');
const { localDate } = require('../core/utils/dates');

const idOf = (v) => (v == null ? null : String(v._id ?? v));
const byId = (list) => new Map(list.map((x) => [String(x._id), x]));
const uniq = (list) => [...new Set(list.filter(Boolean).map(String))];

async function loadCtx({ roomIds = [], studentIds = [] } = {}) {
  const rooms = await Room.find({ _id: { $in: uniq(roomIds) } }).lean();
  const buildings = await Building.find({ _id: { $in: uniq(rooms.map((r) => r.buildingId)) } }).lean();
  const students = await Student.find({ _id: { $in: uniq(studentIds) } }).lean();
  return { rooms: byId(rooms), buildings: byId(buildings), students: byId(students) };
}

const studentRef = (st) =>
  st
    ? {
        id: idOf(st),
        studentCode: st.studentCode,
        fullName: st.fullName,
        gender: st.gender,
        faculty: st.faculty ?? '',
        priorityType: st.priorityType ?? 'normal',
        hasHealthCondition: Boolean(st.hasHealthCondition),
      }
    : null;

const payerRef = (st) => (st ? { id: idOf(st), studentCode: st.studentCode, fullName: st.fullName } : null);

const roomRef = (room, ctx) => {
  if (!room) return null;
  const b = ctx.buildings.get(String(room.buildingId));
  const cInfo = b?.campus ? CAMPUS_INFO[b.campus] : null;
  return {
    id: idOf(room),
    campus: b?.campus ?? null,
    campusName: cInfo?.name ?? null,
    buildingId: idOf(room.buildingId),
    buildingCode: b?.code ?? null,
    buildingName: b?.name ?? null,
    roomNumber: room.roomNumber,
    floor: room.floor,
    gender: room.gender,
    roomTier: room.roomTier || 'standard',
    capacity: room.capacity,
    pricePerMonth: room.pricePerMonth ?? null,
    depositAmount: room.depositAmount ?? null,
    hasAirConditioner: Boolean(room.hasAirConditioner),
  };
};

const roomLabel = (ref) => (ref ? `${ref.buildingCode}-${ref.roomNumber}` : '');

/** `expired` = active và đã qua endDate — suy ra lúc đọc */
const contractStatusOf = (c) => (c.status === 'active' && c.endDate && c.endDate < localDate() ? 'expired' : c.status);

const contractView = (c, ctx, debts = null) => {
  const room = c.roomId ? ctx.rooms.get(String(c.roomId)) : null;
  const st = ctx.students.get(String(c.studentId));
  const rr = roomRef(room, ctx);
  const effectiveCampus = rr?.campus ?? (c.campus && c.campus !== 'all' ? c.campus : null);
  const effectiveCampusName = rr?.campusName ?? (effectiveCampus ? CAMPUS_INFO[effectiveCampus]?.name ?? null : null);
  const todayStr = localDate();
  return {
    id: idOf(c),
    contractCode: c.contractCode,
    periodId: idOf(c.periodId),
    status: contractStatusOf(c),
    student: studentRef(st),
    studentId: idOf(c.studentId),
    studentCode: st?.studentCode ?? null,
    studentName: st?.fullName ?? null,
    room: rr,
    campus: effectiveCampus,
    campusName: effectiveCampusName,
    preferredRoomTier: c.preferredRoomTier ?? null,
    preferredCapacity: c.preferredCapacity ?? null,
    roomId: idOf(c.roomId),
    roomNumber: room?.roomNumber ?? null,
    buildingId: rr?.buildingId ?? null,
    buildingCode: rr?.buildingCode ?? null,
    buildingName: rr?.buildingName ?? null,
    term: c.term,
    pricePerMonth: c.pricePerMonth,
    totalRoomFee: c.totalRoomFee,
    depositAmount: c.depositAmount,
    paymentDeadline: c.paymentDeadline ?? null,
    isPaymentOverdue: Boolean(c.status === 'pending_payment' && c.paymentDeadline && c.paymentDeadline < todayStr),
    startDate: c.startDate ?? null,
    endDate: c.endDate ?? null,
    checkinCode: c.checkinCode ?? null,
    checkedInAt: c.checkedInAt ?? null,
    checkedInByName: c.checkedInByName ?? null,
    createdAt: c.createdAt,
    reviewedAt: c.reviewedAt ?? null,
    approvedByName: c.reviewedByName ?? null,
    rejectionReason: c.rejectionReason ?? null,
    cancelReason: c.cancelReason ?? null,
    terminatedAt: c.terminatedAt ?? null,
    isDepositRefunded: Boolean(c.isDepositRefunded),
    depositDeductionAmount: c.depositDeductionAmount ?? 0,
    depositRefundAmount: c.depositRefundAmount ?? 0,
    depositRefundReason: c.depositRefundReason ?? null,
    depositRefundedAt: c.depositRefundedAt ?? null,
    depositRefundedByName: c.depositRefundedByName ?? null,
    ...(debts ? { totalDebt: debts.get(String(c.studentId)) ?? 0 } : {}),
  };
};

const invoiceView = (inv, ctx) => ({
  id: idOf(inv),
  invoiceCode: inv.invoiceCode,
  type: inv.type,
  scope: inv.scope,
  amount: inv.amount,
  roomFeeAmount: inv.roomFeeAmount ?? null,
  depositAmount: inv.depositAmount ?? null,
  description: inv.description,
  createdAt: inv.createdAt,
  dueDate: inv.dueDate,
  status: inv.status,
  paidAt: inv.paidAt ?? null,
  student: inv.scope === 'personal' ? studentRef(ctx.students.get(String(inv.studentId))) : null,
  room: roomRef(ctx.rooms.get(String(inv.roomId)), ctx),
  contractId: idOf(inv.contractId),
  utilityReadingId: idOf(inv.utilityReadingId),
  monthYear: inv.monthYear ?? null,
  payer: inv.payerStudentId ? payerRef(ctx.students.get(String(inv.payerStudentId))) : null,
});

const paymentView = (p, ctx, invoices, contracts = null) => {
  const inv = p.invoiceId ? invoices.get(String(p.invoiceId)) : null;
  const contract = p.contractId && contracts ? contracts.get(String(p.contractId)) : null;
  return {
    id: idOf(p),
    paymentCode: p.paymentCode,
    paymentType: p.paymentType || 'payment',
    invoiceId: idOf(p.invoiceId),
    contractId: idOf(p.contractId),
    contractCode: contract?.contractCode ?? null,
    invoiceCode: inv?.invoiceCode ?? null,
    invoiceType: inv?.type ?? null,
    amount: p.amount,
    depositAmount: p.paymentType === 'refund' ? (contract?.depositAmount ?? null) : null,
    depositDeductionAmount: p.paymentType === 'refund' ? (contract?.depositDeductionAmount ?? 0) : null,
    depositRefundReason: p.paymentType === 'refund' ? (contract?.depositRefundReason ?? null) : null,
    method: p.method,
    transactionCode: p.transactionCode ?? null,
    note: p.note ?? '',
    paidAt: p.paidAt,
    collectedByName: p.collectedByName ?? null,
    payer: payerRef(ctx.students.get(String(p.payerStudentId))),
    room: roomRef(ctx.rooms.get(String(inv?.roomId ?? contract?.roomId)), ctx),
  };
};

async function debtsOf(studentIds) {
  const ids = uniq(studentIds);
  if (!ids.length) return new Map();
  const rows = await Invoice.aggregate([
    {
      $match: {
        studentId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
        status: 'unpaid',
        scope: 'personal',
      },
    },
    { $group: { _id: '$studentId', total: { $sum: '$amount' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.total]));
}

/** Danh sách SV đang có hợp đồng `active` tại phòng; truyền `{ checkedInOnly: true }` để chỉ lấy người đã Check-in (3A) */
async function residentsOf(roomId, { checkedInOnly = false } = {}) {
  const filter = { roomId, status: 'active' };
  if (checkedInOnly) filter.checkedInAt = { $ne: null };
  const list = await Contract.find(filter).lean();
  const students = byId(await Student.find({ _id: { $in: list.map((c) => c.studentId) } }).lean());
  return list
    .map((c) => ({ contract: c, student: students.get(String(c.studentId)) }))
    .filter((x) => x.student)
    .sort((a, b) => a.student.studentCode.localeCompare(b.student.studentCode));
}

/** Mốc tháng (YYYY-MM) bắt đầu tính trách nhiệm điện nước của hợp đồng (chỉ tính từ tháng Check-in) */
const utilityStartMonthOf = (c) => {
  if (!c || c.status !== 'active' || !c.checkedInAt) return null;
  return localDate(c.checkedInAt).slice(0, 7);
};

/** Điều kiện Mongo lọc các hóa đơn điện nước phòng mà hợp đồng phải gánh trách nhiệm (không gánh tháng trước khi vào ở) */
const roomUtilityFilterForContract = (c) => {
  const fromMonth = utilityStartMonthOf(c);
  if (!fromMonth || !c?.roomId) return null;
  return {
    type: 'utility',
    scope: 'room',
    roomId: c.roomId,
    $or: [{ monthYear: null }, { monthYear: { $gte: fromMonth } }],
  };
};

module.exports = {
  idOf,
  byId,
  uniq,
  loadCtx,
  studentRef,
  payerRef,
  roomRef,
  roomLabel,
  contractStatusOf,
  contractView,
  invoiceView,
  paymentView,
  debtsOf,
  residentsOf,
  utilityStartMonthOf,
  roomUtilityFilterForContract,
};

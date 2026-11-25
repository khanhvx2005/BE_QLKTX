/**
 * Dashboard & Báo cáo Thống kê 3 Cơ sở HaUI (API.md §10, FR-70→71).
 *   - Quản lý sức chứa cấp Phòng (`capacity` & `occupiedCount`):
 *     `total = occupied + available + maintenance` (chỗ trống trong phòng bảo trì tính vào `maintenance`).
 *   - Doanh thu (`/revenue`): CHỈ `manager`, gom theo tháng Việt Nam (`UTC+7`),
 *     loại trừ hoàn toàn tiền cọc (`deposit`), hóa đơn `cancelled` và phiếu chi hoàn cọc (`paymentType === 'refund'`).
 */

const Building = require('../rooms/building.model');
const Room = require('../rooms/room.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const Request = require('../requests/request.model');
const { CAMPUSES, CAMPUS_INFO } = require('../../shared/constants/enums');
const { localMonth, today } = require('../../core/utils/dates');
const { byId } = require('../../shared/views');

const countSlots = (rooms) => {
  let occupied = 0;
  let available = 0;
  let maintenance = 0;
  for (const r of rooms) {
    const cap = Number(r.capacity) || 0;
    const occ = Math.min(Number(r.occupiedCount) || 0, cap);
    const rem = Math.max(0, cap - occ);
    occupied += occ;
    if (r.status === 'maintenance') maintenance += rem;
    else available += rem;
  }
  const total = occupied + available + maintenance;
  const occupancyRate = total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0;
  return { total, occupied, available, maintenance, occupancyRate };
};

async function activeRooms(campus) {
  const filter = { isActive: true };
  if (campus && CAMPUSES.includes(campus)) filter.campus = campus;
  const buildings = await Building.find(filter).sort({ campus: 1, code: 1 }).lean();
  const rooms = await Room.find({ buildingId: { $in: buildings.map((b) => b._id) } }).lean();
  return { buildings, rooms };
}

/** GET /dashboard/summary?campus=cs1|cs2|cs3 */
async function summary(q = {}) {
  const campus = CAMPUSES.includes(q.campus) ? q.campus : null;
  const { rooms } = await activeRooms(campus);
  const roomIds = rooms.map((r) => r._id);
  const slotStats = countSlots(rooms);

  const contractScope = campus ? { $or: [{ roomId: { $in: roomIds } }, { campus }] } : {};
  const invoiceScope = campus ? { roomId: { $in: roomIds } } : {};
  const requestScope = campus ? { roomId: { $in: roomIds } } : {};

  const debtOf = async (type) =>
    (
      await Invoice.aggregate([
        { $match: { ...invoiceScope, type, status: 'unpaid' } },
        { $group: { _id: null, t: { $sum: '$amount' } } },
      ])
    )[0]?.t ?? 0;

  const [
    roomDebt,
    utilityDebt,
    activeStudents,
    pendingApplications,
    pendingPaymentContracts,
    overduePaymentContracts,
    pendingRequests,
  ] = await Promise.all([
    debtOf('room_semester'),
    debtOf('utility'),
    Contract.countDocuments({ ...contractScope, status: 'active' }),
    Contract.countDocuments({ ...contractScope, status: 'pending' }),
    Contract.countDocuments({ ...contractScope, status: 'pending_payment' }),
    Contract.countDocuments({ ...contractScope, status: 'pending_payment', paymentDeadline: { $lt: today() } }),
    Request.countDocuments({ ...requestScope, status: { $in: ['pending', 'in_progress'] } }),
  ]);

  return {
    data: {
      campus: campus || 'all',
      occupancy: {
        ...slotStats,
        totalRooms: rooms.length,
        activeRooms: rooms.filter((r) => r.status === 'active').length,
        maintenanceRooms: rooms.filter((r) => r.status === 'maintenance').length,
      },
      activeStudents,
      pendingApplications,
      pendingPaymentContracts,
      overduePaymentContracts,
      pendingRequests,
      finance: {
        totalDebt: roomDebt + utilityDebt,
        roomDebt,
        utilityDebt,
      },
    },
  };
}

/** GET /dashboard/occupancy?campus=cs1|cs2|cs3 — chi tiết từng tòa và gom nhóm 3 cơ sở */
async function occupancy(q = {}) {
  const campusFilter = CAMPUSES.includes(q.campus) ? q.campus : null;
  const { buildings, rooms } = await activeRooms(campusFilter);

  const buildingRows = buildings.map((b) => {
    const own = rooms.filter((r) => String(r.buildingId) === String(b._id));
    const stats = countSlots(own);
    return {
      buildingId: String(b._id),
      campus: b.campus,
      campusName: CAMPUS_INFO[b.campus]?.name ?? b.campus,
      buildingCode: b.code,
      buildingName: b.name,
      totalRooms: own.length,
      totalCapacity: stats.total,
      ...stats,
    };
  });

  const targetCampuses = campusFilter ? [campusFilter] : CAMPUSES;
  const byCampus = targetCampuses.map((c) => {
    const bList = buildings.filter((b) => b.campus === c);
    const bIds = new Set(bList.map((b) => String(b._id)));
    const rList = rooms.filter((r) => bIds.has(String(r.buildingId)));
    const stats = countSlots(rList);
    return {
      campus: c,
      campusName: CAMPUS_INFO[c]?.name ?? c,
      campusAddress: CAMPUS_INFO[c]?.address ?? '',
      totalBuildings: bList.length,
      totalRooms: rList.length,
      totalCapacity: stats.total,
      ...stats,
    };
  });

  return {
    data: {
      byCampus,
      buildings: buildingRows,
    },
  };
}

/** GET /dashboard/revenue?year=2026&campus= — CHỈ Manager! Tách tiền cọc & phiếu chi hoàn cọc */
async function revenue(q = {}) {
  const year = String(q.year || localMonth().slice(0, 4));
  const campusFilter = CAMPUSES.includes(q.campus) ? q.campus : null;

  const list = await Payment.find({ paymentType: { $ne: 'refund' } }).lean();
  const invoiceIds = list.map((p) => p.invoiceId).filter(Boolean);
  const invoices = byId(
    invoiceIds.length
      ? await Invoice.find({ _id: { $in: invoiceIds } }).select('type status roomId').lean()
      : []
  );

  let allowedRoomIds = null;
  if (campusFilter) {
    const { rooms } = await activeRooms(campusFilter);
    allowedRoomIds = new Set(rooms.map((r) => String(r._id)));
  }

  const byMonth = {};
  for (const p of list) {
    const inv = p.invoiceId ? invoices.get(String(p.invoiceId)) : null;
    const month = localMonth(p.paidAt);
    if (!inv || inv.type === 'deposit' || inv.status === 'cancelled' || !month.startsWith(year)) continue;
    if (allowedRoomIds && !allowedRoomIds.has(String(inv.roomId))) continue;
    const row = byMonth[month] ?? (byMonth[month] = { month, roomRevenue: 0, utilityRevenue: 0, total: 0 });
    if (inv.type === 'room_semester') row.roomRevenue += p.amount;
    else row.utilityRevenue += p.amount;
    row.total += p.amount;
  }

  return {
    data: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

module.exports = { summary, occupancy, revenue };

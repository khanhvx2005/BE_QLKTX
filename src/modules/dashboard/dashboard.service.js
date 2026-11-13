/**
 * Dashboard — API.md §10 (FR-70→72).
 *   summary: KPI. total = occupied + available + maintenance; chỉ tòa đang hoạt động; nợ KHÔNG tính tiền cọc.
 *   occupancy: theo tòa đang hoạt động.
 *   revenue: chỉ Admin; gom theo tháng (giờ Việt Nam) của lúc thu; không tính tiền cọc (sẽ hoàn khi trả phòng).
 * Giường trong phòng đang bảo trì mà còn trống thì tính là bảo trì (không xếp được, FR-25).
 */

const Building = require('../rooms/building.model');
const Room = require('../rooms/room.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const { localMonth } = require('../../core/utils/dates');
const { byId } = require('../../shared/views');

const statOf = (bed, room) => {
  if (bed.status === 'occupied') return 'occupied';
  return room.status === 'maintenance' ? 'maintenance' : bed.status;
};

const countBeds = (rooms) => {
  const out = { occupied: 0, available: 0, maintenance: 0 };
  rooms.forEach((r) => (r.beds || []).forEach((b) => { out[statOf(b, r)] += 1; }));
  return out;
};

async function activeRooms() {
  const buildings = await Building.find({ isActive: true }).sort({ code: 1 }).lean();
  const rooms = await Room.find({ buildingId: { $in: buildings.map((b) => b._id) } }).lean();
  return { buildings, rooms };
}

async function summary() {
  const { rooms } = await activeRooms();
  const counts = countBeds(rooms);
  const debt = async (type) => (await Invoice.aggregate([
    { $match: { type, status: 'unpaid' } }, { $group: { _id: null, t: { $sum: '$amount' } } },
  ]))[0]?.t ?? 0;
  const roomDebt = await debt('room_semester');
  const utilityDebt = await debt('utility');
  return {
    data: {
      occupancy: { total: counts.occupied + counts.available + counts.maintenance, ...counts },
      // Đang nội trú = hợp đồng còn giữ giường (gồm cả quá hạn chưa thanh lý)
      activeStudents: await Contract.countDocuments({ status: 'active' }),
      pendingApplications: await Contract.countDocuments({ status: 'pending' }),
      finance: { totalDebt: roomDebt + utilityDebt, roomDebt, utilityDebt },
    },
  };
}

async function occupancy() {
  const { buildings, rooms } = await activeRooms();
  return {
    data: buildings.map((b) => {
      const own = rooms.filter((r) => String(r.buildingId) === String(b._id));
      return {
        buildingId: String(b._id), buildingCode: b.code, buildingName: b.name,
        totalRooms: own.length, totalBeds: own.reduce((t, r) => t + (r.beds || []).length, 0), ...countBeds(own),
      };
    }),
  };
}

/** GET /dashboard/revenue ?year= — mỗi tháng có thu tiền một dòng, cũ trước */
async function revenue(q = {}) {
  const year = String(q.year || localMonth().slice(0, 4));
  const list = await Payment.find().lean();
  const invoices = byId(await Invoice.find({ _id: { $in: list.map((p) => p.invoiceId) } }).select('type').lean());
  const byMonth = {};
  list.forEach((p) => {
    const inv = invoices.get(String(p.invoiceId));
    const month = localMonth(p.paidAt);
    if (!inv || inv.type === 'deposit' || !month.startsWith(year)) return;
    const row = byMonth[month] ?? (byMonth[month] = { month, roomRevenue: 0, utilityRevenue: 0, total: 0 });
    if (inv.type === 'room_semester') row.roomRevenue += p.amount;
    else row.utilityRevenue += p.amount;
    row.total += p.amount;
  });
  return { data: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)) };
}

module.exports = { summary, occupancy, revenue };

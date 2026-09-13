/**
 * Service xử lý thống kê tổng quan cho Module Dashboard.
 * Cung cấp:
 * 1. Tỷ lệ lấp đầy phòng/giường toàn hệ thống và theo từng tòa nhà (API.md §11).
 * 2. Báo cáo tổng hợp Vận hành: Công nợ, Doanh thu, Hóa đơn quá hạn, Hàng đợi xử lý của nhân viên.
 * 3. Biểu đồ doanh thu theo tháng phục vụ báo cáo tài chính.
 * Tuân thủ theo API.md §11 và ARCHITECTURE.md §3.3.
 */

const Building = require('../rooms/building.model');
const Room = require('../rooms/room.model');
const Bed = require('../rooms/bed.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const Request = require('../requests/request.model');

/**
 * Thống kê tỷ lệ lấp đầy giường KTX toàn hệ thống và theo từng tòa nhà (API.md §11 GET /api/dashboard/occupancy).
 * Ràng buộc chuẩn: total = occupied + available + maintenance.
 */
const getOccupancyStats = async () => {
  // 1. Thống kê toàn bộ giường hệ thống
  const bedStats = await Bed.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const statusMap = {
    occupied: 0,
    available: 0,
    maintenance: 0,
  };

  bedStats.forEach((stat) => {
    if (statusMap[stat._id] !== undefined) {
      statusMap[stat._id] = stat.count;
    }
  });

  const totalBeds = statusMap.occupied + statusMap.available + statusMap.maintenance;
  const overallRate = totalBeds > 0 ? Number((statusMap.occupied / totalBeds).toFixed(2)) : 0;

  const overall = {
    total: totalBeds,
    occupied: statusMap.occupied,
    available: statusMap.available,
    maintenance: statusMap.maintenance,
    rate: overallRate,
  };

  // 2. Thống kê chi tiết theo từng tòa nhà
  const buildings = await Building.find({ isActive: true }).sort('code');

  const byBuilding = await Promise.all(
    buildings.map(async (building) => {
      const rooms = await Room.find({ buildingId: building._id });
      const roomIds = rooms.map((r) => r._id);

      const buildingBedStats = await Bed.aggregate([
        { $match: { roomId: { $in: roomIds } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const bMap = { occupied: 0, available: 0, maintenance: 0 };
      buildingBedStats.forEach((stat) => {
        if (bMap[stat._id] !== undefined) {
          bMap[stat._id] = stat.count;
        }
      });

      const bTotal = bMap.occupied + bMap.available + bMap.maintenance;
      const bRate = bTotal > 0 ? Number((bMap.occupied / bTotal).toFixed(2)) : 0;

      return {
        buildingId: building._id,
        buildingCode: building.code,
        buildingName: building.name,
        gender: building.gender,
        total: bTotal,
        occupied: bMap.occupied,
        available: bMap.available,
        maintenance: bMap.maintenance,
        rate: bRate,
      };
    })
  );

  return {
    overall,
    byBuilding,
  };
};

/**
 * Tổng hợp số liệu tổng quan Dashboard (API.md §11 GET /api/dashboard/summary).
 * Bao gồm lấp đầy + tài chính công nợ + hàng đợi cần xử lý của nhân viên.
 */
const getSummaryStats = async () => {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [occupancy, revenueAgg, unpaidInvoices, overdueCount, pendingRequests, expiringContracts] =
    await Promise.all([
      // 1. Tỷ lệ lấp đầy
      getOccupancyStats(),

      // 2. Tổng doanh thu thực tế đã thu vào
      Payment.aggregate([
        {
          $match: {
            status: { $in: ['completed', 'success'] },
            type: { $ne: 'refund' },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
          },
        },
      ]),

      // 3. Toàn bộ hóa đơn chưa đóng để tính tổng nợ
      Invoice.find({
        status: { $in: ['unpaid', 'partial', 'overdue'] },
      }).select('totalAmount paidAmount dueDate status'),

      // 4. Số hóa đơn quá hạn
      Invoice.countDocuments({
        status: { $in: ['unpaid', 'partial', 'overdue'] },
        dueDate: { $lt: now },
      }),

      // 5. Số yêu cầu sinh viên đang chờ xử lý
      Request.countDocuments({ status: 'pending' }),

      // 6. Số hợp đồng sắp hết hạn trong 30 ngày tới
      Contract.countDocuments({
        status: 'active',
        endDate: { $gte: now, $lte: thirtyDaysLater },
      }),
    ]);

  // Tính tổng nợ chưa thanh toán
  const totalOutstandingDebt = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)),
    0
  );

  const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

  return {
    occupancy: {
      totalBeds: occupancy.overall.total,
      occupiedBeds: occupancy.overall.occupied,
      availableBeds: occupancy.overall.available,
      maintenanceBeds: occupancy.overall.maintenance,
      occupancyRate: occupancy.overall.rate,
    },
    finance: {
      totalRevenue,
      totalOutstandingDebt,
      overdueInvoiceCount: overdueCount,
    },
    queue: {
      pendingRequests,
      expiringContracts,
    },
  };
};

/**
 * Doanh thu theo tháng phục vụ vẽ biểu đồ (Chart Analytics).
 */
const getRevenueChartData = async (months = 6) => {
  const result = await Payment.aggregate([
    {
      $match: {
        status: { $in: ['completed', 'success'] },
        type: { $ne: 'refund' },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$paidAt' },
          month: { $month: '$paidAt' },
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1,
      },
    },
  ]);

  return result.map((item) => ({
    period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
    year: item._id.year,
    month: item._id.month,
    revenue: item.totalAmount,
    transactionCount: item.count,
  }));
};

module.exports = {
  getOccupancyStats,
  getSummaryStats,
  getRevenueChartData,
};

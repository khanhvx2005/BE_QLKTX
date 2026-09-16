/**
 * Service xử lý thống kê tổng quan cho Module Dashboard.
 * Tuân thủ theo API.md §12 và 16-YEU-CAU-API-BACKEND.md 3.11.
 */

const mongoose = require('mongoose');
const Building = require('../rooms/building.model');
const Room = require('../rooms/room.model');
const Bed = require('../rooms/bed.model');
const Student = require('../students/student.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const Request = require('../requests/request.model');
const Application = require('../residencies/application.model');

/**
 * Thống kê tỷ lệ lấp đầy giường KTX toàn hệ thống và theo từng tòa nhà (API.md §12 GET /api/dashboard/occupancy).
 * Quy tắc: rate = occupied / (total - maintenance) (FR-70, BR-05).
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
  const rentableBeds = totalBeds - statusMap.maintenance;
  const overallRate = rentableBeds > 0 ? Number((statusMap.occupied / rentableBeds).toFixed(2)) : 0;

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
      const rooms = await Room.find({ buildingId: building._id, status: { $ne: 'inactive' } });
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
      const bRentable = bTotal - bMap.maintenance;
      const bRate = bRentable > 0 ? Number((bMap.occupied / bRentable).toFixed(2)) : 0;

      return {
        buildingId: building._id.toString(),
        buildingCode: building.code,
        buildingName: building.name,
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
 * Tổng hợp số liệu tổng quan Dashboard theo đúng định dạng API.md §12 (v1.2.5).
 */
const getSummaryStats = async () => {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    occupancy,
    activeStudents,
    activeContracts,
    expiringIn30Days,
    contractsByStatusAgg,
    unpaidInvoices,
    pendingRenewals,
    pendingCheckouts,
    pendingApplications,
    supplyOrdersReady,
  ] = await Promise.all([
    // 1. Tỷ lệ lấp đầy
    getOccupancyStats(),

    // 2. Sinh viên đang ở KTX (có hợp đồng active)
    Student.countDocuments({ status: 'active' }),

    // 3. Hợp đồng đang active
    Contract.countDocuments({ status: 'active' }),

    // 4. Hợp đồng sắp hết hạn trong 30 ngày (BR-29)
    Contract.countDocuments({
      status: 'active',
      endDate: { $gte: now, $lte: thirtyDaysLater },
    }),

    // 5. Thống kê hợp đồng theo trạng thái
    Contract.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),

    // 6. Toàn bộ hóa đơn chưa thanh toán
    Invoice.find({
      status: { $in: ['unpaid', 'partial', 'overdue'] },
    }).select('totalAmount paidAmount dueDate status'),

    // 7. Yêu cầu gia hạn đang chờ
    Request.countDocuments({ type: 'renewal', status: 'pending' }),

    // 8. Yêu cầu trả phòng đang chờ
    Request.countDocuments({ type: 'checkout', status: 'pending' }),

    // 9. Đơn đăng ký đang chờ duyệt
    Application.countDocuments({ status: 'pending' }),

    // 10. Đơn hàng nhu yếu phẩm sẵn sàng giao
    mongoose.models.SupplyOrder
      ? mongoose.models.SupplyOrder.countDocuments({ status: 'ready' })
      : 0,
  ]);

  // Tổng hợp hợp đồng theo trạng thái
  const contractsByStatus = { active: 0, expired: 0, terminated: 0 };
  contractsByStatusAgg.forEach((item) => {
    if (contractsByStatus[item._id] !== undefined) {
      contractsByStatus[item._id] = item.count;
    }
  });

  // Tính tổng nợ và nợ quá hạn
  let totalDebt = 0;
  let overdueInvoiceCount = 0;
  let overdueAmount = 0;

  unpaidInvoices.forEach((inv) => {
    const remaining = inv.totalAmount - (inv.paidAmount || 0);
    totalDebt += remaining;

    if (new Date(inv.dueDate) < now) {
      overdueInvoiceCount += 1;
      overdueAmount += remaining;
    }
  });

  return {
    occupancy: {
      total: occupancy.overall.total,
      occupied: occupancy.overall.occupied,
      available: occupancy.overall.available,
      maintenance: occupancy.overall.maintenance,
      rate: occupancy.overall.rate,
    },
    residents: {
      activeStudents,
      activeContracts,
      expiringIn30Days,
      contractsByStatus,
    },
    finance: {
      totalDebt,
      overdueInvoiceCount,
      overdueAmount,
    },
    pendingRequests: {
      renewal: pendingRenewals,
      checkout: pendingCheckouts,
    },
    pendingApplications,
    supplyOrdersReady,
  };
};

/**
 * Doanh thu theo tháng phục vụ vẽ biểu đồ (Chart Analytics).
 */
const getRevenueChartData = async (months = 6) => {
  const result = await Payment.aggregate([
    {
      $match: {
        status: 'success',
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

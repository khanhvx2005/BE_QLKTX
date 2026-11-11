/**
 * Service xử lý nghiệp vụ cho Module Dashboard (Báo cáo & Thống kê KTX HaUI).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.8 (FR-70 đến FR-72).
 * 
 * ============================================================================
 * [TỐI ƯU HIỆU NĂNG BẰNG REDIS - DÀNH CHO TEAM 5]:
 * - Các phép toán tổng hợp (Aggregation) trên MongoDB tốn CPU khi dữ liệu lớn.
 * - Vì vậy, các báo cáo KPI và Doanh thu được lưu đệm trong Redis với TTL 120 giây.
 * - Khi có giao dịch thanh toán hoặc duyệt đơn, hệ thống tự động xóa cache.
 * ============================================================================
 */

const Room = require('../rooms/room.model');
const Building = require('../rooms/building.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const Student = require('../students/student.model');
const cache = require('../../core/utils/cache');

/**
 * 1. Thống kê KPI tổng quan KTX HaUI (FR-70)
 */
const getSummaryKPI = async () => {
  return cache.wrap(
    'dashboard:kpi',
    async () => {
      // 1. Tổng số giường, đang ở, còn trống
      const rooms = await Room.find({ status: 'active' });
      let totalBeds = 0;
      let occupiedBeds = 0;
      let availableBeds = 0;

      rooms.forEach((r) => {
        if (Array.isArray(r.beds)) {
          r.beds.forEach((b) => {
            totalBeds += 1;
            if (b.status === 'occupied') occupiedBeds += 1;
            if (b.status === 'available') availableBeds += 1;
          });
        }
      });

      const occupancyRate = totalBeds > 0 ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0;

      // 2. Tổng sinh viên đang nội trú thực tế
      const totalActiveResidents = await Contract.countDocuments({ status: 'active' });

      // 3. Số đơn đăng ký mới đang chờ duyệt
      const pendingApplications = await Contract.countDocuments({ status: 'pending' });

      // 4. Tổng công nợ chưa thu (toàn bộ hóa đơn unpaid)
      const unpaidInvoices = await Invoice.find({ status: 'unpaid' });
      const totalUnpaidDebt = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

      return {
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate, // %
        totalActiveResidents,
        pendingApplications,
        totalUnpaidDebt, // VNĐ
      };
    },
    120 // Cache 2 phút
  );
};

/**
 * 2. Báo cáo tỷ lệ lấp đầy theo từng Tòa nhà (FR-71)
 */
const getBuildingOccupancy = async () => {
  return cache.wrap(
    'dashboard:occupancy',
    async () => {
      const buildings = await Building.find({ isActive: true }).sort('code');
      const rooms = await Room.find({ status: 'active' });

      return buildings.map((b) => {
        const buildingRooms = rooms.filter((r) => r.buildingId.toString() === b._id.toString());
        let totalBeds = 0;
        let occupiedBeds = 0;
        let availableBeds = 0;

        buildingRooms.forEach((r) => {
          if (Array.isArray(r.beds)) {
            r.beds.forEach((bed) => {
              totalBeds += 1;
              if (bed.status === 'occupied') occupiedBeds += 1;
              if (bed.status === 'available') availableBeds += 1;
            });
          }
        });

        const rate = totalBeds > 0 ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0;

        return {
          buildingId: b._id,
          buildingCode: b.code,
          buildingName: b.name,
          totalRooms: buildingRooms.length,
          totalBeds,
          occupiedBeds,
          availableBeds,
          occupancyRate: rate,
        };
      });
    },
    120 // Cache 2 phút
  );
};

/**
 * 3. Thống kê Doanh thu KTX phân tách chi tiết (FR-72)
 */
const getRevenueReport = async () => {
  return cache.wrap(
    'dashboard:revenue',
    async () => {
      // 1. Tổng tiền đã thu từ các hóa đơn đã thanh toán (paid)
      const paidInvoices = await Invoice.find({ status: 'paid' });

      let roomSemesterRevenue = 0; // Doanh thu tiền phòng trọn gói
      let depositRevenue = 0;      // Tiền cọc đang giữ
      let utilityRevenue = 0;      // Doanh thu tiền điện nước phòng

      paidInvoices.forEach((inv) => {
        if (inv.type === 'room_semester') roomSemesterRevenue += inv.amount || 0;
        if (inv.type === 'deposit') depositRevenue += inv.amount || 0;
        if (inv.type === 'utility') utilityRevenue += inv.amount || 0;
      });

      // 2. Tổng số tiền cọc đã hoàn trả cho sinh viên khi out KTX (từ payment type = 'refund')
      const refundPayments = await Payment.find({ type: 'refund', status: 'success' });
      const totalDepositRefunded = refundPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // 3. Doanh thu ròng thực tế
      const totalCollected = roomSemesterRevenue + depositRevenue + utilityRevenue;
      const netRevenue = totalCollected - totalDepositRefunded;

      return {
        roomSemesterRevenue,
        depositRevenue,
        utilityRevenue,
        totalDepositRefunded,
        totalCollected,
        netRevenue,
      };
    },
    120 // Cache 2 phút
  );
};

module.exports = {
  getSummaryKPI,
  getBuildingOccupancy,
  getRevenueReport,
};

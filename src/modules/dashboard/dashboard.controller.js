/**
 * Controller cho Module Dashboard (Thống kê & Vận hành).
 * Tiếp nhận request HTTP, gọi dashboard.service và trả về ApiResponse envelope chuẩn.
 * Tuân thủ theo API.md §11.
 */

const dashboardService = require('./dashboard.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

/**
 * Tỷ lệ lấp đầy phòng/giường toàn hệ thống và theo từng tòa.
 * GET /api/dashboard/occupancy
 */
const getOccupancy = asyncHandler(async (req, res) => {
  const result = await dashboardService.getOccupancyStats();
  return ApiResponse.success(res, result, 'Lấy thống kê lấp đầy thành công');
});

/**
 * Tổng hợp số liệu vận hành Dashboard (Lấp đầy, Doanh thu, Công nợ, Hàng đợi xử lý).
 * GET /api/dashboard/summary
 */
const getSummary = asyncHandler(async (req, res) => {
  const result = await dashboardService.getSummaryStats();
  return ApiResponse.success(res, result, 'Lấy dữ liệu tổng quan Dashboard thành công');
});

/**
 * Biểu đồ doanh thu theo thời gian.
 * GET /api/dashboard/revenue
 */
const getRevenue = asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months, 10) || 6;
  const result = await dashboardService.getRevenueChartData(months);
  return ApiResponse.success(res, result, 'Lấy dữ liệu doanh thu thành công');
});

module.exports = {
  getOccupancy,
  getSummary,
  getRevenue,
};

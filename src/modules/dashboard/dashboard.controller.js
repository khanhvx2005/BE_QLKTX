/**
 * Controller cho Module Dashboard (Báo cáo & Thống kê KTX HaUI).
 */

const dashboardService = require('./dashboard.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// 1. Thống kê KPI tổng quan (FR-70)
const getSummaryKPI = asyncHandler(async (req, res) => {
  const result = await dashboardService.getSummaryKPI();
  return ApiResponse.success(res, result, 'Lấy thống kê tổng quan KPI thành công');
});

// 2. Báo cáo lấp đầy theo tòa nhà (FR-71)
const getBuildingOccupancy = asyncHandler(async (req, res) => {
  const result = await dashboardService.getBuildingOccupancy();
  return ApiResponse.success(res, result, 'Lấy báo cáo tỷ lệ lấp đầy theo tòa nhà thành công');
});

// 3. Báo cáo doanh thu KTX (FR-72 - chỉ Admin)
const getRevenueReport = asyncHandler(async (req, res) => {
  const result = await dashboardService.getRevenueReport();
  return ApiResponse.success(res, result, 'Lấy báo cáo doanh thu tài chính thành công');
});

module.exports = {
  getSummaryKPI,
  getBuildingOccupancy,
  getRevenueReport,
};

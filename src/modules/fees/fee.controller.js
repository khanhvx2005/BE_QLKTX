/**
 * Controller cho Module Fees (Điện Nước & Hóa Đơn KTX HaUI).
 * Tiếp nhận request HTTP, gọi fee.service và trả về ApiResponse.
 */

const feeService = require('./fee.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// 1. Ghi chỉ số 1 phòng (FR-40)
const recordUtilityReading = asyncHandler(async (req, res) => {
  const result = await feeService.recordUtilityReading(req.body, req.user.id);
  return ApiResponse.success(res, result, 'Ghi chỉ số điện nước thành công');
});

// 2. Ghi chỉ số bảng lưới theo tòa nhà (Matrix Grid - FR-40)
const recordMatrixGrid = asyncHandler(async (req, res) => {
  const result = await feeService.recordMatrixGrid(req.body, req.user.id);
  return ApiResponse.success(res, result, 'Ghi nhận chỉ số bảng lưới thành công');
});

// 3. Chốt số & Phát hành hóa đơn phòng (FR-41)
const billUtilityReading = asyncHandler(async (req, res) => {
  const result = await feeService.billUtilityReading(req.params.id || req.body.readingId, req.user.id);
  return ApiResponse.success(res, result, result.message);
});

// 4. Lấy danh sách hóa đơn (FR-50)
const getInvoices = asyncHandler(async (req, res) => {
  const result = await feeService.getInvoices(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách hóa đơn thành công');
});

// 5. Xem chi tiết hóa đơn (FR-51)
const getInvoiceById = asyncHandler(async (req, res) => {
  const result = await feeService.getInvoiceById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy chi tiết hóa đơn thành công');
});

module.exports = {
  recordUtilityReading,
  recordMatrixGrid,
  billUtilityReading,
  getInvoices,
  getInvoiceById,
};

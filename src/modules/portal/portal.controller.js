/**
 * Controller cho Module Student Portal (/api/portal/*).
 * Tiếp nhận request HTTP, gọi service và trả về ApiResponse envelope chuẩn.
 */

const portalService = require('./portal.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

const getProfile = asyncHandler(async (req, res) => {
  const result = await portalService.getProfile(req.user.studentId);
  return ApiResponse.success(res, result, 'Lấy thông tin hồ sơ thành công');
});

const getMyResidence = asyncHandler(async (req, res) => {
  const result = await portalService.getMyResidence(req.user.studentId);
  return ApiResponse.success(res, result, 'Lấy thông tin chỗ ở hiện tại thành công');
});

const getMyContracts = asyncHandler(async (req, res) => {
  const result = await portalService.getMyContracts(req.user.studentId);
  return ApiResponse.success(res, result, 'Lấy danh sách hợp đồng thành công');
});

const getMyInvoices = asyncHandler(async (req, res) => {
  const result = await portalService.getMyInvoices(req.user.studentId, req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách hóa đơn thành công');
});

const getMyInvoiceById = asyncHandler(async (req, res) => {
  const result = await portalService.getMyInvoiceById(req.user.studentId, req.params.id);
  return ApiResponse.success(res, result, 'Lấy thông tin hóa đơn thành công');
});

const getMyPayments = asyncHandler(async (req, res) => {
  const result = await portalService.getMyPayments(req.user.studentId);
  return ApiResponse.success(res, result, 'Lấy lịch sử thanh toán thành công');
});

const getSupplyItems = asyncHandler(async (req, res) => {
  const result = await portalService.getSupplyItems(req.user.studentId);
  return ApiResponse.success(res, result, 'Lấy danh mục nhu yếu phẩm thành công');
});

const getMySupplyOrders = asyncHandler(async (req, res) => {
  const result = await portalService.getMySupplyOrders(req.user.studentId, req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách đơn hàng thành công');
});

const placeMySupplyOrder = asyncHandler(async (req, res) => {
  const result = await portalService.placeMySupplyOrder(req.user.studentId, req.body.items);
  return ApiResponse.success(res, result, 'Đặt hàng thành công', 201);
});

const cancelMySupplyOrder = asyncHandler(async (req, res) => {
  const result = await portalService.cancelMySupplyOrder(req.user.studentId, req.params.id);
  return ApiResponse.success(res, result, 'Hủy đơn hàng thành công');
});

module.exports = {
  getProfile,
  getMyResidence,
  getMyContracts,
  getMyInvoices,
  getMyInvoiceById,
  getMyPayments,
  getSupplyItems,
  getMySupplyOrders,
  placeMySupplyOrder,
  cancelMySupplyOrder,
};

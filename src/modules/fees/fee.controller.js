/**
 * Controller cho Module Fees (Biểu phí, Điện nước, Hóa đơn).
 * Tiếp nhận request HTTP, gọi fee.service và trả về ApiResponse envelope.
 */

const feeService = require('./fee.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// Fee Types
const getFeeTypes = asyncHandler(async (req, res) => {
  const result = await feeService.getFeeTypes();
  return ApiResponse.success(res, result, 'Lấy danh mục biểu phí thành công');
});

const createFeeType = asyncHandler(async (req, res) => {
  const result = await feeService.createFeeType(req.body);
  return ApiResponse.success(res, result, 'Tạo loại phí thành công', 201);
});

const updateFeeType = asyncHandler(async (req, res) => {
  const result = await feeService.updateFeeType(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật loại phí thành công');
});

// Utility Readings
const getUtilityReadings = asyncHandler(async (req, res) => {
  const result = await feeService.getUtilityReadings(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách chỉ số điện nước thành công');
});

const recordUtilityReading = asyncHandler(async (req, res) => {
  const result = await feeService.recordUtilityReading(req.body, req.user.id);
  return ApiResponse.success(res, result, 'Lưu chỉ số thành công', 201);
});

const updateUtilityReading = asyncHandler(async (req, res) => {
  const result = await feeService.updateUtilityReading(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật chỉ số thành công');
});

// Invoices
const previewInvoiceGeneration = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await feeService.getGenerationPreview(query);
  return ApiResponse.success(res, result, 'Success');
});

const generateInvoices = asyncHandler(async (req, res) => {
  const result = await feeService.generateInvoices(req.body, req.user.id);
  return ApiResponse.success(res, result, 'Lập hóa đơn hàng loạt thành công', 201);
});

const getInvoices = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await feeService.getInvoices(query, req.user);
  return ApiResponse.success(res, result, 'Lấy danh sách hóa đơn thành công');
});

const getInvoiceById = asyncHandler(async (req, res) => {
  const result = await feeService.getInvoiceById(req.params.id, req.user);
  return ApiResponse.success(res, result, 'Lấy chi tiết hóa đơn thành công');
});

const createOneOffInvoice = asyncHandler(async (req, res) => {
  const result = await feeService.createOneOffInvoice(req.body, req.user.id);
  return ApiResponse.success(res, result, 'Tạo hóa đơn thủ công thành công', 201);
});

const cancelInvoice = asyncHandler(async (req, res) => {
  const result = await feeService.cancelInvoice(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'Hủy hóa đơn thành công');
});

const getOverdueInvoices = asyncHandler(async (req, res) => {
  const result = await feeService.getOverdueInvoices();
  return ApiResponse.success(res, result, 'Lấy danh sách hóa đơn quá hạn thành công');
});

module.exports = {
  getFeeTypes,
  createFeeType,
  updateFeeType,
  getUtilityReadings,
  recordUtilityReading,
  updateUtilityReading,
  previewInvoiceGeneration,
  generateInvoices,
  getInvoices,
  getInvoiceById,
  createOneOffInvoice,
  cancelInvoice,
  getOverdueInvoices,
};

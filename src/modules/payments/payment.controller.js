/**
 * Controller cho Module Payments (Thanh toán & Hoàn cọc KTX HaUI).
 * Tiếp nhận request HTTP, gọi payment.service và trả về ApiResponse.
 */

const paymentService = require('./payment.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// 1. Thu tiền mặt tại KTX (FR-52)
const payCash = asyncHandler(async (req, res) => {
  const result = await paymentService.payCash(req.body, req.user.id);
  return ApiResponse.success(res, result, result.message);
});

// 2. Lấy thông tin mã VietQR động (FR-53)
const generateVietQR = asyncHandler(async (req, res) => {
  const result = await paymentService.generateVietQR(req.params.invoiceId);
  return ApiResponse.success(res, result, 'Lấy mã VietQR thanh toán thành công');
});

// 3. Xác nhận chuyển khoản ngân hàng qua VietQR (FR-54)
const confirmBankTransfer = asyncHandler(async (req, res) => {
  const result = await paymentService.confirmBankTransfer(req.body, req.user.id);
  return ApiResponse.success(res, result, result.message);
});

// 4. Lấy danh sách giao dịch (thu tiền & hoàn cọc)
const getPayments = asyncHandler(async (req, res) => {
  const result = await paymentService.getPayments(req.query);
  return ApiResponse.success(res, result, 'Lấy lịch sử thanh toán thành công');
});

module.exports = {
  payCash,
  generateVietQR,
  confirmBankTransfer,
  getPayments,
};

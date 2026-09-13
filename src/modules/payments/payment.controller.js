/**
 * Controller cho Module Payments (Thanh toán).
 * Tiếp nhận request HTTP, gọi payment.service và trả về ApiResponse envelope chuẩn.
 * Tuân thủ theo API.md §8 và 14-PHIEN-BAN-DON-GIAN-HOA.md §4.10.
 */

const paymentService = require('./payment.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

/**
 * Ghi nhận thanh toán trực tiếp (tiền mặt / chuyển khoản quầy) do Admin/Nhân viên thực hiện.
 * POST /api/payments/offline hoặc POST /api/payments/cash
 */
const recordOfflinePayment = asyncHandler(async (req, res) => {
  const result = await paymentService.recordCashPayment(req.body, req.user.id);
  return ApiResponse.success(res, result, 'Ghi nhận thanh toán thành công', 201);
});

/**
 * Tạo phiên thanh toán trực tuyến qua cổng VNPay Sandbox.
 * POST /api/payments/online/checkout hoặc POST /api/payments/vnpay/create-url
 */
const createVNPayUrl = asyncHandler(async (req, res) => {
  const clientIp =
    req.headers['x-forwarded-for'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  const result = await paymentService.createVNPayUrl(req.body, clientIp, req.user);
  return ApiResponse.success(res, result, 'Khởi tạo giao dịch VNPay thành công');
});

/**
 * Xác thực chữ ký và cập nhật trạng thái thanh toán từ VNPay Return URL hoặc Webhook.
 * POST /api/payments/vnpay/verify hoặc POST /api/payments/webhook/vnpay
 */
const verifyVNPayPayment = asyncHandler(async (req, res) => {
  // Dữ liệu tham số trả về có thể nằm trong body hoặc query
  const queryParams = Object.keys(req.body).length > 0 ? req.body : req.query;

  const result = await paymentService.verifyVNPayPayment(queryParams);
  return ApiResponse.success(res, result, result.message);
});

/**
 * Đối soát giao dịch đang pending.
 * POST /api/payments/:id/reconcile
 */
const reconcilePayment = asyncHandler(async (req, res) => {
  const result = await paymentService.reconcilePayment(req.params.id);
  return ApiResponse.success(res, result, result.message);
});

/**
 * Lấy danh sách lịch sử giao dịch thanh toán (hỗ trợ lọc theo hóa đơn, sinh viên, hình thức, trạng thái).
 * GET /api/payments
 */
const getPayments = asyncHandler(async (req, res) => {
  const result = await paymentService.getPayments(req.query, req.user);
  return ApiResponse.paginate(res, result.items, result.total, result.page, result.limit, 'Lấy lịch sử thanh toán thành công');
});

/**
 * Lấy chi tiết một giao dịch thanh toán theo ID.
 * GET /api/payments/:id
 */
const getPaymentById = asyncHandler(async (req, res) => {
  const result = await paymentService.getPaymentById(req.params.id, req.user);
  return ApiResponse.success(res, result, 'Lấy chi tiết thanh toán thành công');
});

module.exports = {
  recordOfflinePayment,
  createVNPayUrl,
  verifyVNPayPayment,
  reconcilePayment,
  getPayments,
  getPaymentById,
};

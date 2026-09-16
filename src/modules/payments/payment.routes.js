/**
 * Router định tuyến cho Module Payments (Thanh toán).
 * Khai báo các endpoint theo hợp đồng API.md §8 và 16-YEU-CAU-API-BACKEND.md §3.13.
 */

const express = require('express');
const router = express.Router();

const paymentController = require('./payment.controller');
const {
  recordOfflinePaymentSchema,
  onlineCheckoutSchema,
  verifyVNPaySchema,
  queryPaymentSchema,
} = require('./payment.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

/**
 * Endpoint xác thực chữ ký VNPay (Webhook / Return URL).
 * Không bắt buộc JWT vì là gateway callback hoặc frontend redirect mang chữ ký số HMAC-SHA512.
 * Độ bảo mật được xác thực bằng mã băm bí mật VNP_HASH_SECRET (BR-61, TC-103).
 */
router.post('/webhook/vnpay', validate(verifyVNPaySchema), paymentController.verifyVNPayPayment);
router.get('/vnpay/return', validate(verifyVNPaySchema, 'query'), paymentController.verifyVNPayPayment);

// Các endpoint bên dưới yêu cầu xác thực tài khoản JWT
router.use(authenticate);

// 1. Thu tiền offline (tiền mặt / chuyển khoản quầy) - Admin & Staff
router.post('/offline', authorize('admin', 'staff'), validate(recordOfflinePaymentSchema), paymentController.recordOfflinePayment);

// 2. Tạo phiên thanh toán online - Student, Admin, Staff
router.post('/online/checkout', authorize('admin', 'staff', 'student'), validate(onlineCheckoutSchema), paymentController.createOnlineCheckout);

// 3. Đối soát trạng thái giao dịch pending - Admin & Staff
router.post('/:id/reconcile', authorize('admin', 'staff'), paymentController.reconcilePayment);

// 4. Danh sách lịch sử giao dịch - Admin, Staff, Viewer, Student (chính chủ)
router.get('/', authorize('admin', 'staff', 'viewer', 'student'), validate(queryPaymentSchema, 'query'), paymentController.getPayments);

// 5. Chi tiết 1 giao dịch thanh toán - Admin, Staff, Viewer, Student (chính chủ)
router.get('/:id', authorize('admin', 'staff', 'viewer', 'student'), paymentController.getPaymentById);

module.exports = router;

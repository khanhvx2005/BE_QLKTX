/**
 * Router định tuyến cho Module Payments (Thanh toán & Hoàn cọc KTX HaUI).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.6.
 */

const express = require('express');
const router = express.Router();

const paymentController = require('./payment.controller');
const {
  payCashSchema,
  confirmBankTransferSchema,
  queryPaymentSchema,
} = require('./payment.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

router.use(authenticate);

// 1. Thu tiền mặt tại KTX (FR-52 - chỉ cán bộ KTX & Admin)
router.post('/cash', authorize('admin', 'staff'), validate(payCashSchema), paymentController.payCash);

// 2. Lấy mã VietQR động thanh toán (FR-53 - mọi người dùng và sinh viên)
router.get('/vietqr/:invoiceId', authorize('admin', 'staff', 'student'), paymentController.generateVietQR);

// 3. Xác nhận chuyển khoản ngân hàng qua VietQR (FR-54 - chỉ cán bộ KTX & Admin)
router.post('/bank-transfer/confirm', authorize('admin', 'staff'), validate(confirmBankTransferSchema), paymentController.confirmBankTransfer);

// 4. Lịch sử giao dịch (thu tiền & hoàn cọc)
router.get('/', authorize('admin', 'staff'), validate(queryPaymentSchema, 'query'), paymentController.getPayments);

module.exports = router;

/**
 * /api/payments — API.md §7.
 *   - POST /webhook/vietqr: Webhook công khai chuẩn SePay/Casso (xác thực `x-webhook-secret`).
 *   - Các endpoint quản trị: Quyền `manager` và `staff`.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./payment.service');

const router = express.Router();

// Webhook tự động báo có từ ngân hàng / cổng trung gian VietQR (KHÔNG dùng JWT)
router.post('/webhook/vietqr', respond((req) => service.handleVietqrWebhook(req.headers, req.body)));

router.use(authenticate, authorize('manager', 'staff'));

router.get('/', respond((req) => service.list(req.query)));
router.post('/cash', respond((req) => service.collectCash(req.body, req.user)));
router.post('/vietqr/confirm', respond((req) => service.confirmVietqr(req.body, req.user)));
router.post('/webhook/simulate', respond((req) => service.simulateVietqrWebhook(req.body, req.user)));

module.exports = router;

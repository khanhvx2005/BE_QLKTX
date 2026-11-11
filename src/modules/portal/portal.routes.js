/**
 * Router định tuyến cho Cổng dịch vụ Sinh viên KTX HaUI (Student Portal).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.7.
 */

const express = require('express');
const router = express.Router();

const portalController = require('./portal.controller');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Toàn bộ route chỉ dành cho sinh viên đã đăng nhập
router.use(authenticate);
router.use(authorize('student', 'admin', 'staff'));

// 1. Hồ sơ & Phòng ở của tôi (FR-60)
router.get('/my-room', portalController.getMyRoom);

// 2. Hợp đồng KTX của tôi (FR-61)
router.get('/my-contract', portalController.getMyContract);

// 3. Hóa đơn cá nhân & Điện nước phòng (FR-62)
router.get('/my-invoices', portalController.getMyInvoices);

// 4. Lịch sử giao dịch thanh toán & Hoàn cọc (FR-63)
router.get('/my-payments', portalController.getMyPayments);

module.exports = router;

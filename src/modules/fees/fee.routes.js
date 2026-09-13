/**
 * Router định tuyến cho Module Fees (Biểu phí, Điện Nước, Hóa đơn).
 * Khai báo các endpoint theo hợp đồng API.md §7.
 */

const express = require('express');
const router = express.Router();

const feeController = require('./fee.controller');
const {
  createFeeTypeSchema,
  updateFeeTypeSchema,
  createUtilityReadingSchema,
  generateInvoicesSchema,
  createInvoiceSchema,
  queryInvoiceSchema,
} = require('./fee.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Yêu cầu đăng nhập theo từng nhánh tài nguyên
router.use('/fee-types', authenticate);
router.use('/utility-readings', authenticate);
router.use('/invoices', authenticate);

// ==========================================
// 1. Biểu phí (Fee Types)
// ==========================================
router.get('/fee-types', authorize('admin', 'staff', 'viewer'), feeController.getFeeTypes);
router.post('/fee-types', authorize('admin'), validate(createFeeTypeSchema), feeController.createFeeType);
router.put('/fee-types/:id', authorize('admin'), validate(updateFeeTypeSchema), feeController.updateFeeType);

// ==========================================
// 2. Chỉ số Điện Nước (Utility Readings)
// ==========================================
router.get('/utility-readings', authorize('admin', 'staff', 'viewer'), feeController.getUtilityReadings);
router.post('/utility-readings', authorize('admin', 'staff'), validate(createUtilityReadingSchema), feeController.recordUtilityReading);
router.put('/utility-readings/:id', authorize('admin', 'staff'), feeController.updateUtilityReading);

// ==========================================
// 3. Hóa đơn (Invoices)
// ==========================================
// Lập hóa đơn hàng loạt và chia đều điện nước (admin, staff)
router.post('/invoices/generate', authorize('admin', 'staff'), validate(generateInvoicesSchema), feeController.generateInvoices);

// Danh sách hóa đơn quá hạn cho Dashboard (admin, staff, viewer)
router.get('/invoices/overdue', authorize('admin', 'staff', 'viewer'), feeController.getOverdueInvoices);

// Danh sách hóa đơn (admin, staff, viewer, student xem hóa đơn của mình)
router.get('/invoices', authorize('admin', 'staff', 'viewer', 'student'), validate(queryInvoiceSchema, 'query'), feeController.getInvoices);

// Chi tiết 1 hóa đơn (admin, staff, viewer, student xem hóa đơn của mình)
router.get('/invoices/:id', authorize('admin', 'staff', 'viewer', 'student'), feeController.getInvoiceById);

// Tạo hóa đơn thủ công phát sinh (admin, staff)
router.post('/invoices', authorize('admin', 'staff'), validate(createInvoiceSchema), feeController.createOneOffInvoice);

// Hủy hóa đơn chưa thanh toán (admin, staff)
router.patch('/invoices/:id/cancel', authorize('admin', 'staff'), feeController.cancelInvoice);

module.exports = router;

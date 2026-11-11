/**
 * Router định tuyến cho Module Fees (Điện Nước & Hóa Đơn KTX HaUI).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.5 & §3.6.
 */

const express = require('express');
const router = express.Router();

const feeController = require('./fee.controller');
const {
  recordReadingSchema,
  matrixGridReadingSchema,
  billReadingSchema,
  queryInvoiceSchema,
} = require('./fee.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Chỉ bảo vệ các tuyến đường của utility-readings và invoices
router.use('/utility-readings', authenticate);
router.use('/invoices', authenticate);

// ==========================================
// 1. Chỉ số Điện Nước (Utility Readings)
// ==========================================
// Ghi chỉ số 1 phòng (FR-40)
router.post('/utility-readings', authorize('admin', 'staff'), validate(recordReadingSchema), feeController.recordUtilityReading);

// Ghi chỉ số bảng lưới theo tòa nhà (Matrix Grid - FR-40)
router.post('/utility-readings/matrix-grid', authorize('admin', 'staff'), validate(matrixGridReadingSchema), feeController.recordMatrixGrid);

// Chốt & Phát hành hóa đơn phòng (FR-41)
router.post('/utility-readings/:id/bill', authorize('admin', 'staff'), feeController.billUtilityReading);

// ==========================================
// 2. Hóa đơn KTX (Invoices)
// ==========================================
// Lấy danh sách hóa đơn (FR-50)
router.get('/invoices', authorize('admin', 'staff'), validate(queryInvoiceSchema, 'query'), feeController.getInvoices);

// Xem chi tiết 1 hóa đơn (FR-51)
router.get('/invoices/:id', authorize('admin', 'staff', 'student'), feeController.getInvoiceById);

module.exports = router;

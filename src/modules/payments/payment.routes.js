/**
 * /api/payments — API.md §8. Admin và Staff. Sinh viên lấy mã VietQR qua /api/portal/my-invoices/:id/vietqr.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./payment.service');

const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));

router.get('/', respond((req) => service.list(req.query)));
router.post('/cash', respond((req) => service.collectCash(req.body, req.user)));
router.post('/vietqr/confirm', respond((req) => service.confirmVietqr(req.body, req.user)));

module.exports = router;

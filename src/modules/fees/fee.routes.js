/**
 * /api/utility-readings, /api/invoices — API.md §7, §8. Admin và Staff.
 * Sinh viên xem hóa đơn qua /api/portal (kiểm quyền sở hữu), không qua đây.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./fee.service');

const router = express.Router();
const staff = [authenticate, authorize('admin', 'staff')];

router.get('/utility-readings/sheet', ...staff, respond((req) => service.sheet(req.query)));
router.post('/utility-readings/bulk', ...staff, respond((req) => service.saveBulk(req.body, req.user)));
router.post('/utility-readings/publish', ...staff, respond((req) => service.publish(req.body)));
router.get('/utility-readings/history', ...staff, respond((req) => service.history(req.query)));

router.get('/invoices', ...staff, respond((req) => service.listInvoices(req.query)));
router.get('/invoices/:id', ...staff, respond((req) => service.getInvoice(req.params.id)));

module.exports = router;

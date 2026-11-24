/**
 * /api/utility-readings, /api/invoices — API.md §7. Quyền: Manager và Staff.
 * Sinh viên xem hóa đơn qua /api/portal (chống IDOR bằng JWT), không qua đây.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./fee.service');

const router = express.Router();
const ops = [authenticate, authorize('manager', 'staff')];

router.get('/utility-readings/sheet', ...ops, respond((req) => service.sheet(req.query)));
router.post('/utility-readings/bulk', ...ops, respond((req) => service.saveBulk(req.body, req.user)));
router.post('/utility-readings/publish', ...ops, respond((req) => service.publish(req.body)));
router.get('/utility-readings/history', ...ops, respond((req) => service.history(req.query)));

router.get('/invoices', ...ops, respond((req) => service.listInvoices(req.query)));
router.get('/invoices/:id', ...ops, respond((req) => service.getInvoice(req.params.id)));

module.exports = router;

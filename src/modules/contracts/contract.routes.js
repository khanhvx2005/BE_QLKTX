/**
 * /api/contracts — API.md §6.
 * `POST /register-online` công khai; các endpoint còn lại dành cho Manager & Staff.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./contract.service');

const router = express.Router();

router.post('/register-online', respond((req) => service.registerOnline(req.body)));

router.use(authenticate, authorize('manager', 'staff'));
router.get('/', respond((req) => service.list(req.query)));
router.post('/auto-approve', respond((req) => service.autoApprove(req.body, req.user)));
router.post('/cancel-overdue', respond((req) => service.cancelOverdue(req.user)));
router.post('/checkin-qr', respond((req) => service.checkinQr(req.body, req.user)));
router.get('/:id', respond((req) => service.getById(req.params.id)));
router.patch('/:id/approve', respond((req) => service.approve(req.params.id, req.body, req.user)));
router.patch('/:id/reject', respond((req) => service.reject(req.params.id, req.body, req.user)));
router.patch('/:id/cancel', respond((req) => service.cancelPendingPayment(req.params.id, req.body, req.user)));
router.patch('/:id/terminate', respond((req) => service.terminate(req.params.id)));
router.patch('/:id/deposit-refund', respond((req) => service.refundDeposit(req.params.id, req.body, req.user)));

module.exports = router;

/**
 * /api/contracts — API.md §6 (cán bộ) + nộp đơn công khai §5.
 * ⚠️ `register-online` phải khai báo TRƯỚC `router.use(authenticate)`: người nộp đơn chưa có tài khoản.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./contract.service');

const router = express.Router();

router.post('/register-online', respond((req) => service.registerOnline(req.body)));

router.use(authenticate, authorize('admin', 'staff'));
router.get('/', respond((req) => service.list(req.query)));
router.get('/:id', respond((req) => service.getById(req.params.id)));
router.patch('/:id/approve', respond((req) => service.approve(req.params.id, req.body, req.user)));
router.patch('/:id/reject', respond((req) => service.reject(req.params.id, req.body, req.user)));
router.patch('/:id/terminate', respond((req) => service.terminate(req.params.id)));
router.patch('/:id/deposit-refund', respond((req) => service.refundDeposit(req.params.id, req.user)));

module.exports = router;

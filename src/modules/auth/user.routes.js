/**
 * /api/users — API.md §2. Chỉ Admin, riêng đặt lại mật khẩu thì Staff được (cho sinh viên).
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./user.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin'), respond((req) => service.list(req.query)));
router.post('/', authorize('admin'), respond((req) => service.create(req.body)));
router.put('/:id', authorize('admin'), respond((req) => service.update(req.params.id, req.body, req.user)));
router.patch('/:id/status', authorize('admin'), respond((req) => service.setStatus(req.params.id, req.body, req.user)));
router.post('/:id/reset-password', authorize('admin', 'staff'), respond((req) => service.resetPassword(req.params.id, req.user)));

module.exports = router;

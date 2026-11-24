/**
 * /api/periods — Quản lý Đợt đăng ký KTX (API.md §5).
 * Manager toàn quyền cấu hình & đóng/mở đợt; Staff được xem danh sách & chi tiết.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./period.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('manager', 'staff'), respond((req) => service.list(req.query)));
router.get('/:id', authorize('manager', 'staff'), respond((req) => service.getById(req.params.id)));
router.post('/', authorize('manager'), respond((req) => service.create(req.body)));
router.put('/:id', authorize('manager'), respond((req) => service.update(req.params.id, req.body)));
router.patch('/:id/status', authorize('manager'), respond((req) => service.setStatus(req.params.id, req.body)));

module.exports = router;

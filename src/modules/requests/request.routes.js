/**
 * /api/requests — API.md §8.
 *   - GET /: `manager` và `staff` xem danh sách phiếu Báo hỏng / Chuyển phòng / Trả phòng.
 *   - PATCH /:id/status: `manager` và `staff` xử lý; riêng phê duyệt chuyển phòng (`transfer`) bị chặn ở service chỉ cho `manager`.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./request.service');

const router = express.Router();
router.use(authenticate, authorize('manager', 'staff'));

router.get('/', respond((req) => service.list(req.query)));
router.patch('/:id/status', respond((req) => service.updateStatus(req.params.id, req.body, req.user)));

module.exports = router;

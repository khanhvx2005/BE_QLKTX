/**
 * /api/notifications — API.md §8.
 *   - GET/POST /announcements: `manager` và `staff` đăng bảng tin chung KTX (hiển thị cả Trang chủ công khai & Portal SV).
 *   - DELETE /announcements/:id: CHỈ `manager`.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./notification.service');

const router = express.Router();
router.use(authenticate);

router.get('/announcements', authorize('manager', 'staff'), respond((req) => service.listPublicAnnouncements(req.query)));
router.post('/announcements', authorize('manager', 'staff'), respond((req) => service.createAnnouncement(req.body, req.user)));
router.delete('/announcements/:id', authorize('manager'), respond((req) => service.deleteAnnouncement(req.params.id)));

module.exports = router;

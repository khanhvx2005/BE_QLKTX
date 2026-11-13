/**
 * /api/dashboard — API.md §10. Doanh thu chỉ Admin (Staff → 403 FORBIDDEN).
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./dashboard.service');

const router = express.Router();
router.use(authenticate);

router.get('/summary', authorize('admin', 'staff'), respond(() => service.summary()));
router.get('/occupancy', authorize('admin', 'staff'), respond(() => service.occupancy()));
router.get('/revenue', authorize('admin'), respond((req) => service.revenue(req.query)));

module.exports = router;

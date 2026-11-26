/**
 * /api/dashboard — API.md §10.
 *   - KPI & Tỷ lệ lấp đầy (KTX Cơ sở 1): `manager` và `staff` (`admin` -> 403 FORBIDDEN).
 *   - Doanh thu thực thu (`/revenue`): CHỈ `manager` (`staff` và `admin` -> 403 FORBIDDEN).
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./dashboard.service');

const router = express.Router();
router.use(authenticate);

router.get('/summary', authorize('manager', 'staff'), respond((req) => service.summary(req.query)));
router.get('/occupancy', authorize('manager', 'staff'), respond((req) => service.occupancy(req.query)));
router.get('/revenue', authorize('manager'), respond((req) => service.revenue(req.query)));

module.exports = router;

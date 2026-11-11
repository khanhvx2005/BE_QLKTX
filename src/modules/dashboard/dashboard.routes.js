/**
 * Router định tuyến cho Module Dashboard (Báo cáo & Thống kê KTX HaUI).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.8.
 */

const express = require('express');
const router = express.Router();

const dashboardController = require('./dashboard.controller');
const { authenticate, authorize } = require('../../core/middlewares/auth');

router.use(authenticate);

// 1. Thống kê KPI tổng quan (FR-70 - Cán bộ KTX & Admin)
router.get('/kpi', authorize('admin', 'staff'), dashboardController.getSummaryKPI);

// 2. Báo cáo lấp đầy theo từng tòa nhà (FR-71 - Cán bộ KTX & Admin)
router.get('/occupancy', authorize('admin', 'staff'), dashboardController.getBuildingOccupancy);

// 3. Báo cáo Doanh thu tài chính chi tiết (FR-72 - Chỉ Quản trị viên Admin)
router.get('/revenue', authorize('admin'), dashboardController.getRevenueReport);

module.exports = router;

/**
 * Router định tuyến cho Module Dashboard (Thống kê & Vận hành).
 * Khai báo các endpoint theo hợp đồng API.md §11.
 */

const express = require('express');
const router = express.Router();

const dashboardController = require('./dashboard.controller');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Yêu cầu xác thực toàn bộ route dashboard
router.use(authenticate);

// Toàn bộ Dashboard chỉ dành cho Admin, Staff, Viewer
router.use(authorize('admin', 'staff', 'viewer'));

// 1. Tỷ lệ lấp đầy phòng/giường toàn hệ thống và theo từng tòa
router.get('/occupancy', dashboardController.getOccupancy);

// 2. Báo cáo tổng hợp số liệu vận hành (Tổng quan, Công nợ, Doanh thu, Hàng đợi xử lý)
router.get('/summary', dashboardController.getSummary);

// 3. Biểu đồ doanh thu
router.get('/revenue', dashboardController.getRevenue);

module.exports = router;

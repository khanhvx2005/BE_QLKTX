/**
 * Router định tuyến cho Module Residencies (Lưu trú).
 * Khai báo các endpoint tra cứu theo hợp đồng API.md §5 (v1.2).
 */

const express = require('express');
const router = express.Router();

const residencyController = require('./residency.controller');
const { queryResidencySchema } = require('./residency.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Yêu cầu xác thực toàn bộ route
router.use(authenticate);

// 1. Tra cứu danh sách lưu trú (admin, staff, viewer)
router.get('/', authorize('admin', 'staff', 'viewer'), validate(queryResidencySchema, 'query'), residencyController.getResidencies);

// 2. Chi tiết 1 bản ghi lưu trú (admin, staff, viewer, student chính chủ)
router.get('/:id', authorize('admin', 'staff', 'viewer', 'student'), residencyController.getResidencyById);

module.exports = router;

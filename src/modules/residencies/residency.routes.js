/**
 * Router định tuyến cho Module Residencies (Lưu trú).
 * Khai báo các endpoint theo hợp đồng API.md §5.
 */

const express = require('express');
const router = express.Router();

const residencyController = require('./residency.controller');
const { createResidencySchema, queryResidencySchema } = require('./residency.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Yêu cầu xác thực toàn bộ route
router.use(authenticate);

// 1. Danh sách lưu trú (admin, staff, viewer)
router.get('/', authorize('admin', 'staff', 'viewer'), validate(queryResidencySchema, 'query'), residencyController.getResidencies);

// 2. Chi tiết 1 bản ghi lưu trú (admin, staff, viewer, student chính chủ)
router.get('/:id', authorize('admin', 'staff', 'viewer', 'student'), residencyController.getResidencyById);

// 3. Đăng ký lưu trú / xếp giường (admin, staff)
router.post('/', authorize('admin', 'staff'), validate(createResidencySchema), residencyController.createResidency);

// 4. Đóng lưu trú và giải phóng giường (admin, staff)
router.patch('/:id/close', authorize('admin', 'staff'), residencyController.closeResidency);

module.exports = router;

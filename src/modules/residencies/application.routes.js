/**
 * Router định tuyến cho Module Applications (/api/applications).
 * Khai báo các endpoint theo hợp đồng API.md §5.1.
 */

const express = require('express');
const router = express.Router();

const applicationController = require('./application.controller');
const {
  createApplicationStaffSchema,
  approveApplicationSchema,
  rejectApplicationSchema,
  queryApplicationSchema,
} = require('./application.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

router.use(authenticate);

// 1. Danh sách hàng đợi đơn đăng ký (admin, staff, viewer)
router.get('/', authorize('admin', 'staff', 'viewer'), validate(queryApplicationSchema, 'query'), applicationController.getApplications);

// 2. Chi tiết một đơn đăng ký kèm danh sách giường (admin, staff, viewer)
router.get('/:id', authorize('admin', 'staff', 'viewer'), applicationController.getApplicationById);

// 3. Cán bộ nộp đơn đăng ký hộ sinh viên (admin, staff)
router.post('/', authorize('admin', 'staff'), validate(createApplicationStaffSchema), applicationController.createApplicationStaff);

// 4. Duyệt đơn và tự động xếp giường (admin, staff)
router.patch('/:id/approve', authorize('admin', 'staff'), validate(approveApplicationSchema), applicationController.approveApplication);

// 5. Từ chối đơn đăng ký (admin, staff)
router.patch('/:id/reject', authorize('admin', 'staff'), validate(rejectApplicationSchema), applicationController.rejectApplication);

module.exports = router;

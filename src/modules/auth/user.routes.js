/**
 * Router định tuyến cho Module Quản lý Tài khoản (/api/users).
 * Phân quyền Admin & Cán bộ (Staff) theo FR-06 & FR-07.
 */

const express = require('express');
const router = express.Router();

const userController = require('./user.controller');
const {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  queryUserSchema,
} = require('./user.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

router.use(authenticate);

// 1. Danh sách tài khoản (Chỉ Admin)
router.get('/', authorize('admin'), validate(queryUserSchema, 'query'), userController.getUsers);

// 2. Tạo tài khoản mới (Chỉ Admin)
router.post('/', authorize('admin'), validate(createUserSchema), userController.createUser);

// 3. Đặt lại mật khẩu tạm cho người dùng (Admin & Staff) - FR-06
router.post('/:id/reset-password', authorize('admin', 'staff'), userController.resetPassword);

// 4. Cập nhật thông tin tài khoản (Chỉ Admin)
router.put('/:id', authorize('admin'), validate(updateUserSchema), userController.updateUser);

// 5. Khóa / Mở khóa tài khoản (Chỉ Admin) - FR-07
router.patch('/:id/status', authorize('admin'), validate(updateStatusSchema), userController.updateStatus);

module.exports = router;

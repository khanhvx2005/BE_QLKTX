/**
 * Router định tuyến cho Module Quản lý Tài khoản (/api/users).
 * Khai báo các endpoint theo hợp đồng API.md §2 & §2.1.
 */

const express = require('express');
const router = express.Router();

const userController = require('./user.controller');
const authController = require('./auth.controller');
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

// 3. Đặt lại mật khẩu tạm cho người dùng (Admin & Staff) - API.md §2
router.post('/:id/reset-password', authorize('admin', 'staff'), authController.resetPassword);

// 4. Cập nhật thông tin tài khoản (Chỉ Admin)
router.put('/:id', authorize('admin'), validate(updateUserSchema), userController.updateUser);

// 5. Khóa / Mở khóa tài khoản (Chỉ Admin)
router.patch('/:id/status', authorize('admin'), validate(updateStatusSchema), userController.updateStatus);

module.exports = router;

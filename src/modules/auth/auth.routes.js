/**
 * Router định tuyến cho Module Auth.
 * Khai báo các endpoint theo hợp đồng API.md §2.
 */

const express = require('express');
const router = express.Router();

const authController = require('./auth.controller');
const { registerSchema, loginSchema, changePasswordSchema } = require('./auth.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// 1. Đăng ký tài khoản sinh viên (Public)
router.post('/register', validate(registerSchema), authController.register);

// 2. Đăng nhập (Public)
router.post('/login', validate(loginSchema), authController.login);

// 3. Đăng xuất (Yêu cầu đăng nhập)
router.post('/logout', authenticate, authController.logout);

// 4. Lấy thông tin tài khoản hiện tại (Yêu cầu đăng nhập)
router.get('/me', authenticate, authController.getMe);

// 5. Đổi mật khẩu cá nhân (Yêu cầu đăng nhập)
router.patch('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

// 6. Reset mật khẩu tạm thời cho người dùng (Chỉ Admin & Staff)
router.post('/users/:id/reset-password', authenticate, authorize('admin', 'staff'), authController.resetPassword);

module.exports = router;

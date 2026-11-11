/**
 * Router định tuyến cho Module Auth (Xác thực & Đổi mật khẩu).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.1.
 */

const express = require('express');
const router = express.Router();

const authController = require('./auth.controller');
const { loginSchema, changePasswordSchema } = require('./auth.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate } = require('../../core/middlewares/auth');

// Đăng nhập hệ thống bằng Email hoặc MSSV (FR-01)
router.post('/login', validate(loginSchema), authController.login);

// Đăng xuất (FR-03)
router.post('/logout', authenticate, authController.logout);

// Lấy thông tin tài khoản hiện tại (FR-04)
router.get('/me', authenticate, authController.getMe);

// Đổi mật khẩu cá nhân (FR-05 - Bắt buộc ở lần đầu đăng nhập)
router.patch('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

module.exports = router;

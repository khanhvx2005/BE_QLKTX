/**
 * /api/auth — API.md §2. Đăng nhập không cần token; ba route còn lại dùng được cả khi đang bị buộc đổi mật khẩu.
 */

const express = require('express');
const { authenticate } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./auth.service');

const router = express.Router();

router.post('/login', respond((req) => service.login(req.body)));
router.post('/logout', authenticate, respond(() => ({ data: null, message: 'Đã đăng xuất' })));
router.get('/me', authenticate, respond((req) => service.me(req.user.id)));
router.patch('/change-password', authenticate, respond((req) => service.changePassword(req.user.id, req.body)));

module.exports = router;

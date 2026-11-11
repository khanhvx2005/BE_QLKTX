/**
 * Controller cho Module Auth (Xác thực & Đổi mật khẩu).
 */

const authService = require('./auth.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// 1. Đăng nhập hệ thống (FR-01)
const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ApiResponse.success(res, result, 'Đăng nhập thành công');
});

// 2. Lấy thông tin tài khoản hiện tại (FR-04)
const getMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user.id);
  return ApiResponse.success(res, result, 'Lấy thông tin tài khoản thành công');
});

// 3. Đổi mật khẩu cá nhân (FR-05)
const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  return ApiResponse.success(res, result, result.message);
});

// 4. Đăng xuất (FR-03)
const logout = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, null, 'Đăng xuất thành công');
});

module.exports = {
  login,
  getMe,
  changePassword,
  logout,
};

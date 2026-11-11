/**
 * Controller cho Module Quản lý Tài khoản (/api/users).
 * Tiếp nhận request HTTP, gọi user.service và trả về ApiResponse envelope chuẩn.
 */

const userService = require('./user.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// 1. Danh sách tài khoản (FR-07)
const getUsers = asyncHandler(async (req, res) => {
  const result = await userService.getUsers(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách tài khoản thành công');
});

// 2. Tạo tài khoản mới (Admin)
const createUser = asyncHandler(async (req, res) => {
  const result = await userService.createUser(req.body);
  return ApiResponse.success(res, result, 'Đã tạo tài khoản', 201);
});

// 3. Cập nhật thông tin tài khoản (Admin)
const updateUser = asyncHandler(async (req, res) => {
  const result = await userService.updateUser(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, result, 'Cập nhật tài khoản thành công');
});

// 4. Khóa / Mở khóa tài khoản (FR-07)
const updateStatus = asyncHandler(async (req, res) => {
  const result = await userService.updateAccountStatus(req.params.id, req.body.isActive, req.user.id);
  const message = req.body.isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản';
  return ApiResponse.success(res, result, message);
});

// 5. Đặt lại mật khẩu tạm thời (FR-06 - Admin / Staff)
const resetPassword = asyncHandler(async (req, res) => {
  const result = await userService.resetPassword(req.params.id, req.user);
  return ApiResponse.success(res, result, 'Đặt lại mật khẩu tạm thành công');
});

module.exports = {
  getUsers,
  createUser,
  updateUser,
  updateStatus,
  resetPassword,
};

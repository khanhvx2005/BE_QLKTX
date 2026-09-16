/**
 * Controller cho Module Quản lý Tài khoản (/api/users).
 * Tiếp nhận request HTTP, gọi user.service và trả về ApiResponse envelope chuẩn.
 */

const userService = require('./user.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

const getUsers = asyncHandler(async (req, res) => {
  const result = await userService.getUsers(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách tài khoản thành công');
});

const createUser = asyncHandler(async (req, res) => {
  const result = await userService.createUser(req.body);
  return ApiResponse.success(res, result, 'Đã tạo tài khoản', 201);
});

const updateUser = asyncHandler(async (req, res) => {
  const result = await userService.updateUser(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, result, 'Cập nhật tài khoản thành công');
});

const updateStatus = asyncHandler(async (req, res) => {
  const result = await userService.updateStatus(req.params.id, req.body, req.user.id);
  const message = req.body.isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản';
  return ApiResponse.success(res, result, message);
});

module.exports = {
  getUsers,
  createUser,
  updateUser,
  updateStatus,
};

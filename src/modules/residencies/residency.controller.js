/**
 * Controller cho Module Residencies (Lưu trú).
 * Tiếp nhận request HTTP, gọi service và trả về ApiResponse envelope chuẩn.
 */

const residencyService = require('./residency.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

const getResidencies = asyncHandler(async (req, res) => {
  const result = await residencyService.getResidencies(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách lưu trú thành công');
});

const getResidencyById = asyncHandler(async (req, res) => {
  const result = await residencyService.getResidencyById(req.params.id, req.user);
  return ApiResponse.success(res, result, 'Lấy thông tin lưu trú thành công');
});

const createResidency = asyncHandler(async (req, res) => {
  const result = await residencyService.createResidency(req.body, req.user.id);
  return ApiResponse.success(res, result, 'Đăng ký lưu trú thành công', 201);
});

const closeResidency = asyncHandler(async (req, res) => {
  const result = await residencyService.closeResidency(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'Kết thúc lưu trú và giải phóng giường thành công');
});

module.exports = {
  getResidencies,
  getResidencyById,
  createResidency,
  closeResidency,
};

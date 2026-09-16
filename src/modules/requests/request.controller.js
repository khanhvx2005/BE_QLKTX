/**
 * Controller cho Module Requests (Yêu cầu gia hạn & trả phòng).
 * Tiếp nhận request HTTP, gọi request.service và trả về ApiResponse envelope chuẩn.
 * Tuân thủ theo API.md §9 và §10.
 */

const requestService = require('./request.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

/**
 * Lấy danh sách yêu cầu (hàng đợi xử lý cho Admin/Staff/Viewer).
 * GET /api/requests
 */
const getRequests = asyncHandler(async (req, res) => {
  const result = await requestService.getRequests(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách yêu cầu thành công');
});

/**
 * Lấy chi tiết 1 yêu cầu.
 * GET /api/requests/:id
 */
const getRequestById = asyncHandler(async (req, res) => {
  const result = await requestService.getRequestById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy chi tiết yêu cầu thành công');
});

/**
 * Nhân viên duyệt yêu cầu.
 * PATCH /api/requests/:id/approve
 */
const approveRequest = asyncHandler(async (req, res) => {
  const result = await requestService.approveRequest(req.params.id, req.body, req.user.id);
  const message = result.settlement
    ? 'Duyệt trả phòng thành công'
    : 'Duyệt gia hạn hợp đồng thành công';
  return ApiResponse.success(res, result, message);
});

/**
 * Nhân viên từ chối yêu cầu.
 * PATCH /api/requests/:id/reject
 */
const rejectRequest = asyncHandler(async (req, res) => {
  const result = await requestService.rejectRequest(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, result, 'Từ chối yêu cầu thành công');
});

// ==========================================
// Cổng sinh viên (Student Portal)
// ==========================================

const getMyRequests = asyncHandler(async (req, res) => {
  const result = await requestService.getMyRequests(req.user.studentId);
  return ApiResponse.success(res, result, 'Lấy danh sách yêu cầu của tôi thành công');
});

const createMyRequest = asyncHandler(async (req, res) => {
  const result = await requestService.createRequest(req.body, req.user.studentId);
  return ApiResponse.success(res, result, 'Gửi yêu cầu thành công', 201);
});

const cancelMyRequest = asyncHandler(async (req, res) => {
  const result = await requestService.cancelRequest(req.params.id, req.user.studentId);
  return ApiResponse.success(res, result, 'Hủy yêu cầu thành công');
});

module.exports = {
  getRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
  getMyRequests,
  createMyRequest,
  cancelMyRequest,
};

/**
 * Controller cho Module Requests (Yêu cầu gia hạn & trả phòng).
 * Tiếp nhận request HTTP, gọi request.service và trả về ApiResponse envelope chuẩn.
 * Tuân thủ theo API.md §9 và §10.
 */

const requestService = require('./request.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

/**
 * Sinh viên tạo yêu cầu gia hạn hoặc trả phòng.
 * POST /api/requests hoặc POST /api/portal/my-requests
 */
const createRequest = asyncHandler(async (req, res) => {
  const result = await requestService.createRequest(req.body, req.user);
  return ApiResponse.success(res, result, 'Gửi yêu cầu thành công', 201);
});

/**
 * Lấy danh sách yêu cầu (hàng đợi xử lý cho Admin/Staff/Viewer hoặc lịch sử của sinh viên).
 * GET /api/requests
 */
const getRequests = asyncHandler(async (req, res) => {
  const result = await requestService.getRequests(req.query, req.user);
  return ApiResponse.paginate(res, result.items, result.total, result.page, result.limit, 'Lấy danh sách yêu cầu thành công');
});

/**
 * Sinh viên xem các yêu cầu của chính mình.
 * GET /api/portal/my-requests
 */
const getMyRequests = asyncHandler(async (req, res) => {
  const result = await requestService.getRequests(req.query, req.user);
  return ApiResponse.paginate(res, result.items, result.total, result.page, result.limit, 'Lấy danh sách yêu cầu của tôi thành công');
});

/**
 * Lấy chi tiết 1 yêu cầu kèm tổng nợ hiện tại.
 * GET /api/requests/:id
 */
const getRequestById = asyncHandler(async (req, res) => {
  const result = await requestService.getRequestById(req.params.id, req.user);
  return ApiResponse.success(res, result, 'Lấy chi tiết yêu cầu thành công');
});

/**
 * Sinh viên hủy yêu cầu đang pending của mình.
 * DELETE /api/requests/:id hoặc DELETE /api/portal/my-requests/:id
 */
const cancelRequest = asyncHandler(async (req, res) => {
  const result = await requestService.cancelRequest(req.params.id, req.user);
  return ApiResponse.success(res, result, 'Hủy yêu cầu thành công');
});

/**
 * Nhân viên duyệt yêu cầu (Gia hạn kéo dài HĐ/Lưu trú, Trả phòng tự động quyết toán cọc).
 * PATCH /api/requests/:id/approve
 */
const approveRequest = asyncHandler(async (req, res) => {
  const result = await requestService.approveRequest(req.params.id, req.body, req.user.id);
  const message = result.settlement
    ? 'Duyệt trả phòng và quyết toán cọc thành công'
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

module.exports = {
  createRequest,
  getRequests,
  getMyRequests,
  getRequestById,
  cancelRequest,
  approveRequest,
  rejectRequest,
};

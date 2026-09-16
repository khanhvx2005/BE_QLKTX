/**
 * Controller cho Module Applications (Đơn đăng ký thuê phòng).
 * Tiếp nhận request HTTP, gọi application.service và trả về ApiResponse envelope.
 * Tuân thủ theo API.md §5.1, §10.
 */

const applicationService = require('./application.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// ==========================================
// Cán bộ (Staff/Admin/Viewer)
// ==========================================

const getApplications = asyncHandler(async (req, res) => {
  const result = await applicationService.getApplications(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách đơn đăng ký thành công');
});

const getApplicationById = asyncHandler(async (req, res) => {
  const result = await applicationService.getApplicationById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy thông tin đơn đăng ký thành công');
});

const createApplicationStaff = asyncHandler(async (req, res) => {
  const result = await applicationService.createApplication(req.body);
  return ApiResponse.success(res, result, 'Tạo đơn đăng ký cho sinh viên thành công', 201);
});

const approveApplication = asyncHandler(async (req, res) => {
  const result = await applicationService.approveApplication(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, result, 'Đã duyệt và xếp phòng');
});

const rejectApplication = asyncHandler(async (req, res) => {
  const result = await applicationService.rejectApplication(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, result, 'Đã từ chối đơn đăng ký');
});

// ==========================================
// Cổng sinh viên (Student Portal)
// ==========================================

const getMyApplications = asyncHandler(async (req, res) => {
  const result = await applicationService.getMyApplications(req.user.studentId);
  return ApiResponse.success(res, result, 'Lấy danh sách đơn đăng ký của tôi thành công');
});

const createMyApplication = asyncHandler(async (req, res) => {
  const result = await applicationService.createApplication({
    ...req.body,
    studentId: req.user.studentId,
  });
  return ApiResponse.success(
    res,
    result,
    'Nộp đơn thành công. Ban quản lý sẽ duyệt trong 1–2 ngày làm việc',
    201
  );
});

const cancelMyApplication = asyncHandler(async (req, res) => {
  const result = await applicationService.cancelApplication(req.params.id, req.user.studentId);
  return ApiResponse.success(res, result, 'Đã hủy đơn đăng ký thành công');
});

module.exports = {
  getApplications,
  getApplicationById,
  createApplicationStaff,
  approveApplication,
  rejectApplication,
  getMyApplications,
  createMyApplication,
  cancelMyApplication,
};

/**
 * Controller cho Cổng dịch vụ Sinh viên KTX HaUI (Student Portal).
 */

const portalService = require('./portal.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');
const ApiError = require('../../core/errors/api-error');

// Helper lấy studentId từ token của người dùng đăng nhập
const getStudentId = (req) => {
  if (!req.user || !req.user.studentId) {
    throw new ApiError(403, 'FORBIDDEN', 'Tài khoản chưa được liên kết với hồ sơ sinh viên');
  }
  return req.user.studentId;
};

// 1. Hồ sơ & Phòng ở của tôi (FR-60)
const getMyRoom = asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await portalService.getMyRoom(studentId);
  return ApiResponse.success(res, result, 'Lấy thông tin phòng ở thành công');
});

// 2. Hợp đồng của tôi (FR-61)
const getMyContract = asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await portalService.getMyContract(studentId);
  return ApiResponse.success(res, result, 'Lấy thông tin hợp đồng thành công');
});

// 3. Hóa đơn của tôi (Cá nhân & Phòng - FR-62)
const getMyInvoices = asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await portalService.getMyInvoices(studentId);
  return ApiResponse.success(res, result, 'Lấy danh sách hóa đơn thành công');
});

// 4. Lịch sử thanh toán & Hoàn cọc (FR-63)
const getMyPayments = asyncHandler(async (req, res) => {
  const studentId = getStudentId(req);
  const result = await portalService.getMyPayments(studentId);
  return ApiResponse.success(res, result, 'Lấy lịch sử thanh toán thành công');
});

module.exports = {
  getMyRoom,
  getMyContract,
  getMyInvoices,
  getMyPayments,
};

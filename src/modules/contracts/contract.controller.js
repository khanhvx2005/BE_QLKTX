/**
 * Controller cho Module Contracts (Hợp đồng & Đăng ký KTX HaUI).
 * Tiếp nhận request HTTP, gọi contract.service và trả về ApiResponse.
 */

const contractService = require('./contract.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// 1. Nộp đơn đăng ký KTX Online công khai (FR-30)
const registerOnline = asyncHandler(async (req, res) => {
  const result = await contractService.registerOnline(req.body);
  return ApiResponse.success(res, result, 'Nộp đơn đăng ký KTX Online thành công', 201);
});

// 2. Lấy danh sách hợp đồng / đơn đăng ký (FR-31)
const getContracts = asyncHandler(async (req, res) => {
  const result = await contractService.getContracts(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách hợp đồng thành công');
});

// 3. Xem chi tiết hợp đồng
const getContractById = asyncHandler(async (req, res) => {
  const result = await contractService.getContractById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy thông tin hợp đồng thành công');
});

// 4. Phê duyệt đơn đăng ký & Khóa giường nguyên tử (FR-32)
const approveContract = asyncHandler(async (req, res) => {
  const result = await contractService.approveContract(req.params.id, req.user.id);
  return ApiResponse.success(res, result, result.message);
});

// 5. Từ chối đơn đăng ký KTX (FR-33)
const rejectContract = asyncHandler(async (req, res) => {
  const result = await contractService.rejectContract(req.params.id, req.body.reason, req.user.id);
  return ApiResponse.success(res, result, result.message);
});

// 6. Trả phòng & Thanh lý Hợp đồng - HOÀN TIỀN CỌC (FR-34)
const terminateContract = asyncHandler(async (req, res) => {
  const result = await contractService.terminateContract(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, result, result.message);
});

module.exports = {
  registerOnline,
  getContracts,
  getContractById,
  approveContract,
  rejectContract,
  terminateContract,
};

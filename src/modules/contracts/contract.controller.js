/**
 * Controller cho Module Contracts (Hợp đồng).
 * Tiếp nhận request HTTP, gọi contract.service và trả về ApiResponse envelope chuẩn.
 * Tuân thủ theo API.md §6.
 */

const contractService = require('./contract.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

const getContracts = asyncHandler(async (req, res) => {
  const result = await contractService.getContracts(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách hợp đồng thành công');
});

const getContractById = asyncHandler(async (req, res) => {
  const result = await contractService.getContractById(req.params.id, req.user);
  return ApiResponse.success(res, result, 'Lấy thông tin hợp đồng thành công');
});

const updateContract = asyncHandler(async (req, res) => {
  const result = await contractService.updateContract(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật điều khoản hợp đồng thành công');
});

const terminateContract = asyncHandler(async (req, res) => {
  const result = await contractService.terminateContract(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, result, 'Đã chấm dứt hợp đồng');
});

module.exports = {
  getContracts,
  getContractById,
  updateContract,
  terminateContract,
};

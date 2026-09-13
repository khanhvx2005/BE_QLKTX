/**
 * Controller cho Module Contracts (Hợp đồng).
 * Tiếp nhận request HTTP, gọi contract.service và trả về ApiResponse envelope chuẩn.
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

const createContract = asyncHandler(async (req, res) => {
  const result = await contractService.createContract(req.body, req.user.id);
  return ApiResponse.success(res, result, 'Tạo hợp đồng thành công', 201);
});

const updateContract = asyncHandler(async (req, res) => {
  const result = await contractService.updateContract(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật thông tin hợp đồng thành công');
});

const activateContract = asyncHandler(async (req, res) => {
  const result = await contractService.activateContract(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'Kích hoạt hợp đồng thành công');
});

const terminateContract = asyncHandler(async (req, res) => {
  const result = await contractService.terminateContract(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'Thanh lý hợp đồng thành công');
});

module.exports = {
  getContracts,
  getContractById,
  createContract,
  updateContract,
  activateContract,
  terminateContract,
};

/**
 * Controller cho Module Rooms (Tòa nhà & Phòng KTX HaUI).
 * Tiếp nhận request HTTP, gọi room.service và trả về ApiResponse.
 */

const roomService = require('./room.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// ==========================================
// 1. Tòa nhà (Buildings)
// ==========================================

const getBuildings = asyncHandler(async (req, res) => {
  const result = await roomService.getBuildings(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách tòa nhà thành công');
});

const createBuilding = asyncHandler(async (req, res) => {
  const result = await roomService.createBuilding(req.body);
  return ApiResponse.success(res, result, 'Tạo tòa nhà thành công', 201);
});

const updateBuilding = asyncHandler(async (req, res) => {
  const result = await roomService.updateBuilding(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật tòa nhà thành công');
});

// ==========================================
// 2. Phòng KTX (Rooms)
// ==========================================

const getRooms = asyncHandler(async (req, res) => {
  const result = await roomService.getRooms(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách phòng thành công');
});

// Tra cứu phòng trống (Stack Allocation & Cache)
const getAvailableRooms = asyncHandler(async (req, res) => {
  const result = await roomService.getAvailableRooms(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách phòng còn chỗ thành công');
});

const getRoomById = asyncHandler(async (req, res) => {
  const result = await roomService.getRoomById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy thông tin phòng thành công');
});

const createRoom = asyncHandler(async (req, res) => {
  const result = await roomService.createRoom(req.body);
  return ApiResponse.success(res, result, 'Thêm phòng và sinh giường tự động thành công', 201);
});

const updateRoom = asyncHandler(async (req, res) => {
  const result = await roomService.updateRoom(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật thông tin phòng thành công');
});

module.exports = {
  getBuildings,
  createBuilding,
  updateBuilding,
  getRooms,
  getAvailableRooms,
  getRoomById,
  createRoom,
  updateRoom,
};

/**
 * Controller cho Module Rooms (Tòa nhà, Loại phòng, Phòng, Giường).
 * Tiếp nhận request HTTP, gọi room.service và trả về ApiResponse envelope.
 * Tuân thủ theo API.md §4.
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
// 2. Loại phòng (Room Types)
// ==========================================

const getRoomTypes = asyncHandler(async (req, res) => {
  const result = await roomService.getRoomTypes(req.query, req.user);
  return ApiResponse.success(res, result, 'Lấy danh sách loại phòng thành công');
});

const createRoomType = asyncHandler(async (req, res) => {
  const result = await roomService.createRoomType(req.body);
  return ApiResponse.success(res, result, 'Tạo loại phòng thành công', 201);
});

const updateRoomType = asyncHandler(async (req, res) => {
  const result = await roomService.updateRoomType(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật loại phòng thành công');
});

// ==========================================
// 3. Phòng (Rooms)
// ==========================================

const getRooms = asyncHandler(async (req, res) => {
  const result = await roomService.getRooms(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách phòng thành công');
});

const getAvailableRooms = asyncHandler(async (req, res) => {
  const result = await roomService.getAvailableRooms(req.query, req.user);
  return ApiResponse.success(res, result, 'Lấy danh sách phòng còn chỗ thành công');
});

const getRoomById = asyncHandler(async (req, res) => {
  const result = await roomService.getRoomById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy thông tin phòng thành công');
});

const createRoom = asyncHandler(async (req, res) => {
  const result = await roomService.createRoom(req.body);
  return ApiResponse.success(res, result, 'Thêm phòng thành công', 201);
});

const updateRoom = asyncHandler(async (req, res) => {
  const result = await roomService.updateRoom(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật thông tin phòng thành công');
});

// ==========================================
// 4. Giường (Beds)
// ==========================================

const updateBedStatus = asyncHandler(async (req, res) => {
  const result = await roomService.updateBedStatus(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật trạng thái giường thành công');
});

module.exports = {
  getBuildings,
  createBuilding,
  updateBuilding,
  getRoomTypes,
  createRoomType,
  updateRoomType,
  getRooms,
  getAvailableRooms,
  getRoomById,
  createRoom,
  updateRoom,
  updateBedStatus,
};

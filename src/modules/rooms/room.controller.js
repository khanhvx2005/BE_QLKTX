/**
 * Controller cho Module Rooms (Tòa nhà, Phòng, Giường).
 * Tiếp nhận request HTTP, gọi room.service và trả về ApiResponse envelope.
 */

const roomService = require('./room.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// Buildings
const getBuildings = asyncHandler(async (req, res) => {
  const result = await roomService.getBuildings();
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

// Rooms
const getRooms = asyncHandler(async (req, res) => {
  const result = await roomService.getRooms(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách phòng thành công');
});

const getRoomById = asyncHandler(async (req, res) => {
  const result = await roomService.getRoomById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy thông tin phòng thành công');
});

const createRoom = asyncHandler(async (req, res) => {
  const result = await roomService.createRoom(req.body);
  return ApiResponse.success(res, result, 'Tạo phòng thành công', 201);
});

const updateRoom = asyncHandler(async (req, res) => {
  const result = await roomService.updateRoom(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật thông tin phòng thành công');
});

// Beds
const getBedsByRoom = asyncHandler(async (req, res) => {
  const result = await roomService.getBedsByRoom(req.params.roomId);
  return ApiResponse.success(res, result, 'Lấy danh sách giường trong phòng thành công');
});

const addBed = asyncHandler(async (req, res) => {
  const result = await roomService.addBed(req.params.roomId, req.body);
  return ApiResponse.success(res, result, 'Thêm giường vào phòng thành công', 201);
});

const generateBeds = asyncHandler(async (req, res) => {
  const result = await roomService.generateBeds(req.params.roomId);
  return ApiResponse.success(res, result, 'Tự động tạo danh sách giường thành công', 201);
});

const updateBedStatus = asyncHandler(async (req, res) => {
  const result = await roomService.updateBedStatus(req.params.id, req.body.status);
  return ApiResponse.success(res, result, 'Cập nhật trạng thái giường thành công');
});

module.exports = {
  getBuildings,
  createBuilding,
  updateBuilding,
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  getBedsByRoom,
  addBed,
  generateBeds,
  updateBedStatus,
};

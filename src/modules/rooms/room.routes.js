/**
 * Router định tuyến cho Module Rooms (Tòa nhà, Loại phòng, Phòng, Giường).
 * Khai báo các endpoint theo hợp đồng API.md §4.
 */

const express = require('express');
const router = express.Router();

const roomController = require('./room.controller');
const {
  createBuildingSchema,
  updateBuildingSchema,
  createRoomTypeSchema,
  updateRoomTypeSchema,
  queryRoomTypeSchema,
  createRoomSchema,
  updateRoomSchema,
  queryRoomSchema,
  queryAvailableRoomsSchema,
  updateBedStatusSchema,
} = require('./room.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Toàn bộ route yêu cầu xác thực JWT
router.use(authenticate);

// ==========================================
// 1. Tòa nhà (Buildings)
// ==========================================
router.get('/buildings', authorize('admin', 'staff', 'viewer', 'student'), roomController.getBuildings);
router.post('/buildings', authorize('admin', 'staff'), validate(createBuildingSchema), roomController.createBuilding);
router.put('/buildings/:id', authorize('admin', 'staff'), validate(updateBuildingSchema), roomController.updateBuilding);

// ==========================================
// 2. Loại phòng (Room Types) - v1.2
// ==========================================
router.get('/room-types', authorize('admin', 'staff', 'viewer', 'student'), validate(queryRoomTypeSchema, 'query'), roomController.getRoomTypes);
router.post('/room-types', authorize('admin'), validate(createRoomTypeSchema), roomController.createRoomType);
router.put('/room-types/:id', authorize('admin'), validate(updateRoomTypeSchema), roomController.updateRoomType);

// ==========================================
// 3. Phòng (Rooms)
// ==========================================
router.get('/rooms', authorize('admin', 'staff', 'viewer'), validate(queryRoomSchema, 'query'), roomController.getRooms);
router.get('/rooms/available', authorize('admin', 'staff', 'student'), validate(queryAvailableRoomsSchema, 'query'), roomController.getAvailableRooms);
router.get('/rooms/:id', authorize('admin', 'staff', 'viewer'), roomController.getRoomById);
router.post('/rooms', authorize('admin', 'staff'), validate(createRoomSchema), roomController.createRoom);
router.put('/rooms/:id', authorize('admin', 'staff'), validate(updateRoomSchema), roomController.updateRoom);

// ==========================================
// 4. Giường (Beds)
// ==========================================
router.patch('/beds/:id/status', authorize('admin', 'staff'), validate(updateBedStatusSchema), roomController.updateBedStatus);

module.exports = router;

/**
 * Router định tuyến cho Module Rooms (Tòa nhà, Phòng, Giường).
 * Khai báo các endpoint theo hợp đồng API.md §4.
 */

const express = require('express');
const router = express.Router();

const roomController = require('./room.controller');
const {
  createBuildingSchema,
  updateBuildingSchema,
  createRoomSchema,
  updateRoomSchema,
  queryRoomSchema,
  createBedSchema,
  updateBedStatusSchema,
} = require('./room.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Yêu cầu đăng nhập theo từng nhánh tài nguyên
router.use('/buildings', authenticate);
router.use('/rooms', authenticate);
router.use('/beds', authenticate);

// ==========================================
// 1. Tòa nhà (Buildings)
// ==========================================
// Danh sách tòa nhà có thống kê lấp đầy (admin, staff, viewer, student)
router.get('/buildings', authorize('admin', 'staff', 'viewer', 'student'), roomController.getBuildings);

// Tạo tòa nhà (admin, staff)
router.post('/buildings', authorize('admin', 'staff'), validate(createBuildingSchema), roomController.createBuilding);

// Cập nhật tòa nhà (admin, staff)
router.put('/buildings/:id', authorize('admin', 'staff'), validate(updateBuildingSchema), roomController.updateBuilding);

// ==========================================
// 2. Phòng (Rooms)
// ==========================================
// Danh sách phòng có lọc theo tòa/giới tính/giường trống (admin, staff, viewer, student)
router.get('/rooms', authorize('admin', 'staff', 'viewer', 'student'), validate(queryRoomSchema, 'query'), roomController.getRooms);

// Chi tiết 1 phòng kèm danh sách giường (admin, staff, viewer, student)
router.get('/rooms/:id', authorize('admin', 'staff', 'viewer', 'student'), roomController.getRoomById);

// Tạo phòng (admin, staff) - Bắt buộc gender (A1, PRD §2.9)
router.post('/rooms', authorize('admin', 'staff'), validate(createRoomSchema), roomController.createRoom);

// Cập nhật phòng (admin, staff)
router.put('/rooms/:id', authorize('admin', 'staff'), validate(updateRoomSchema), roomController.updateRoom);

// ==========================================
// 3. Giường (Beds)
// ==========================================
// Danh sách giường trong 1 phòng (admin, staff, viewer, student)
router.get('/rooms/:roomId/beds', authorize('admin', 'staff', 'viewer', 'student'), roomController.getBedsByRoom);

// Thêm 1 giường vào phòng (admin, staff)
router.post('/rooms/:roomId/beds', authorize('admin', 'staff'), validate(createBedSchema), roomController.addBed);

// Tự động sinh danh sách giường theo sức chứa capacity (admin, staff)
router.post('/rooms/:roomId/beds/generate', authorize('admin', 'staff'), roomController.generateBeds);

// Đổi trạng thái giường thủ công (admin, staff)
router.patch('/beds/:id/status', authorize('admin', 'staff'), validate(updateBedStatusSchema), roomController.updateBedStatus);

module.exports = router;

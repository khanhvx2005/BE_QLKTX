/**
 * Router định tuyến cho Module Rooms (Tòa nhà & Phòng KTX HaUI).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.3 và EDIT_DOCS_DATA_SCHEMA.md §3.4.
 */

const express = require('express');
const router = express.Router();

const roomController = require('./room.controller');
const {
  createBuilding,
  updateBuilding,
  createRoom,
  updateRoom,
} = require('./room.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// ==========================================
// 1. Tuyến đường công khai (Public Routes)
// Sinh viên chưa có tài khoản có thể tra cứu phòng trống để nộp đơn (FR-23)
// ==========================================
router.get('/rooms/available', roomController.getAvailableRooms);
router.get('/buildings/public', roomController.getBuildings);

// ==========================================
// 2. Tuyến đường yêu cầu xác thực JWT (Protected)
// Chỉ áp dụng authenticate cho /buildings và /rooms
// ==========================================
router.use('/buildings', authenticate);
router.use('/rooms', authenticate);

// Tòa nhà (Buildings)
router.get('/buildings', authorize('admin', 'staff', 'student'), roomController.getBuildings);
router.post('/buildings', authorize('admin', 'staff'), validate(createBuilding), roomController.createBuilding);
router.put('/buildings/:id', authorize('admin', 'staff'), validate(updateBuilding), roomController.updateBuilding);

// Phòng KTX (Rooms)
router.get('/rooms', authorize('admin', 'staff'), roomController.getRooms);
router.get('/rooms/:id', authorize('admin', 'staff'), roomController.getRoomById);
router.post('/rooms', authorize('admin', 'staff'), validate(createRoom), roomController.createRoom);
router.put('/rooms/:id', authorize('admin', 'staff'), validate(updateRoom), roomController.updateRoom);

module.exports = router;

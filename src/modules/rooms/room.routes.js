/**
 * /api/buildings, /api/rooms — API.md §4.
 * Manager cấu hình Tòa nhà & Phòng 3 Cơ sở; Staff xem danh sách & chi tiết phòng.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./room.service');

const router = express.Router();
const viewer = [authenticate, authorize('manager', 'staff')];
const managerOnly = [authenticate, authorize('manager')];

router.get('/buildings', ...viewer, respond((req) => service.listBuildings(req.query)));
router.post('/buildings', ...managerOnly, respond((req) => service.createBuilding(req.body)));
router.put('/buildings/:id', ...managerOnly, respond((req) => service.updateBuilding(req.params.id, req.body)));

router.get('/rooms', ...viewer, respond((req) => service.listRooms(req.query)));
router.get('/rooms/:id', ...viewer, respond((req) => service.getRoom(req.params.id)));
router.post('/rooms', ...managerOnly, respond((req) => service.createRoom(req.body)));
router.put('/rooms/:id', ...managerOnly, respond((req) => service.updateRoom(req.params.id, req.body)));

module.exports = router;

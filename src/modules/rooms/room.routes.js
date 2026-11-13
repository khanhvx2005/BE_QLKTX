/**
 * /api/buildings, /api/rooms — API.md §4. Admin và Staff.
 * Danh sách phòng trống cho người nộp đơn nằm ở /api/public (public.routes.js), không ở đây.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./room.service');

const router = express.Router();
const staff = [authenticate, authorize('admin', 'staff')];

router.get('/buildings', ...staff, respond((req) => service.listBuildings(req.query)));
router.post('/buildings', ...staff, respond((req) => service.createBuilding(req.body)));
router.put('/buildings/:id', ...staff, respond((req) => service.updateBuilding(req.params.id, req.body)));

router.get('/rooms', ...staff, respond((req) => service.listRooms(req.query)));
router.get('/rooms/:id', ...staff, respond((req) => service.getRoom(req.params.id)));
router.post('/rooms', ...staff, respond((req) => service.createRoom(req.body)));
router.put('/rooms/:id', ...staff, respond((req) => service.updateRoom(req.params.id, req.body)));

module.exports = router;

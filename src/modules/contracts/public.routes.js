/**
 * /api/public — Trang chủ công khai KTX chuẩn ssc.haui.edu.vn (API.md §1, không cần token).
 */

const express = require('express');
const { respond } = require('../../core/utils/http');
const contractService = require('./contract.service');
const periodService = require('../periods/period.service');
const notificationService = require('../notifications/notification.service');

const router = express.Router();

router.get('/campuses', respond(() => contractService.publicCampuses()));
router.get('/announcements', respond((req) => notificationService.listPublicAnnouncements(req.query)));
router.get('/periods/open', respond((req) => periodService.listOpenPublic(req.query)));
router.get('/rooms/available', respond((req) => contractService.availableRooms(req.query)));
router.get('/applications/status', respond((req) => contractService.applicationStatus(req.query)));
router.post('/applications/cancel', respond((req) => contractService.cancelPendingByStudent(req.body)));

module.exports = router;

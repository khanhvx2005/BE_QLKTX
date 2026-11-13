/**
 * /api/public — API.md §5: không cần token. Nên đặt giới hạn tần suất khi triển khai thật.
 */

const express = require('express');
const { respond } = require('../../core/utils/http');
const service = require('./contract.service');

const router = express.Router();

router.get('/rooms/available', respond((req) => service.availableRooms(req.query)));
router.get('/applications/status', respond((req) => service.applicationStatus(req.query)));

module.exports = router;

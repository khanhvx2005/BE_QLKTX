/**
 * /api/students — API.md §3. Manager và Staff (Admin hệ thống không can thiệp hồ sơ nội trú).
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./student.service');

const router = express.Router();
router.use(authenticate, authorize('manager', 'staff'));

router.get('/', respond((req) => service.list(req.query)));
router.post('/import', respond((req) => service.importMany(req.body)));
router.get('/:id', respond((req) => service.getById(req.params.id)));
router.post('/', respond((req) => service.create(req.body)));
router.put('/:id', respond((req) => service.update(req.params.id, req.body)));
router.patch('/:id/deactivate', respond((req) => service.deactivate(req.params.id)));

module.exports = router;

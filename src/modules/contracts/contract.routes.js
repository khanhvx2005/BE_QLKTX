/**
 * Router định tuyến cho Module Contracts (Hợp đồng).
 * Khai báo các endpoint theo hợp đồng API.md §6 (v1.2).
 */

const express = require('express');
const router = express.Router();

const contractController = require('./contract.controller');
const {
  updateContractSchema,
  terminateContractSchema,
  queryContractSchema,
} = require('./contract.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Yêu cầu xác thực toàn bộ route
router.use(authenticate);

// 1. Danh sách hợp đồng (admin, staff, viewer)
router.get('/', authorize('admin', 'staff', 'viewer'), validate(queryContractSchema, 'query'), contractController.getContracts);

// 2. Danh sách hợp đồng sắp hết hạn (admin, staff, viewer)
router.get('/expiring', authorize('admin', 'staff', 'viewer'), (req, res, next) => {
  const days = req.query.days || req.query.expiringInDays || 30;
  req.query.expiringInDays = days;
  if (req.validatedQuery) req.validatedQuery.expiringInDays = days;
  contractController.getContracts(req, res, next);
});

// 3. Chi tiết 1 hợp đồng (admin, staff, viewer, student chính chủ)
router.get('/:id', authorize('admin', 'staff', 'viewer', 'student'), contractController.getContractById);

// 4. Cập nhật điều khoản hợp đồng (admin, staff)
router.put('/:id', authorize('admin', 'staff'), validate(updateContractSchema), contractController.updateContract);

// 5. Chấm dứt hợp đồng active -> terminated (admin, staff)
router.patch('/:id/terminate', authorize('admin', 'staff'), validate(terminateContractSchema), contractController.terminateContract);

module.exports = router;

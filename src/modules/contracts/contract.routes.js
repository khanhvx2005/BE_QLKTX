/**
 * Router định tuyến cho Module Contracts (Hợp đồng).
 * Khai báo các endpoint theo hợp đồng API.md §6.
 */

const express = require('express');
const router = express.Router();

const contractController = require('./contract.controller');
const {
  createContractSchema,
  updateContractSchema,
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
  req.query.expiringInDays = req.query.days || req.query.expiringInDays || 30;
  contractController.getContracts(req, res, next);
});

// 3. Chi tiết 1 hợp đồng (admin, staff, viewer, student chính chủ)
router.get('/:id', authorize('admin', 'staff', 'viewer', 'student'), contractController.getContractById);

// 4. Tạo hợp đồng (admin, staff)
router.post('/', authorize('admin', 'staff'), validate(createContractSchema), contractController.createContract);

// 5. Cập nhật hợp đồng (admin, staff)
router.put('/:id', authorize('admin', 'staff'), validate(updateContractSchema), contractController.updateContract);

// 6. Kích hoạt hợp đồng pending -> active (admin, staff)
router.patch('/:id/activate', authorize('admin', 'staff'), contractController.activateContract);

// 7. Thanh lý hợp đồng active -> terminated (admin, staff)
router.patch('/:id/terminate', authorize('admin', 'staff'), contractController.terminateContract);

module.exports = router;

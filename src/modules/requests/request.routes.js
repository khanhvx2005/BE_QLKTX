/**
 * Router định tuyến cho Module Requests (/api/requests).
 * Khai báo các endpoint xử lý yêu cầu cho cán bộ theo hợp đồng API.md §9.
 */

const express = require('express');
const router = express.Router();

const requestController = require('./request.controller');
const {
  rejectRequestSchema,
  queryRequestSchema,
} = require('./request.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Yêu cầu xác thực toàn bộ route
router.use(authenticate);

// 1. Danh sách yêu cầu cần xử lý (admin, staff, viewer)
router.get('/', authorize('admin', 'staff', 'viewer'), validate(queryRequestSchema, 'query'), requestController.getRequests);

// 2. Chi tiết 1 yêu cầu (admin, staff)
router.get('/:id', authorize('admin', 'staff'), requestController.getRequestById);

// 3. Duyệt yêu cầu gia hạn/trả phòng (admin, staff)
router.patch('/:id/approve', authorize('admin', 'staff'), requestController.approveRequest);

// 4. Từ chối yêu cầu (admin, staff)
router.patch('/:id/reject', authorize('admin', 'staff'), validate(rejectRequestSchema), requestController.rejectRequest);

module.exports = router;

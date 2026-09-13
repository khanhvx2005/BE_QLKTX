/**
 * Router định tuyến cho Module Requests (Yêu cầu gia hạn & trả phòng).
 * Khai báo các endpoint theo hợp đồng API.md §9 và §10.
 */

const express = require('express');
const router = express.Router();

const requestController = require('./request.controller');
const {
  createRequestSchema,
  approveRequestSchema,
  rejectRequestSchema,
  queryRequestSchema,
} = require('./request.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Yêu cầu xác thực tài khoản JWT cho toàn bộ thao tác
router.use(authenticate);

// ==========================================
// Các endpoint quản lý Yêu cầu (API.md §9 & §10)
// ==========================================
// Danh sách yêu cầu (Admin, Staff, Viewer hoặc Student xem yêu cầu của mình)
router.get('/', authorize('admin', 'staff', 'viewer', 'student'), validate(queryRequestSchema, 'query'), requestController.getRequests);

// Sinh viên hoặc nhân viên tạo yêu cầu
router.post('/', authorize('admin', 'staff', 'student'), validate(createRequestSchema), requestController.createRequest);

// Chi tiết 1 yêu cầu (kèm tổng nợ sinh viên)
router.get('/:id', authorize('admin', 'staff', 'viewer', 'student'), requestController.getRequestById);

// Hủy yêu cầu đang pending
router.delete('/:id', authorize('admin', 'staff', 'student'), requestController.cancelRequest);

// Duyệt yêu cầu (Gia hạn HĐ hoặc Trả phòng quyết toán cọc)
router.patch('/:id/approve', authorize('admin', 'staff'), validate(approveRequestSchema), requestController.approveRequest);

// Từ chối yêu cầu (kèm lý do bắt buộc)
router.patch('/:id/reject', authorize('admin', 'staff'), validate(rejectRequestSchema), requestController.rejectRequest);

module.exports = router;

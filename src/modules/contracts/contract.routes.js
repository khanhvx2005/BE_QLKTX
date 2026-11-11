/**
 * Router định tuyến cho Module Contracts (Hợp đồng & Đăng ký KTX HaUI).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.4.
 */

const express = require('express');
const router = express.Router();

const contractController = require('./contract.controller');
const {
  registerOnlineSchema,
  rejectContractSchema,
  terminateContractSchema,
  queryContractSchema,
} = require('./contract.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// ==========================================
// 1. Tuyến đường công khai (Public Route)
// Sinh viên chưa có tài khoản nộp đơn KTX Online trực tiếp (FR-30)
// ==========================================
router.post('/register-online', validate(registerOnlineSchema), contractController.registerOnline);

// ==========================================
// 2. Tuyến đường yêu cầu xác thực JWT (Protected)
// ==========================================
router.use(authenticate);

// Danh sách hợp đồng / đơn đăng ký (FR-31)
router.get('/', authorize('admin', 'staff'), validate(queryContractSchema, 'query'), contractController.getContracts);

// Xem chi tiết hợp đồng
router.get('/:id', authorize('admin', 'staff', 'student'), contractController.getContractById);

// Phê duyệt đơn đăng ký & Khóa giường nguyên tử (FR-32)
router.post('/:id/approve', authorize('admin', 'staff'), contractController.approveContract);

// Từ chối đơn đăng ký (FR-33)
router.post('/:id/reject', authorize('admin', 'staff'), validate(rejectContractSchema), contractController.rejectContract);

// Trả phòng & Thanh lý Hợp đồng - HOÀN TIỀN CỌC (FR-34)
router.post('/:id/terminate', authorize('admin', 'staff'), validate(terminateContractSchema), contractController.terminateContract);

module.exports = router;

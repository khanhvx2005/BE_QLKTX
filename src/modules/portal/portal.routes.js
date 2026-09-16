/**
 * Router định tuyến cho Module Student Portal (/api/portal/*).
 * Khai báo các endpoint tự phục vụ cho sinh viên theo hợp đồng API.md §10.
 */

const express = require('express');
const router = express.Router();

const portalController = require('./portal.controller');
const applicationController = require('../residencies/application.controller');
const requestController = require('../requests/request.controller');

const { createApplicationStudentSchema } = require('../residencies/application.validation');
const { createRequestSchema } = require('../requests/request.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize, requireLinkedStudent } = require('../../core/middlewares/auth');

// Toàn bộ route portal yêu cầu vai trò sinh viên và đã gắn studentId
router.use(authenticate, authorize('student'), requireLinkedStudent);

// 1. Hồ sơ cá nhân sinh viên
router.get('/profile', portalController.getProfile);

// 2. Chỗ ở hiện tại và bạn cùng phòng
router.get('/my-residence', portalController.getMyResidence);

// 3. Đơn đăng ký phòng
router.get('/my-applications', applicationController.getMyApplications);
router.post('/my-applications', validate(createApplicationStudentSchema), applicationController.createMyApplication);
router.delete('/my-applications/:id', applicationController.cancelMyApplication);

// 4. Yêu cầu gia hạn & trả phòng
router.get('/my-requests', requestController.getMyRequests);
router.post('/my-requests', validate(createRequestSchema), requestController.createMyRequest);
router.delete('/my-requests/:id', requestController.cancelMyRequest);

// 5. Hợp đồng
router.get('/my-contracts', portalController.getMyContracts);

// 6. Hóa đơn
router.get('/my-invoices', portalController.getMyInvoices);
router.get('/my-invoices/:id', portalController.getMyInvoiceById);

// 7. Lịch sử thanh toán
router.get('/my-payments', portalController.getMyPayments);

// 8. Nhu yếu phẩm & mua sắm
const { placeSupplyOrderSchema } = require('../supplies/supply.validation');
router.get('/supply-items', portalController.getSupplyItems);
router.get('/my-supply-orders', portalController.getMySupplyOrders);
router.post('/my-supply-orders', validate(placeSupplyOrderSchema), portalController.placeMySupplyOrder);
router.patch('/my-supply-orders/:id/cancel', portalController.cancelMySupplyOrder);

module.exports = router;

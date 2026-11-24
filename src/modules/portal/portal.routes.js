/**
 * /api/portal — API.md §9. Chỉ dành cho Sinh viên nội trú (`student`).
 * Danh tính sinh viên luôn lấy từ JWT (`req.user.studentId`), chống IDOR tuyệt đối.
 */

const express = require('express');
const { authenticate, authorize } = require('../../core/middlewares/auth');
const { respond } = require('../../core/utils/http');
const service = require('./portal.service');

const router = express.Router();
router.use(authenticate, authorize('student'));

router.get('/profile', respond(service.profile));
router.get('/my-residence', respond(service.myResidence));
router.get('/my-contracts', respond(service.myContracts));
router.post('/applications', respond(service.applyFromPortal));
router.get('/my-contracts/:id/checkin-qr', respond(service.myCheckinQr));

router.get('/my-invoices', respond(service.myInvoices));
router.get('/my-invoices/:id', respond(service.myInvoice));
router.get('/my-invoices/:id/vietqr', respond(service.myInvoiceVietqr));
router.get('/my-payments', respond(service.myPayments));
router.get('/my-room/utility-history', respond(service.myRoomUtilityHistory));

router.get('/requests', respond(service.myRequests));
router.post('/requests', respond(service.createRequest));
router.patch('/requests/:id/cancel', respond(service.cancelRequest));

router.get('/notifications', respond(service.myNotifications));
router.patch('/notifications/:id/read', respond(service.markNotificationRead));
router.patch('/notifications/read-all', respond(service.markAllNotificationsRead));

module.exports = router;

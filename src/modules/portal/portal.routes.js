/**
 * /api/portal — API.md §9. Chỉ sinh viên.
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
router.get('/my-invoices', respond(service.myInvoices));
router.get('/my-invoices/:id', respond(service.myInvoice));
router.get('/my-invoices/:id/vietqr', respond(service.myInvoiceVietqr));
router.get('/my-payments', respond(service.myPayments));
router.get('/my-room/utility-history', respond(service.myRoomUtilityHistory));

module.exports = router;

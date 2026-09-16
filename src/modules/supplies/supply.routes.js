/**
 * Router định tuyến cho Module Supplies (Nhu yếu phẩm).
 * Khai báo các endpoint theo hợp đồng API.md §11.
 */

const express = require('express');
const router = express.Router();

const supplyController = require('./supply.controller');
const {
  createSupplyItemSchema,
  updateSupplyItemSchema,
  querySupplyItemSchema,
  querySupplyOrderSchema,
  cancelSupplyOrderSchema,
} = require('./supply.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

router.use(authenticate);

// --- SUPPLY ITEMS (Danh mục vật phẩm) ---
// 1. Xem danh mục: admin, staff, viewer
router.get(
  '/supply-items',
  authorize('admin', 'staff', 'viewer'),
  validate(querySupplyItemSchema, 'query'),
  supplyController.getSupplyItems
);

// 2. Thêm vật phẩm mới: admin, staff
router.post(
  '/supply-items',
  authorize('admin', 'staff'),
  validate(createSupplyItemSchema),
  supplyController.createSupplyItem
);

// 3. Cập nhật vật phẩm: admin, staff
router.put(
  '/supply-items/:id',
  authorize('admin', 'staff'),
  validate(updateSupplyItemSchema),
  supplyController.updateSupplyItem
);

// --- SUPPLY ORDERS (Đơn đặt hàng nhu yếu phẩm) ---
// 4. Danh sách đơn hàng + thống kê: admin, staff, viewer
router.get(
  '/supply-orders',
  authorize('admin', 'staff', 'viewer'),
  validate(querySupplyOrderSchema, 'query'),
  supplyController.getSupplyOrders
);

// 5. Chi tiết đơn hàng: admin, staff, viewer
router.get(
  '/supply-orders/:id',
  authorize('admin', 'staff', 'viewer'),
  supplyController.getSupplyOrderById
);

// 6. Bàn giao nhu yếu phẩm (ready -> delivered): admin, staff
router.patch(
  '/supply-orders/:id/deliver',
  authorize('admin', 'staff'),
  supplyController.deliverSupplyOrder
);

// 7. Hủy đơn hàng (pending_payment -> cancelled): admin, staff
router.patch(
  '/supply-orders/:id/cancel',
  authorize('admin', 'staff'),
  validate(cancelSupplyOrderSchema),
  supplyController.cancelSupplyOrder
);

module.exports = router;

/**
 * Mongoose Schema cho Đơn đặt mua nhu yếu phẩm (SupplyOrder).
 * Tuân thủ theo DATA-SCHEMA.md §3.16 và 03-PHAN-TICH-NGHIEP-VU.md BR-91 → BR-97.
 */

const mongoose = require('mongoose');
const { SUPPLY_ORDER_STATUS } = require('../../shared/constants/enums');

const orderItemSchema = new mongoose.Schema(
  {
    supplyItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplyItem',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const supplyOrderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        (arr) => Array.isArray(arr) && arr.length > 0,
        'Đơn hàng phải có ít nhất một vật phẩm',
      ],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: SUPPLY_ORDER_STATUS,
      default: 'pending_payment',
    },
    cancelReason: {
      type: String,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

supplyOrderSchema.index({ studentId: 1, status: 1 });
supplyOrderSchema.index({ status: 1, createdAt: -1 });
supplyOrderSchema.index({ invoiceId: 1 });

module.exports = mongoose.model('SupplyOrder', supplyOrderSchema);

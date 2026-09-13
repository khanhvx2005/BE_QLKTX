/**
 * Mongoose Schema cho collection Invoices.
 * Quản lý hóa đơn thu tiền của từng sinh viên (tiền phòng, tiền điện nước, cọc, quyết toán).
 * Tuân thủ theo DATA-SCHEMA.md §3.10.
 */

const mongoose = require('mongoose');
const { INVOICE_STATUS, INVOICE_TYPE } = require('../../shared/constants/enums');

const invoiceItemSchema = new mongoose.Schema(
  {
    feeTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeType',
    },
    name: {
      type: String,
      required: [true, 'Tên khoản phí là bắt buộc'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    unit: {
      type: String,
      default: '',
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Đơn giá không được âm'],
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Thành tiền không được âm'],
    },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceCode: {
      type: String,
      required: [true, 'Mã hóa đơn là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Sinh viên là bắt buộc'],
    },
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
    },
    billingPeriod: {
      type: String,
      default: null, // YYYY-MM với hóa đơn định kỳ hàng tháng; null với cọc/phát sinh
    },
    type: {
      type: String,
      enum: {
        values: INVOICE_TYPE,
        message: 'Loại hóa đơn {VALUE} không hợp lệ',
      },
      default: 'monthly',
    },
    items: {
      type: [invoiceItemSchema],
      required: [true, 'Chi tiết hóa đơn không được rỗng'],
      validate: [
        (val) => Array.isArray(val) && val.length > 0,
        'Hóa đơn phải có ít nhất 1 dòng chi tiết',
      ],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Tổng tiền là bắt buộc'],
      min: [0, 'Tổng tiền không được âm'],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Số tiền đã trả không được âm'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Hạn thanh toán là bắt buộc'],
    },
    status: {
      type: String,
      enum: {
        values: INVOICE_STATUS,
        message: 'Trạng thái hóa đơn {VALUE} không hợp lệ',
      },
      default: 'unpaid',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

invoiceSchema.index({ studentId: 1, status: 1 });
invoiceSchema.index({ billingPeriod: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;

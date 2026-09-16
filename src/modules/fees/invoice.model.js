/**
 * Mongoose Schema cho collection Invoices (DATA-SCHEMA.md §3.10, API.md §7).
 * Quản lý hóa đơn thu tiền của từng sinh viên.
 */

const mongoose = require('mongoose');
const { INVOICE_STATUS, INVOICE_TYPE } = require('../../shared/constants/enums');

const lineItemSchema = new mongoose.Schema(
  {
    feeTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeType',
      default: null,
    },
    description: {
      type: String,
      required: [true, 'Mô tả khoản thu là bắt buộc'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'Số lượng tối thiểu là 1'],
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
      default: null,
    },
    billingPeriod: {
      type: String,
      default: null, // YYYY-MM với hóa đơn định kỳ; null với cọc/quyết toán/nhu yếu phẩm
    },
    type: {
      type: String,
      enum: {
        values: INVOICE_TYPE,
        message: 'Loại hóa đơn {VALUE} không hợp lệ',
      },
      default: 'monthly',
    },
    lineItems: {
      type: [lineItemSchema],
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
      min: [0, 'Số tiền đã thanh toán không được âm'],
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
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        ret.remainingAmount = Math.max(0, ret.totalAmount - (ret.paidAmount || 0));
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

invoiceSchema.index({ studentId: 1, status: 1 });
invoiceSchema.index({ billingPeriod: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;

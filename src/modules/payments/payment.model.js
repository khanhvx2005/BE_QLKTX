/**
 * Mongoose Schema cho collection Payments (DATA-SCHEMA.md §3.11, API.md §8).
 * Quản lý lịch sử các giao dịch thu tiền và hoàn cọc.
 */

const mongoose = require('mongoose');
const { PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TYPE } = require('../../shared/constants/enums');

const paymentSchema = new mongoose.Schema(
  {
    transactionRef: {
      type: String,
      required: [true, 'Mã tham chiếu thanh toán là bắt buộc'],
      unique: true,
      trim: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Sinh viên là bắt buộc'],
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền là bắt buộc'],
      min: [1, 'Số tiền tối thiểu là 1 VNĐ'],
    },
    type: {
      type: String,
      enum: {
        values: PAYMENT_TYPE,
        message: 'Loại thanh toán {VALUE} không hợp lệ (payment hoặc refund)',
      },
      default: 'payment',
    },
    method: {
      type: String,
      enum: {
        values: PAYMENT_METHOD,
        message: 'Phương thức thanh toán {VALUE} không hợp lệ',
      },
      required: [true, 'Phương thức thanh toán là bắt buộc'],
    },
    bankReference: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    gatewayTransactionId: {
      type: String,
      default: null,
    },
    gatewayRawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: PAYMENT_STATUS,
        message: 'Trạng thái thanh toán {VALUE} không hợp lệ',
      },
      default: 'pending',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    recordedBy: {
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
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ studentId: 1 });
paymentSchema.index({ paidAt: 1 });
paymentSchema.index({ gatewayTransactionId: 1 }, { unique: true, sparse: true });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

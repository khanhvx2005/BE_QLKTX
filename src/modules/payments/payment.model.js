/**
 * Mongoose Schema cho collection Payments.
 * Quản lý lịch sử các giao dịch thanh toán (tiền mặt, VNPay).
 * Tuân thủ theo DATA-SCHEMA.md §3.11 và API.md §8.
 */

const mongoose = require('mongoose');
const { PAYMENT_METHOD, PAYMENT_STATUS } = require('../../shared/constants/enums');

const paymentSchema = new mongoose.Schema(
  {
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
    type: {
      type: String,
      enum: {
        values: ['payment', 'refund'],
        message: 'Loại thanh toán {VALUE} không hợp lệ',
      },
      default: 'payment',
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền thanh toán là bắt buộc'],
      min: [1000, 'Số tiền thanh toán tối thiểu là 1.000 VNĐ'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHOD,
        message: 'Phương thức thanh toán {VALUE} không hợp lệ',
      },
      required: [true, 'Phương thức thanh toán là bắt buộc'],
    },
    transactionRef: {
      type: String,
      unique: true,
      sparse: true, // Mã tham chiếu thanh toán ví dụ PAY202610...
    },
    transactionId: {
      type: String,
      default: null, // Mã giao dịch trả về từ cổng VNPay (vnp_TransactionNo) hoặc số phiếu thu tiền mặt
    },
    orderInfo: {
      type: String,
      default: '',
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
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Nhân viên ghi nhận nếu là tiền mặt
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

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

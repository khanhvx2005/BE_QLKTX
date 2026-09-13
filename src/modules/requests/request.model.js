/**
 * Mongoose Schema cho collection Requests.
 * Quản lý các yêu cầu tự phục vụ của sinh viên: Gia hạn hợp đồng (renewal) và Trả phòng (checkout).
 * Tuân thủ theo DATA-SCHEMA.md §3.12, §4 và API.md §9.
 */

const mongoose = require('mongoose');
const { REQUEST_TYPE, REQUEST_STATUS } = require('../../shared/constants/enums');

const settlementSchema = new mongoose.Schema(
  {
    outstandingDebt: {
      type: Number,
      default: 0, // Tổng nợ các hóa đơn chưa đóng
    },
    depositAmount: {
      type: Number,
      default: 0, // Tiền cọc ban đầu của hợp đồng
    },
    refundAmount: {
      type: Number,
      default: 0, // Số tiền cọc hoàn lại cho sinh viên
    },
    studentStillOwes: {
      type: Number,
      default: 0, // Số tiền sinh viên còn phải đóng thêm nếu cọc không đủ bù nợ
    },
    settlementInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    refundPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Sinh viên là bắt buộc'],
    },
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: [true, 'Hợp đồng liên quan là bắt buộc'],
    },
    type: {
      type: String,
      enum: {
        values: REQUEST_TYPE,
        message: 'Loại yêu cầu {VALUE} không hợp lệ (chỉ chấp nhận renewal hoặc checkout)',
      },
      required: [true, 'Loại yêu cầu là bắt buộc'],
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    requestedEndDate: {
      type: Date,
      required: [true, 'Ngày dự kiến kết thúc/trả phòng là bắt buộc'],
    },
    status: {
      type: String,
      enum: {
        values: REQUEST_STATUS,
        message: 'Trạng thái yêu cầu {VALUE} không hợp lệ',
      },
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    settlement: {
      type: settlementSchema,
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

// 1. Chỉ mục tra cứu cho hàng đợi xử lý của nhân viên
requestSchema.index({ status: 1, type: 1 });

// 2. Chống gửi nhiều yêu cầu cùng loại đang pending trên cùng 1 hợp đồng (DATA-SCHEMA.md §3.12, BR-pending)
requestSchema.index(
  { contractId: 1, type: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// 3. Chỉ mục tra cứu theo sinh viên
requestSchema.index({ studentId: 1, status: 1 });

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;

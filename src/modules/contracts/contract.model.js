/**
 * Mongoose Schema cho collection Contracts.
 * Quản lý thông tin hợp đồng thuê phòng KTX theo DATA-SCHEMA.md §3.7 và API.md §6.
 */

const mongoose = require('mongoose');
const { CONTRACT_STATUS } = require('../../shared/constants/enums');

const contractHistorySchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: [
        'application_submitted',
        'application_approved',
        'request_renewal',
        'request_checkout',
        'terminated',
        'expired',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const contractSchema = new mongoose.Schema(
  {
    contractCode: {
      type: String,
      required: [true, 'Mã hợp đồng là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    residencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Residency',
      required: [true, 'Bản ghi lưu trú là bắt buộc'],
      unique: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Sinh viên là bắt buộc'],
    },
    bedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
      required: [true, 'Giường là bắt buộc'],
    },
    startDate: {
      type: Date,
      required: [true, 'Ngày bắt đầu hợp đồng là bắt buộc'],
    },
    endDate: {
      type: Date,
      required: [true, 'Ngày kết thúc hợp đồng là bắt buộc'],
    },
    monthlyPrice: {
      type: Number,
      required: [true, 'Đơn giá thuê phòng theo tháng là bắt buộc'],
      min: [0, 'Đơn giá thuê không được âm'],
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tiền cọc không được âm'],
    },
    depositRefunded: {
      type: Number,
      default: 0,
      min: [0, 'Tiền cọc hoàn trả không được âm'],
    },
    terms: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: CONTRACT_STATUS,
        message: 'Trạng thái hợp đồng {VALUE} không hợp lệ',
      },
      default: 'active',
    },
    terminationReason: {
      type: String,
      default: null,
    },
    terminatedAt: {
      type: Date,
      default: null,
    },
    history: {
      type: [contractHistorySchema],
      default: [],
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

contractSchema.index({ studentId: 1, status: 1 });
contractSchema.index({ endDate: 1 });

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;

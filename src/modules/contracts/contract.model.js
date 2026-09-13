/**
 * Mongoose Schema cho collection Contracts.
 * Quản lý thông tin hợp đồng thuê phòng KTX.
 * Tuân thủ theo DATA-SCHEMA.md §3.7.
 */

const mongoose = require('mongoose');
const { CONTRACT_STATUS } = require('../../shared/constants/enums');

const DEPOSIT_STATUS = ['pending', 'paid', 'refunded', 'forfeited'];

const contractSchema = new mongoose.Schema(
  {
    contractNumber: {
      type: String,
      required: [true, 'Số hợp đồng là bắt buộc'],
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
    startDate: {
      type: Date,
      required: [true, 'Ngày bắt đầu hợp đồng là bắt buộc'],
    },
    endDate: {
      type: Date,
      required: [true, 'Ngày kết thúc hợp đồng là bắt buộc'],
    },
    roomFeeSnapshot: {
      type: Number,
      required: [true, 'Giá thuê phòng thời điểm ký HĐ là bắt buộc'],
      min: [0, 'Giá thuê phòng không được âm'],
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tiền cọc không được âm'],
    },
    depositStatus: {
      type: String,
      enum: {
        values: DEPOSIT_STATUS,
        message: 'Trạng thái tiền cọc {VALUE} không hợp lệ',
      },
      default: 'pending',
    },
    depositRefunded: {
      type: Number,
      default: 0,
      min: [0, 'Tiền cọc hoàn trả không được âm'],
    },
    status: {
      type: String,
      enum: {
        values: CONTRACT_STATUS,
        message: 'Trạng thái hợp đồng {VALUE} không hợp lệ',
      },
      default: 'pending',
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

contractSchema.index({ studentId: 1, status: 1 });

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;

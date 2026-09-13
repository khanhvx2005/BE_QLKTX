/**
 * Mongoose Schema cho collection Residencies.
 * Quản lý lịch sử và trạng thái cư trú của sinh viên trên từng giường.
 * Tuân thủ theo DATA-SCHEMA.md §3.6.
 */

const mongoose = require('mongoose');
const { RESIDENCY_STATUS } = require('../../shared/constants/enums');

const residencySchema = new mongoose.Schema(
  {
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
      required: [true, 'Ngày bắt đầu lưu trú là bắt buộc'],
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: RESIDENCY_STATUS,
        message: 'Trạng thái lưu trú {VALUE} không hợp lệ',
      },
      default: 'active',
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

// Indexes phục vụ tra cứu nhanh chỗ ở hiện tại
residencySchema.index({ studentId: 1, status: 1 });
residencySchema.index({ bedId: 1, status: 1 });

const Residency = mongoose.model('Residency', residencySchema);

module.exports = Residency;

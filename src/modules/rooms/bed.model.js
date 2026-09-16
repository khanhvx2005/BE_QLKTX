/**
 * Mongoose Schema cho collection Beds (DATA-SCHEMA.md §3.5).
 * Quản lý từng vị trí giường trong phòng.
 */

const mongoose = require('mongoose');
const { BED_STATUS } = require('../../shared/constants/enums');

const bedSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Phòng là bắt buộc'],
    },
    bedNumber: {
      type: Number,
      required: [true, 'Số thứ tự giường là bắt buộc'],
      min: [1, 'Số thứ tự giường tối thiểu là 1'],
    },
    bedCode: {
      type: String,
      required: [true, 'Mã giường là bắt buộc'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: BED_STATUS,
        message: 'Trạng thái giường {VALUE} không hợp lệ',
      },
      default: 'available',
    },
    note: {
      type: String,
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

// Compound Unique Index: Không thể có 2 giường trùng số thứ tự hoặc trùng mã trong cùng 1 phòng
bedSchema.index({ roomId: 1, bedNumber: 1 }, { unique: true });
bedSchema.index({ roomId: 1, bedCode: 1 }, { unique: true });

const Bed = mongoose.model('Bed', bedSchema);

module.exports = Bed;

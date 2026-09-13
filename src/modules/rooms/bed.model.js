/**
 * Mongoose Schema cho collection Beds.
 * Quản lý từng vị trí giường trong phòng.
 * Tuân thủ theo DATA-SCHEMA.md §3.5.
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
    status: {
      type: String,
      enum: {
        values: BED_STATUS,
        message: 'Trạng thái giường {VALUE} không hợp lệ',
      },
      default: 'available',
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

// Compound Unique Index: Không thể có 2 giường cùng số trong cùng 1 phòng
bedSchema.index({ roomId: 1, bedNumber: 1 }, { unique: true });

const Bed = mongoose.model('Bed', bedSchema);

module.exports = Bed;

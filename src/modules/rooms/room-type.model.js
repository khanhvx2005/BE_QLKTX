/**
 * Mongoose Schema cho collection RoomTypes (DATA-SCHEMA.md §3.4a, API.md §4).
 * Quản lý các loại phòng KTX (Tiêu chuẩn, Chất lượng cao...).
 */

const mongoose = require('mongoose');
const { ROOM_TYPE_TIER } = require('../../shared/constants/enums');

const roomTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên loại phòng là bắt buộc'],
      unique: true,
      trim: true,
      maxLength: [100, 'Tên loại phòng tối đa 100 ký tự'],
    },
    tier: {
      type: String,
      enum: {
        values: ROOM_TYPE_TIER,
        message: 'Hạng loại phòng {VALUE} không hợp lệ, chỉ chấp nhận standard hoặc premium',
      },
      required: [true, 'Hạng loại phòng là bắt buộc (standard hoặc premium)'],
    },
    capacity: {
      type: Number,
      required: [true, 'Sức chứa của loại phòng là bắt buộc'],
      min: [1, 'Sức chứa tối thiểu 1 người'],
      max: [20, 'Sức chứa tối đa 20 người'],
    },
    pricePerMonth: {
      type: Number,
      required: [true, 'Đơn giá thuê theo tháng là bắt buộc'],
      min: [0, 'Đơn giá thuê không được âm'],
    },
    depositAmount: {
      type: Number,
      required: [true, 'Số tiền cọc là bắt buộc'],
      min: [0, 'Số tiền cọc không được âm'],
    },
    amenities: {
      type: [String],
      default: [],
    },
    includedSupplies: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
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

const RoomType = mongoose.model('RoomType', roomTypeSchema);

module.exports = RoomType;

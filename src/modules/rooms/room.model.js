/**
 * Mongoose Schema cho collection Rooms (DATA-SCHEMA.md §3.4, API.md §4).
 * Quản lý thông tin phòng KTX theo mô hình v1.2 (gắn với RoomType, giường tự sinh).
 */

const mongoose = require('mongoose');
const { GENDER, ROOM_STATUS } = require('../../shared/constants/enums');

const roomSchema = new mongoose.Schema(
  {
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: [true, 'Tòa nhà là bắt buộc'],
    },
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType',
      required: [true, 'Loại phòng là bắt buộc'],
    },
    roomNumber: {
      type: String,
      required: [true, 'Số phòng là bắt buộc'],
      trim: true,
      maxLength: [20, 'Số phòng tối đa 20 ký tự'],
    },
    floor: {
      type: Number,
      required: [true, 'Tầng là bắt buộc'],
      min: [1, 'Tầng tối thiểu là 1'],
      default: 1,
    },
    gender: {
      type: String,
      enum: {
        values: GENDER,
        message: 'Giới tính phòng {VALUE} không hợp lệ, chỉ chấp nhận male hoặc female',
      },
      required: [true, 'Giới tính phòng là bắt buộc (nam hoặc nữ)'],
    },
    capacity: {
      type: Number,
      required: [true, 'Sức chứa của phòng là bắt buộc'],
      min: [1, 'Sức chứa tối thiểu 1 giường'],
      max: [20, 'Sức chứa tối đa 20 giường'],
    },
    status: {
      type: String,
      enum: {
        values: ROOM_STATUS,
        message: 'Trạng thái phòng {VALUE} không hợp lệ',
      },
      default: 'active',
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

// Compound Unique Index: Không thể có 2 phòng cùng số trong 1 tòa nhà
roomSchema.index({ buildingId: 1, roomNumber: 1 }, { unique: true });

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;

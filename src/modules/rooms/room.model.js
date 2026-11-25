/**
 * Phòng KTX — Quản lý gọn tới cấp Phòng (`capacity` và `occupiedCount`), không theo dõi từng vị trí giường.
 * Chống xếp quá sức chứa tuyệt đối bằng Atomic Update:
 *   Room.findOneAndUpdate({ _id, status: 'active', $expr: { $lt: ['$occupiedCount', '$capacity'] } }, { $inc: { occupiedCount: 1 } })
 */

const mongoose = require('mongoose');
const { GENDER, ROOM_TIERS, ROOM_STATUS, ROOM_CAPACITY } = require('../../shared/constants/enums');

const roomSchema = new mongoose.Schema(
  {
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    roomNumber: { type: String, required: true, trim: true, maxLength: 20 },
    floor: { type: Number, required: true, min: 1, default: 1 },
    /** Giới tính phòng động: null khi phòng đang trống (occupiedCount = 0), tự gán 'male'/'female' khi người đầu tiên vào và tự reset null khi người cuối rời phòng */
    gender: { type: String, enum: [...GENDER, null], default: null },
    roomTier: { type: String, enum: ROOM_TIERS, default: 'standard' },
    capacity: { type: Number, enum: ROOM_CAPACITY, required: true },
    /** Số chỗ đang có sinh viên ở hoặc đang giữ chỗ chờ đóng phí (0 <= occupiedCount <= capacity) */
    occupiedCount: { type: Number, default: 0, min: 0 },
    hasAirConditioner: { type: Boolean, default: false },
    hasWaterHeater: { type: Boolean, default: true },
    amenities: { type: [String], default: [] },
    pricePerMonth: { type: Number, required: true, min: 0 },
    depositAmount: { type: Number, required: true, min: 0, default: 500000 },
    status: { type: String, enum: ROOM_STATUS, default: 'active' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

roomSchema.virtual('availableSlots').get(function () {
  if (this.status === 'maintenance') return 0;
  return Math.max(0, (this.capacity || 0) - (this.occupiedCount || 0));
});

roomSchema.index({ buildingId: 1, roomNumber: 1 }, { unique: true });
roomSchema.index({ gender: 1, status: 1, occupiedCount: 1 });
roomSchema.index({ floor: 1, roomNumber: 1 });

module.exports = mongoose.model('Room', roomSchema);

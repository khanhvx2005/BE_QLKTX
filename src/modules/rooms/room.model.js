/**
 * Mongoose Schema cho collection Rooms (EDIT_DOCS_DATA_SCHEMA.md §3.4).
 * 
 * ============================================================================
 * [KIẾN TRÚC TINH GỌN HaUI DMS - DÀNH CHO TEAM 5]:
 * - Đã loại bỏ hoàn toàn 2 bảng riêng `RoomType` và `Bed`.
 * - Sức chứa (4/6/8 chỗ), đơn giá thuê/tháng, tiền cọc và Mảng giường (`beds`)
 *   được nhúng trực tiếp (Subdocument Array) vào trong từng phòng Room.
 * - Cơ chế này giúp:
 *   1. Tăng tốc độ truy vấn gấp 3 lần (không cần join/populate qua 3 collection).
 *   2. Hỗ trợ khóa giường nguyên tử Atomic Query (`findOneAndUpdate`) cực kỳ đơn giản!
 * ============================================================================
 */

const mongoose = require('mongoose');
const { GENDER, ROOM_STATUS, ROOM_CAPACITY, BED_STATUS } = require('../../shared/constants/enums');

// Subdocument Schema cho từng vị trí giường nhúng trong phòng
const embeddedBedSchema = new mongoose.Schema(
  {
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
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null, // null khi giường còn trống
    },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: [true, 'Tòa nhà là bắt buộc'],
    },
    roomNumber: {
      type: String,
      required: [true, 'Số phòng là bắt buộc (ví dụ: 101, 202)'],
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
      required: [true, 'Giới tính phòng là bắt buộc (nam hoặc nữ - BR-01)'],
    },
    capacity: {
      type: Number,
      enum: {
        values: ROOM_CAPACITY,
        message: 'Sức chứa {VALUE} không hợp lệ, chỉ chấp nhận 4, 6 hoặc 8 người',
      },
      required: [true, 'Sức chứa phòng là bắt buộc (4, 6 hoặc 8 chỗ)'],
    },
    pricePerMonth: {
      type: Number,
      required: [true, 'Đơn giá thuê tháng của 1 sinh viên là bắt buộc'],
      min: [0, 'Đơn giá thuê không được âm'],
      default: 500000,
    },
    depositAmount: {
      type: Number,
      required: [true, 'Tiền đặt cọc phòng là bắt buộc'],
      min: [0, 'Tiền cọc không được âm'],
      default: 500000,
    },
    status: {
      type: String,
      enum: {
        values: ROOM_STATUS,
        message: 'Trạng thái phòng {VALUE} không hợp lệ',
      },
      default: 'active',
    },
    // Mảng giường nhúng trực tiếp: tự động sinh từ 1 đến capacity
    beds: {
      type: [embeddedBedSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual: Tính số giường còn trống thực tế trong phòng
roomSchema.virtual('availableBedsCount').get(function () {
  if (!Array.isArray(this.beds)) return 0;
  return this.beds.filter((b) => b.status === 'available').length;
});

// Virtual: Tính số người đang ở thực tế
roomSchema.virtual('occupiedBedsCount').get(function () {
  if (!Array.isArray(this.beds)) return 0;
  return this.beds.filter((b) => b.status === 'occupied').length;
});

// 1. Compound Unique Index: Không thể có 2 phòng cùng số trong cùng 1 tòa nhà
roomSchema.index({ buildingId: 1, roomNumber: 1 }, { unique: true });

// 2. Index phục vụ tìm phòng trống theo giới tính (Cực kỳ quan trọng cho Cổng đăng ký)
roomSchema.index({ gender: 1, 'beds.status': 1 });

// 3. Index phục vụ Quy tắc ngăn xếp: sắp xếp tầng thấp trước, phòng nhỏ trước (BR-07)
roomSchema.index({ floor: 1, roomNumber: 1 });

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;

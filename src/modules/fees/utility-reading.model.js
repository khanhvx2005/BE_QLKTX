/**
 * Chỉ số điện nước một phòng một tháng — API.md §7.
 * Đơn giá lưu trên từng bản ghi (D4: không có bảng cấu hình giá). Chốt (`isBilled`) thì khóa, không sửa nữa.
 */

const mongoose = require('mongoose');
const toJSON = require('../../shared/to-json');

const meterSchema = new mongoose.Schema(
  {
    oldIndex: { type: Number, required: true, min: 0 },
    newIndex: { type: Number, required: true, min: 0 },
    usage: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const utilityReadingSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    monthYear: { type: String, required: true },
    electricity: { type: meterSchema, required: true },
    water: { type: meterSchema, required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    // Chỉ chốt lúc phát hành (số người tại thời điểm chốt) — để tham khảo, hóa đơn là của cả phòng (BR-03)
    occupantsCount: { type: Number, default: null },
    perStudentAmount: { type: Number, default: null },
    isBilled: { type: Boolean, default: false },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recordedByName: { type: String, default: null },
    recordedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON }
);

utilityReadingSchema.index({ roomId: 1, monthYear: 1 }, { unique: true });

module.exports = mongoose.model('UtilityReading', utilityReadingSchema);

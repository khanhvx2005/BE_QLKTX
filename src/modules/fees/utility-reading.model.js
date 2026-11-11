/**
 * Mongoose Schema cho collection UtilityReadings (EDIT_DOCS_DATA_SCHEMA.md §3.6).
 * Quản lý chỉ số đồng hồ điện, nước chốt định kỳ theo từng phòng KTX HaUI hàng tháng.
 */

const mongoose = require('mongoose');

const utilityReadingSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Phòng KTX là bắt buộc'],
    },
    monthYear: {
      type: String,
      required: [true, 'Tháng năm ghi số là bắt buộc (định dạng YYYY-MM)'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng năm phải có định dạng YYYY-MM (ví dụ: 2026-10)'],
    },
    // Chi tiết chỉ số điện
    electricity: {
      oldIndex: { type: Number, required: true, min: 0 },
      newIndex: { type: Number, required: true, min: 0 },
      usage: { type: Number, required: true, min: 0 },
      unitPrice: { type: Number, required: true, min: 0, default: 2500 },
      amount: { type: Number, required: true, min: 0 },
    },
    // Chi tiết chỉ số nước
    water: {
      oldIndex: { type: Number, required: true, min: 0 },
      newIndex: { type: Number, required: true, min: 0 },
      usage: { type: Number, required: true, min: 0 },
      unitPrice: { type: Number, required: true, min: 0, default: 12000 },
      amount: { type: Number, required: true, min: 0 },
    },
    // Tổng tiền điện + nước của cả phòng
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Số lượng sinh viên đang cư trú thực tế tại thời điểm chốt số
    occupantsCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    // Số tiền gợi ý chia bình quân mỗi sinh viên: totalAmount / occupantsCount (BR-03)
    perStudentAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    // Cờ đánh dấu đã phát hành hóa đơn phòng chưa
    isBilled: {
      type: Boolean,
      default: false,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

// Mỗi phòng KTX chỉ ghi nhận duy nhất 1 bản ghi chỉ số trong 1 tháng
utilityReadingSchema.index({ roomId: 1, monthYear: 1 }, { unique: true });

const UtilityReading = mongoose.model('UtilityReading', utilityReadingSchema);

module.exports = UtilityReading;

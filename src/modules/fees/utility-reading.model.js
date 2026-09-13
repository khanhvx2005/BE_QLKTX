/**
 * Mongoose Schema cho collection UtilityReadings.
 * Quản lý chỉ số đồng hồ điện, nước ghi theo từng phòng hàng tháng.
 * Tuân thủ theo DATA-SCHEMA.md §3.9 và PRD.md §2.9 (Quy tắc A2).
 */

const mongoose = require('mongoose');

const utilityReadingSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Phòng là bắt buộc'],
    },
    billingPeriod: {
      type: String,
      required: [true, 'Kỳ ghi điện nước là bắt buộc (định dạng YYYY-MM)'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ ghi điện nước phải có định dạng YYYY-MM (ví dụ 2026-10)'],
    },
    electricityStart: {
      type: Number,
      required: [true, 'Chỉ số điện đầu kỳ là bắt buộc'],
      min: [0, 'Chỉ số điện không được âm'],
    },
    electricityEnd: {
      type: Number,
      required: [true, 'Chỉ số điện cuối kỳ là bắt buộc'],
      min: [0, 'Chỉ số điện không được âm'],
    },
    waterStart: {
      type: Number,
      required: [true, 'Chỉ số nước đầu kỳ là bắt buộc'],
      min: [0, 'Chỉ số nước không được âm'],
    },
    waterEnd: {
      type: Number,
      required: [true, 'Chỉ số nước cuối kỳ là bắt buộc'],
      min: [0, 'Chỉ số nước không được âm'],
    },
    electricityConsumption: {
      type: Number,
      required: true,
      min: [0, 'Lượng điện tiêu thụ không được âm'],
    },
    waterConsumption: {
      type: Number,
      required: true,
      min: [0, 'Lượng nước tiêu thụ không được âm'],
    },
    electricityUnitPrice: {
      type: Number,
      required: true,
      min: [0, 'Đơn giá điện không được âm'],
    },
    waterUnitPrice: {
      type: Number,
      required: true,
      min: [0, 'Đơn giá nước không được âm'],
    },
    electricityAmount: {
      type: Number,
      required: true,
      min: [0, 'Tiền điện không được âm'],
    },
    waterAmount: {
      type: Number,
      required: true,
      min: [0, 'Tiền nước không được âm'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Tổng tiền điện nước không được âm'],
    },
    isInvoiced: {
      type: Boolean,
      default: false, // true sau khi đã phát hành hóa đơn cho sinh viên
    },
    recordedBy: {
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

// Compound Unique Index: Mỗi phòng chỉ có duy nhất 1 bản ghi chỉ số điện nước trong 1 kỳ
utilityReadingSchema.index({ roomId: 1, billingPeriod: 1 }, { unique: true });

const UtilityReading = mongoose.model('UtilityReading', utilityReadingSchema);

module.exports = UtilityReading;

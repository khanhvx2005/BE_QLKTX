/**
 * Mongoose Schema cho collection FeeTypes.
 * Quản lý danh mục các loại phí (tiền phòng, điện, nước, internet...).
 * Tuân thủ theo DATA-SCHEMA.md §3.8.
 */

const mongoose = require('mongoose');

const feeTypeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Mã loại phí là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Tên loại phí là bắt buộc'],
      trim: true,
      maxLength: [100, 'Tên loại phí tối đa 100 ký tự'],
    },
    unit: {
      type: String,
      required: [true, 'Đơn vị tính là bắt buộc (ví dụ: kWh, m3, tháng, người)'],
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: [true, 'Đơn giá là bắt buộc'],
      min: [0, 'Đơn giá không được âm'],
    },
    isMetered: {
      type: Boolean,
      default: false, // true nếu tính theo chỉ số đồng hồ (điện/nước)
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

const FeeType = mongoose.model('FeeType', feeTypeSchema);

module.exports = FeeType;

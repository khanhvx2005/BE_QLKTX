/**
 * Mongoose Schema cho collection FeeTypes (DATA-SCHEMA.md §3.8).
 * Quản lý danh mục các loại phí trong hệ thống.
 */

const mongoose = require('mongoose');
const { FEE_TYPE_CODES } = require('../../shared/constants/enums');

const feeTypeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Mã loại phí là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
      enum: {
        values: FEE_TYPE_CODES,
        message: 'Mã loại phí {VALUE} không hợp lệ',
      },
    },
    name: {
      type: String,
      required: [true, 'Tên loại phí là bắt buộc'],
      trim: true,
      maxLength: [100, 'Tên loại phí tối đa 100 ký tự'],
    },
    unit: {
      type: String,
      required: [true, 'Đơn vị tính là bắt buộc (ví dụ: kWh, m3, tháng, lần)'],
      trim: true,
    },
    defaultAmount: {
      type: Number,
      required: [true, 'Đơn giá mặc định là bắt buộc'],
      min: [0, 'Đơn giá không được âm'],
    },
    isRecurring: {
      type: Boolean,
      default: true, // true cho tiền phòng/điện nước định kỳ, false cho cọc/một lần
    },
    isActive: {
      type: Boolean,
      default: true,
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

const SYSTEM_FEE_CODES = ['rent', 'electricity', 'water', 'deposit', 'supplies', 'other'];

feeTypeSchema.virtual('isSystem').get(function () {
  return SYSTEM_FEE_CODES.includes(this.code);
});

const FeeType = mongoose.model('FeeType', feeTypeSchema);

module.exports = FeeType;

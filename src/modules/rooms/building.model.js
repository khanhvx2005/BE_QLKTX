/**
 * Mongoose Schema cho collection Buildings.
 * Quản lý danh mục tòa nhà ký túc xá.
 * Tuân thủ theo DATA-SCHEMA.md §3.3.
 */

const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Mã tòa nhà là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
      maxLength: [10, 'Mã tòa nhà tối đa 10 ký tự'],
    },
    name: {
      type: String,
      required: [true, 'Tên tòa nhà là bắt buộc'],
      trim: true,
      maxLength: [100, 'Tên tòa nhà tối đa 100 ký tự'],
    },
    address: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
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

const Building = mongoose.model('Building', buildingSchema);

module.exports = Building;

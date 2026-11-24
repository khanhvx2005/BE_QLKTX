/**
 * Tòa nhà KTX (K1, K2, K3, K4...) — DATA-SCHEMA.md §3.3, API.md §4.
 */

const mongoose = require('mongoose');
const toJSON = require('../../shared/to-json');

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
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, toJSON }
);

module.exports = mongoose.model('Building', buildingSchema);

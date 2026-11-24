/**
 * Tòa nhà KTX gắn 3 Cơ sở ĐH Công nghiệp Hà Nội (A14-A15, B12-B14, C15-C17).
 * EDIT_DOCS_DATA_SCHEMA.md §3.3, API.md §4.
 */

const mongoose = require('mongoose');
const { CAMPUSES } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const buildingSchema = new mongoose.Schema(
  {
    campus: {
      type: String,
      enum: CAMPUSES,
      required: [true, 'Cơ sở trực thuộc là bắt buộc (cs1, cs2 hoặc cs3)'],
    },
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
    totalFloors: {
      type: Number,
      default: 5,
      min: 1,
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

buildingSchema.index({ campus: 1, code: 1 });

module.exports = mongoose.model('Building', buildingSchema);

/**
 * Mongoose Schema cho Vật phẩm nhu yếu phẩm (SupplyItem).
 * Tuân thủ theo DATA-SCHEMA.md §3.15 và 03-PHAN-TICH-NGHIEP-VU.md BR-90.
 */

const mongoose = require('mongoose');
const { SUPPLY_CATEGORY } = require('../../shared/constants/enums');

const supplyItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: SUPPLY_CATEGORY,
      required: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: null,
    },
    includedInRoomTypes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RoomType',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

supplyItemSchema.index({ category: 1, isActive: 1 });
supplyItemSchema.index({ name: 'text' });

module.exports = mongoose.model('SupplyItem', supplyItemSchema);

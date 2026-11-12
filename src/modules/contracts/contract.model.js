/**
 * Hợp đồng lưu trú — gộp cả đơn đăng ký (`pending`) và đơn bị từ chối (`rejected`). API.md §6.
 *
 * ⚠️ `expired` KHÔNG lưu: hợp đồng `active` đã qua `endDate` được TRẢ RA là `expired` (contract.view.js).
 *    Hợp đồng quá hạn vẫn giữ giường cho tới khi thanh lý (BR-04). Đừng thêm job đổi trạng thái / trả giường.
 * Ngày chỉ có ngày (`startDate`, `endDate`, `terminatedAt`) lưu chuỗi `YYYY-MM-DD`.
 */

const mongoose = require('mongoose');
const { CONTRACT_TERMS, CONTRACT_STATUS } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });

const contractSchema = new mongoose.Schema(
  {
    contractCode: { type: String, required: true, unique: true, trim: true },
    studentId: { ...ref('Student'), required: true },
    roomId: { ...ref('Room'), required: true },
    bedNumber: { type: Number, required: true, min: 1 },
    term: { type: String, enum: CONTRACT_TERMS, required: true },
    status: { type: String, enum: CONTRACT_STATUS, default: 'pending' },

    // Giá chốt tại thời điểm nộp đơn, chốt lại theo phòng cuối cùng lúc duyệt
    pricePerMonth: { type: Number, required: true, min: 0 },
    totalRoomFee: { type: Number, required: true, min: 0 },
    depositAmount: { type: Number, required: true, min: 0 },

    // Đặt khi duyệt (pending thì để trống)
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },

    reviewedAt: { type: Date, default: null },
    reviewedBy: ref('User'),
    reviewedByName: { type: String, default: null },
    rejectionReason: { type: String, default: null },

    terminatedAt: { type: String, default: null },

    // FR-35, BR-08: hoàn cọc tại văn phòng sau thanh lý — xác nhận một chiều, một lần, hoàn đủ
    isDepositRefunded: { type: Boolean, default: false },
    depositRefundedAt: { type: Date, default: null },
    depositRefundedBy: ref('User'),
    depositRefundedByName: { type: String, default: null },
  },
  { timestamps: true, toJSON }
);

contractSchema.index({ studentId: 1, status: 1 });
contractSchema.index({ roomId: 1, bedNumber: 1, status: 1 });

module.exports = mongoose.model('Contract', contractSchema);

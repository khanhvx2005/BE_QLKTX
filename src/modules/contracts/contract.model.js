/**
 * Đơn đăng ký & Hợp đồng lưu trú — EDIT_DOCS_DATA_SCHEMA.md §3.6.
 * Vòng đời v3.0:
 *   pending (chưa gắn cứng phòng — chỉ lưu đợt, cơ sở, nguyện vọng loại phòng & kỳ hạn)
 *     -> pending_payment (tự động xếp phòng tầng thấp -> cao đúng giới tính, khóa 1 chỗ, hạn 7 ngày)
 *     -> active (đóng đủ phí + sinh QR Check-in)
 *     -> terminated (thanh lý sạch nợ + hoàn cọc)
 *   pending -> rejected / cancelled (SV tự hủy)
 *   pending_payment -> cancelled (quá hạn đóng phí, hủy 2 HĐ nháp + nhả chỗ ngay)
 */

const mongoose = require('mongoose');
const { CONTRACT_TERMS, CONTRACT_STATUS, CAMPUS_SCOPE, ROOM_TIERS } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });

const contractSchema = new mongoose.Schema(
  {
    contractCode: { type: String, required: true, unique: true, trim: true },
    periodId: ref('RegistrationPeriod'),
    studentId: { ...ref('Student'), required: true },
    /** Chỉ bắt buộc khi đã được duyệt xếp phòng (`pending_payment` / `active`); khi `pending` có thể để null để tự động xếp từ tầng thấp lên cao */
    roomId: ref('Room'),
    /** Cơ sở của đơn đăng ký (giữ lại ngay cả khi `roomId` chưa gán ở trạng thái `pending`) */
    campus: { type: String, enum: [...CAMPUS_SCOPE, null], default: null },
    /** Nguyện vọng loại phòng sinh viên chọn khi đăng ký (không chọn từng số phòng) */
    preferredRoomTier: { type: String, enum: [...ROOM_TIERS, null], default: null },
    preferredCapacity: { type: Number, default: null },
    term: { type: String, enum: CONTRACT_TERMS, required: true },
    status: { type: String, enum: CONTRACT_STATUS, default: 'pending' },

    pricePerMonth: { type: Number, required: true, min: 0 },
    totalRoomFee: { type: Number, required: true, min: 0 },
    depositAmount: { type: Number, required: true, min: 0 },

    /** Hạn đóng phí giữ chỗ khi ở trạng thái pending_payment ('YYYY-MM-DD') */
    paymentDeadline: { type: String, default: null },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },

    /** QR Check-in nhận phòng (sinh tự động khi chuyển sang active) */
    checkinCode: { type: String, default: null, trim: true },
    checkedInAt: { type: Date, default: null },
    checkedInBy: ref('User'),
    checkedInByName: { type: String, default: null },

    reviewedAt: { type: Date, default: null },
    reviewedBy: ref('User'),
    reviewedByName: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    cancelReason: { type: String, default: null },

    terminatedAt: { type: String, default: null },

    /** Hoàn cọc có khấu trừ hỏng tài sản (BR-04, BR-08) */
    isDepositRefunded: { type: Boolean, default: false },
    depositDeductionAmount: { type: Number, default: 0, min: 0 },
    depositRefundAmount: { type: Number, default: 0, min: 0 },
    depositRefundReason: { type: String, default: null },
    depositRefundedAt: { type: Date, default: null },
    depositRefundedBy: ref('User'),
    depositRefundedByName: { type: String, default: null },
  },
  { timestamps: true, toJSON }
);

contractSchema.index({ studentId: 1, status: 1 });
contractSchema.index({ roomId: 1, status: 1 });
contractSchema.index({ periodId: 1, status: 1 });
contractSchema.index({ checkinCode: 1 }, { unique: true, partialFilterExpression: { checkinCode: { $type: 'string' } } });

module.exports = mongoose.model('Contract', contractSchema);

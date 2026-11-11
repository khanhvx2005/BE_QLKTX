/**
 * Mongoose Schema cho collection Contracts (EDIT_DOCS_DATA_SCHEMA.md §3.5).
 * 
 * ============================================================================
 * [KIẾN TRÚC TINH GỌN HaUI DMS - DÀNH CHO TEAM 5]:
 * - Hợp nhất toàn diện: Đơn đăng ký Online (Application) và Hợp đồng lưu trú (Contract).
 *   + Khi sinh viên nộp đơn online: status = 'pending'.
 *   + Khi cán bộ duyệt đơn: status = 'active' (đồng thời khóa giường nguyên tử).
 *   + Khi hết hạn hoặc trả phòng: status = 'terminated'.
 * - Quản lý trọn gói theo Kỳ (6 tháng hoặc 12 tháng).
 * - [ĐẶC BIỆT - NGHIỆP VỤ HOÀN TIỀN CỌC]:
 *   + Tích hợp đầy đủ các trường quản lý hoàn cọc khi trả phòng: `depositStatus`,
 *     `depositRefundAmount`, `depositDeductionAmount`, `depositRefundReason`.
 * ============================================================================
 */

const mongoose = require('mongoose');
const { CONTRACT_TERMS, CONTRACT_STATUS, DEPOSIT_STATUS } = require('../../shared/constants/enums');

const contractSchema = new mongoose.Schema(
  {
    contractCode: {
      type: String,
      required: [true, 'Mã hợp đồng là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Sinh viên là bắt buộc'],
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Phòng KTX là bắt buộc'],
    },
    bedNumber: {
      type: Number,
      required: [true, 'Vị trí giường trong phòng là bắt buộc'],
      min: [1, 'Số thứ tự giường tối thiểu là 1'],
    },
    term: {
      type: String,
      enum: {
        values: CONTRACT_TERMS,
        message: 'Kỳ hạn hợp đồng {VALUE} không hợp lệ, chỉ chấp nhận 6_months hoặc 12_months',
      },
      required: [true, 'Kỳ hạn hợp đồng là bắt buộc (6_months hoặc 12_months)'],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    pricePerMonth: {
      type: Number,
      required: [true, 'Đơn giá thuê tháng là bắt buộc'],
      min: [0, 'Đơn giá thuê không được âm'],
    },
    totalRoomFee: {
      type: Number,
      required: [true, 'Tổng tiền phòng cả kỳ là bắt buộc'],
      min: [0, 'Tổng tiền phòng không được âm'],
    },
    depositAmount: {
      type: Number,
      required: [true, 'Tiền cọc phòng là bắt buộc'],
      min: [0, 'Tiền cọc không được âm'],
      default: 500000,
    },

    // ========================================================================
    // QUẢN LÝ TIỀN CỌC & HOÀN CỌC KHI OUT KTX (THEO YÊU CẦU ĐẶC TẢ MỚI)
    // ========================================================================
    depositStatus: {
      type: String,
      enum: {
        values: DEPOSIT_STATUS,
        message: 'Trạng thái tiền cọc {VALUE} không hợp lệ',
      },
      default: 'unpaid', // unpaid -> paid -> refunded (hoặc forfeited)
    },
    depositRefundAmount: {
      type: Number,
      default: 0,
      min: [0, 'Số tiền cọc hoàn trả không được âm'],
    },
    depositDeductionAmount: {
      type: Number,
      default: 0,
      min: [0, 'Số tiền khấu trừ không được âm'],
    },
    depositRefundReason: {
      type: String,
      default: '',
      trim: true,
    },
    depositRefundedAt: {
      type: Date,
      default: null,
    },
    depositRefundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ========================================================================
    // TRẠNG THÁI HỢP ĐỒNG & PHÊ DUYỆT
    // ========================================================================
    status: {
      type: String,
      enum: {
        values: CONTRACT_STATUS,
        message: 'Trạng thái hợp đồng {VALUE} không hợp lệ',
      },
      default: 'pending', // pending -> active -> expired -> terminated
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
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

contractSchema.index({ studentId: 1, status: 1 });
contractSchema.index({ roomId: 1, bedNumber: 1, status: 1 });

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;

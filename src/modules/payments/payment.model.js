/**
 * Mongoose Schema cho collection Payments (EDIT_DOCS_DATA_SCHEMA.md §3.8).
 * Quản lý lịch sử giao dịch thu tiền hóa đơn và chi hoàn cọc cho sinh viên.
 * 
 * ============================================================================
 * [HỖ TRỢ NGHIỆP VỤ HOÀN TIỀN CỌC]:
 * - Trường `type`:
 *   + 'payment': Thu tiền hóa đơn (tiền phòng, cọc, điện nước).
 *   + 'refund': Chi hoàn trả tiền cọc cho sinh viên khi thanh lý hợp đồng KTX.
 * ============================================================================
 */

const mongoose = require('mongoose');
const { PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TYPE } = require('../../shared/constants/enums');

const paymentSchema = new mongoose.Schema(
  {
    paymentCode: {
      type: String,
      required: [true, 'Mã phiếu thanh toán là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null, // null nếu là phiếu chi hoàn cọc
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Sinh viên thực hiện giao dịch là bắt buộc'],
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền giao dịch là bắt buộc'],
      min: [0, 'Số tiền giao dịch không được âm'],
    },
    type: {
      type: String,
      enum: {
        values: PAYMENT_TYPE,
        message: 'Loại thanh toán {VALUE} không hợp lệ, chỉ chấp nhận payment hoặc refund',
      },
      default: 'payment',
    },
    method: {
      type: String,
      enum: {
        values: PAYMENT_METHOD,
        message: 'Phương thức thanh toán {VALUE} không hợp lệ',
      },
      required: [true, 'Phương thức thanh toán là bắt buộc (cash hoặc vietqr)'],
    },
    cashCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // ID của cán bộ thu tiền mặt hoặc chi hoàn cọc
    },
    transactionCode: {
      type: String,
      default: null,
      trim: true, // Mã giao dịch ngân hàng đối soát
    },
    status: {
      type: String,
      enum: {
        values: PAYMENT_STATUS,
        message: 'Trạng thái thanh toán {VALUE} không hợp lệ',
      },
      default: 'success',
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    paidAt: {
      type: Date,
      default: Date.now,
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

paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ studentId: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ paidAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

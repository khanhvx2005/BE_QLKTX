/**
 * Phiếu thu — biên lai của MỘT lần thu đủ một hóa đơn (API.md §8). Không sửa, không xóa.
 * Hoàn cọc KHÔNG tạo phiếu (BR-08: không phải doanh thu) — chỉ đánh dấu trên hợp đồng.
 */

const mongoose = require('mongoose');
const { PAYMENT_METHOD } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });

const paymentSchema = new mongoose.Schema(
  {
    paymentCode: { type: String, required: true, unique: true, trim: true },
    invoiceId: { ...ref('Invoice'), required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHOD, required: true },
    /** Mã giao dịch ngân hàng (VietQR), không bắt buộc, không trùng */
    transactionCode: { type: String, default: null, trim: true },
    note: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
    payerStudentId: ref('Student'),
    collectedBy: ref('User'),
    collectedByName: { type: String, default: null },
  },
  { timestamps: true, toJSON }
);

paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ paidAt: -1 });
paymentSchema.index({ transactionCode: 1 }, { unique: true, partialFilterExpression: { transactionCode: { $type: 'string' } } });

module.exports = mongoose.model('Payment', paymentSchema);

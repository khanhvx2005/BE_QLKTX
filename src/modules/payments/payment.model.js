/**
 * Phiếu thu & Phiếu chi hoàn cọc (HaUI - DMS v3.0 — API.md §7).
 *   - `paymentType: 'payment'`: biên lai thu tiền hóa đơn (tiền mặt hoặc VietQR Webhook / Đối soát).
 *   - `paymentType: 'refund'`:  phiếu chi hoàn cọc sau thanh lý hợp đồng (tách khỏi doanh thu BR-08).
 */

const mongoose = require('mongoose');
const { PAYMENT_METHOD, PAYMENT_TYPE } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });

const paymentSchema = new mongoose.Schema(
  {
    paymentCode: { type: String, required: true, unique: true, trim: true },
    paymentType: { type: String, enum: PAYMENT_TYPE, default: 'payment' },
    /** Gắn hóa đơn đối với phiếu thu (`payment`); null với phiếu chi hoàn cọc (`refund`) */
    invoiceId: ref('Invoice'),
    /** Gắn hợp đồng (đặc biệt hữu ích cho phiếu chi hoàn cọc `refund`) */
    contractId: ref('Contract'),
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHOD, required: true },
    /** Mã giao dịch ngân hàng (VietQR Webhook Idempotency BR-10), không trùng */
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
paymentSchema.index({ contractId: 1 });
paymentSchema.index({ paymentType: 1, paidAt: -1 });
paymentSchema.index({ paidAt: -1 });
paymentSchema.index(
  { transactionCode: 1 },
  { unique: true, partialFilterExpression: { transactionCode: { $type: 'string' } } }
);

module.exports = mongoose.model('Payment', paymentSchema);

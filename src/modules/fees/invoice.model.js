/**
 * Hóa đơn — API.md §8. Ba loại cố định, hai trạng thái, thu đủ một lần.
 *   personal: tiền cọc / tiền phòng cả kỳ của MỘT sinh viên (sinh ra khi duyệt đơn)
 *   room:     điện nước của cả phòng một tháng (sinh ra khi chốt), một bạn nộp đại diện (BR-03, D5)
 */

const mongoose = require('mongoose');
const { INVOICE_STATUS, INVOICE_TYPE, INVOICE_SCOPE } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });

const invoiceSchema = new mongoose.Schema(
  {
    invoiceCode: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: INVOICE_TYPE, required: true },
    scope: { type: String, enum: INVOICE_SCOPE, required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    /** Chủ hóa đơn (personal). Hóa đơn phòng để null */
    studentId: ref('Student'),
    /** Luôn có: phòng của hợp đồng (personal) hoặc phòng được chốt điện nước (room) */
    roomId: { ...ref('Room'), required: true },
    contractId: ref('Contract'),
    utilityReadingId: ref('UtilityReading'),
    monthYear: { type: String, default: null },
    dueDate: { type: String, required: true },
    status: { type: String, enum: INVOICE_STATUS, default: 'unpaid' },
    paidAt: { type: Date, default: null },
    /** Người nộp: chủ hóa đơn (personal) hoặc bạn đại diện phòng (room) */
    payerStudentId: ref('Student'),
  },
  { timestamps: true, toJSON }
);

invoiceSchema.index({ studentId: 1, status: 1 });
invoiceSchema.index({ roomId: 1, type: 1, status: 1 });
invoiceSchema.index({ contractId: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);

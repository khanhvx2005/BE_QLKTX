/**
 * Mongoose Schema cho collection Invoices (EDIT_DOCS_DATA_SCHEMA.md §3.7).
 * Quản lý hóa đơn thu tiền của hệ thống KTX HaUI (v2.0-HaUI).
 * 
 * ============================================================================
 * [KIẾN TRÚC TINH GỌN HaUI DMS - DÀNH CHO TEAM 5]:
 * - Đã loại bỏ bảng FeeType động và subdocument lineItems phức tạp.
 * - Hóa đơn cố định 3 loại:
 *   1. 'room_semester': Tiền phòng trọn gói kỳ (gắn với sinh viên).
 *   2. 'deposit': Tiền đặt cọc phòng (gắn với sinh viên).
 *   3. 'utility': Tiền điện nước dùng chung (gắn trực tiếp với roomId của cả phòng).
 * - Lưu ý sinh mã điện nước: `INV-UTIL-<Mã Tòa>-<Số Phòng>-<YYYYMM>`
 *   (bắt buộc có mã tòa để chống trùng phòng giữa các tòa nhà!).
 * ============================================================================
 */

const mongoose = require('mongoose');
const { INVOICE_STATUS, INVOICE_TYPE } = require('../../shared/constants/enums');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceCode: {
      type: String,
      required: [true, 'Mã hóa đơn là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    // Gắn với phòng KTX (Bắt buộc nếu là hóa đơn điện nước phòng type = 'utility')
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    // Gắn với sinh viên thụ hưởng (nếu là tiền phòng/cọc) hoặc bạn đại diện đã nộp tiền (nếu là điện nước phòng)
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      default: null,
    },
    utilityReadingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UtilityReading',
      default: null,
    },
    type: {
      type: String,
      enum: {
        values: INVOICE_TYPE,
        message: 'Loại hóa đơn {VALUE} không hợp lệ, chỉ chấp nhận room_semester, deposit hoặc utility',
      },
      required: [true, 'Loại hóa đơn là bắt buộc'],
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền hóa đơn là bắt buộc'],
      min: [0, 'Số tiền hóa đơn không được âm'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Hạn thanh toán là bắt buộc'],
    },
    status: {
      type: String,
      enum: {
        values: INVOICE_STATUS,
        message: 'Trạng thái hóa đơn {VALUE} không hợp lệ',
      },
      default: 'unpaid',
    },
    paidAt: {
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

invoiceSchema.index({ roomId: 1, type: 1, status: 1 });
invoiceSchema.index({ studentId: 1, status: 1 });
invoiceSchema.index({ type: 1, status: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;

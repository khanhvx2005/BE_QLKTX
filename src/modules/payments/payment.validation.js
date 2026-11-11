/**
 * Joi Validation cho Module Payments (Thanh toán & Hoàn cọc KTX HaUI).
 */

const Joi = require('joi');
const { PAYMENT_METHOD, PAYMENT_TYPE } = require('../../shared/constants/enums');

// 1. Thu tiền mặt tại KTX (FR-52)
const payCashSchema = Joi.object({
  invoiceId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Mã hóa đơn là bắt buộc',
  }),
  studentId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Mã sinh viên không đúng định dạng ObjectId',
  }),
  note: Joi.string().trim().allow('', null),
});

// 2. Xác nhận chuyển khoản ngân hàng qua VietQR (FR-54)
const confirmBankTransferSchema = Joi.object({
  invoiceId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Mã hóa đơn là bắt buộc',
  }),
  studentId: Joi.string().hex().length(24).optional(),
  transactionCode: Joi.string().trim().required().messages({
    'string.empty': 'Mã giao dịch ngân hàng đối soát không được để trống',
    'any.required': 'Mã giao dịch ngân hàng là bắt buộc',
  }),
  note: Joi.string().trim().allow('', null),
});

// 3. Query danh sách giao dịch
const queryPaymentSchema = Joi.object({
  studentId: Joi.string().hex().length(24).optional(),
  invoiceId: Joi.string().hex().length(24).optional(),
  type: Joi.string().valid(...PAYMENT_TYPE).optional(),
  method: Joi.string().valid(...PAYMENT_METHOD).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  payCashSchema,
  confirmBankTransferSchema,
  queryPaymentSchema,
};

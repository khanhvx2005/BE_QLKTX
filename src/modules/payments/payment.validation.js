/**
 * Validation schema cho Module Payments sử dụng Joi.
 * Tuân thủ theo API.md §8.
 */

const Joi = require('joi');

const recordCashPaymentSchema = Joi.object({
  invoiceId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID hóa đơn không hợp lệ (phải là ObjectId)',
    'any.required': 'Hóa đơn là bắt buộc',
  }),
  amount: Joi.number().integer().min(1000).required().messages({
    'number.min': 'Số tiền thanh toán tối thiểu là 1.000 VNĐ',
    'any.required': 'Số tiền thanh toán là bắt buộc',
  }),
  note: Joi.string().trim().optional().allow(''),
});

const createVNPayUrlSchema = Joi.object({
  invoiceId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID hóa đơn không hợp lệ',
    'any.required': 'Hóa đơn cần thanh toán là bắt buộc',
  }),
});

const verifyVNPaySchema = Joi.object({
  vnp_TxnRef: Joi.string().required().messages({
    'any.required': 'Mã giao dịch vnp_TxnRef là bắt buộc',
  }),
  vnp_Amount: Joi.string().required().messages({
    'any.required': 'Số tiền vnp_Amount là bắt buộc',
  }),
  vnp_ResponseCode: Joi.string().required().messages({
    'any.required': 'Mã phản hồi vnp_ResponseCode là bắt buộc',
  }),
  vnp_SecureHash: Joi.string().required().messages({
    'any.required': 'Chữ ký vnp_SecureHash là bắt buộc',
  }),
}).unknown(true); // Cho phép các trường khác do VNPay gửi kèm

const queryPaymentSchema = Joi.object({
  invoiceId: Joi.string().hex().length(24).optional(),
  studentId: Joi.string().hex().length(24).optional(),
  method: Joi.string().valid('cash', 'vnpay', 'bank_transfer', 'zalopay').optional(),
  status: Joi.string().valid('pending', 'completed', 'success', 'failed').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  recordCashPaymentSchema,
  createVNPayUrlSchema,
  verifyVNPaySchema,
  queryPaymentSchema,
};

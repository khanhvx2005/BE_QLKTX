/**
 * Validation schema cho Module Payments sử dụng Joi.
 * Tuân thủ theo API.md §8 và DATA-SCHEMA.md §3.11.
 */

const Joi = require('joi');

const recordOfflinePaymentSchema = Joi.object({
  invoiceId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID hóa đơn không hợp lệ (phải là ObjectId)',
    'any.required': 'Hóa đơn là bắt buộc',
  }),
  amount: Joi.number().integer().min(1).required().messages({
    'number.min': 'Số tiền thanh toán tối thiểu là 1 VNĐ',
    'any.required': 'Số tiền thanh toán là bắt buộc',
  }),
  method: Joi.string().valid('cash', 'bank_transfer').default('cash').messages({
    'any.only': 'Phương thức thanh toán phải là cash hoặc bank_transfer',
  }),
  note: Joi.string().trim().optional().allow(''),
});

const onlineCheckoutSchema = Joi.object({
  invoiceId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID hóa đơn không hợp lệ',
    'any.required': 'Hóa đơn cần thanh toán là bắt buộc',
  }),
  gateway: Joi.string().valid('vnpay', 'zalopay').default('vnpay').messages({
    'any.only': 'Cổng thanh toán hỗ trợ vnpay hoặc zalopay',
  }),
  amount: Joi.number().integer().min(1).optional().messages({
    'number.min': 'Số tiền thanh toán tối thiểu là 1 VNĐ',
  }),
});

const verifyVNPaySchema = Joi.object({
  vnp_TxnRef: Joi.string().required().messages({
    'any.required': 'Mã giao dịch vnp_TxnRef là bắt buộc',
  }),
  vnp_Amount: Joi.string().optional(),
  vnp_ResponseCode: Joi.string().required().messages({
    'any.required': 'Mã phản hồi vnp_ResponseCode là bắt buộc',
  }),
  vnp_SecureHash: Joi.string().required().messages({
    'any.required': 'Chữ ký vnp_SecureHash là bắt buộc',
  }),
}).unknown(true); // Cho phép các tham số khác do VNPay gửi kèm

const queryPaymentSchema = Joi.object({
  invoiceId: Joi.string().hex().length(24).optional(),
  studentId: Joi.string().hex().length(24).optional(),
  method: Joi.string().valid('cash', 'bank_transfer', 'vnpay', 'zalopay').optional(),
  status: Joi.string().valid('pending', 'success', 'failed', 'expired').optional(),
  type: Joi.string().valid('payment', 'refund').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  recordOfflinePaymentSchema,
  onlineCheckoutSchema,
  verifyVNPaySchema,
  queryPaymentSchema,
};

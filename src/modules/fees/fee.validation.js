/**
 * Validation schemas cho Module Fees (Biểu phí, Điện nước, Hóa đơn) sử dụng Joi.
 * Tuân thủ theo API.md §7 và DATA-SCHEMA.md §3.8 - 3.10.
 */

const Joi = require('joi');
const { FEE_TYPE_CODES, INVOICE_TYPE, INVOICE_STATUS } = require('../../shared/constants/enums');

// 1. Fee Types
const createFeeTypeSchema = Joi.object({
  code: Joi.string().valid(...FEE_TYPE_CODES).required().messages({
    'any.only': 'Mã loại phí không hợp lệ',
    'any.required': 'Mã loại phí là bắt buộc',
  }),
  name: Joi.string().trim().required().messages({
    'any.required': 'Tên loại phí là bắt buộc',
  }),
  unit: Joi.string().trim().required().messages({
    'any.required': 'Đơn vị tính là bắt buộc',
  }),
  defaultAmount: Joi.number().integer().min(0).required().messages({
    'any.required': 'Đơn giá mặc định là bắt buộc',
  }),
  isRecurring: Joi.boolean().default(true),
  isActive: Joi.boolean().default(true),
});

const updateFeeTypeSchema = Joi.object({
  name: Joi.string().trim().optional(),
  unit: Joi.string().trim().optional(),
  defaultAmount: Joi.number().integer().min(0).optional(),
  isRecurring: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
});

// 2. Utility Readings
const createUtilityReadingSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID phòng không hợp lệ',
    'any.required': 'Phòng là bắt buộc',
  }),
  billingPeriod: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required().messages({
    'string.pattern.base': 'Kỳ ghi phải có định dạng YYYY-MM (ví dụ 2026-10)',
    'any.required': 'Kỳ ghi là bắt buộc',
  }),
  electricityStart: Joi.number().min(0).required().messages({
    'any.required': 'Chỉ số điện đầu kỳ là bắt buộc',
  }),
  electricityEnd: Joi.number().min(Joi.ref('electricityStart')).required().messages({
    'number.min': 'Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ',
    'any.required': 'Chỉ số điện cuối kỳ là bắt buộc',
  }),
  waterStart: Joi.number().min(0).required().messages({
    'any.required': 'Chỉ số nước đầu kỳ là bắt buộc',
  }),
  waterEnd: Joi.number().min(Joi.ref('waterStart')).required().messages({
    'number.min': 'Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ',
    'any.required': 'Chỉ số nước cuối kỳ là bắt buộc',
  }),
});

const updateUtilityReadingSchema = Joi.object({
  electricityStart: Joi.number().min(0).optional(),
  electricityEnd: Joi.number().optional(),
  waterStart: Joi.number().min(0).optional(),
  waterEnd: Joi.number().optional(),
});

const queryUtilityReadingSchema = Joi.object({
  billingPeriod: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  buildingId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// 3. Invoices
const generateInvoicesSchema = Joi.object({
  billingPeriod: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required().messages({
    'string.pattern.base': 'Kỳ lập hóa đơn phải có định dạng YYYY-MM (ví dụ 2026-10)',
    'any.required': 'Kỳ lập hóa đơn là bắt buộc',
  }),
  buildingIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  dueDate: Joi.date().iso().required().messages({
    'any.required': 'Hạn nộp tiền là bắt buộc',
  }),
});

const createInvoiceSchema = Joi.object({
  studentId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Sinh viên là bắt buộc',
  }),
  contractId: Joi.string().hex().length(24).optional(),
  billingPeriod: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).optional().allow(null, ''),
  type: Joi.string().valid(...INVOICE_TYPE).default('monthly'),
  lineItems: Joi.array()
    .items(
      Joi.object({
        feeTypeId: Joi.string().hex().length(24).optional(),
        description: Joi.string().trim().required(),
        quantity: Joi.number().min(1).default(1),
        unitPrice: Joi.number().integer().min(0).required(),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Hóa đơn phải có ít nhất 1 khoản phí',
      'any.required': 'Chi tiết hóa đơn là bắt buộc',
    }),
  dueDate: Joi.date().iso().required().messages({
    'any.required': 'Hạn thanh toán là bắt buộc',
  }),
});

const queryInvoiceSchema = Joi.object({
  studentId: Joi.string().hex().length(24).optional(),
  billingPeriod: Joi.string().optional(),
  status: Joi.string().valid(...INVOICE_STATUS).optional(),
  type: Joi.string().valid(...INVOICE_TYPE).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createFeeTypeSchema,
  updateFeeTypeSchema,
  createUtilityReadingSchema,
  updateUtilityReadingSchema,
  queryUtilityReadingSchema,
  generateInvoicesSchema,
  createInvoiceSchema,
  queryInvoiceSchema,
};

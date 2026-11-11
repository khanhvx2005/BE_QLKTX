/**
 * Joi Validation cho Module Fees (Điện Nước & Hóa Đơn KTX HaUI).
 */

const Joi = require('joi');
const { INVOICE_STATUS, INVOICE_TYPE } = require('../../shared/constants/enums');

// 1. Validation ghi chỉ số điện nước 1 phòng
const recordReadingSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Mã phòng KTX là bắt buộc',
  }),
  monthYear: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required().messages({
    'string.pattern.base': 'Tháng năm phải có định dạng YYYY-MM (ví dụ: 2026-10)',
    'any.required': 'Tháng năm ghi số là bắt buộc',
  }),
  electricityOld: Joi.number().min(0).required(),
  electricityNew: Joi.number().min(0).required(),
  electricityUnitPrice: Joi.number().min(0).default(2500),
  waterOld: Joi.number().min(0).required(),
  waterNew: Joi.number().min(0).required(),
  waterUnitPrice: Joi.number().min(0).default(12000),
});

// 2. Validation ghi chỉ số hàng loạt dạng Bảng lưới ma trận (Matrix Grid - FR-40)
const matrixGridReadingSchema = Joi.object({
  buildingId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Tòa nhà là bắt buộc',
  }),
  monthYear: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required().messages({
    'string.pattern.base': 'Tháng năm phải có định dạng YYYY-MM (ví dụ: 2026-10)',
    'any.required': 'Tháng năm ghi số là bắt buộc',
  }),
  readings: Joi.array().items(
    Joi.object({
      roomId: Joi.string().hex().length(24).required(),
      electricityOld: Joi.number().min(0).required(),
      electricityNew: Joi.number().min(0).required(),
      waterOld: Joi.number().min(0).required(),
      waterNew: Joi.number().min(0).required(),
    })
  ).min(1).required().messages({
    'array.min': 'Danh sách ghi chỉ số phải có ít nhất 1 phòng',
    'any.required': 'Dữ liệu chỉ số là bắt buộc',
  }),
});

// 3. Validation Chốt & Phát hành hóa đơn phòng (FR-41)
const billReadingSchema = Joi.object({
  readingId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Mã bản ghi chỉ số là bắt buộc',
  }),
});

// 4. Query hóa đơn
const queryInvoiceSchema = Joi.object({
  status: Joi.string().valid(...INVOICE_STATUS).optional(),
  type: Joi.string().valid(...INVOICE_TYPE).optional(),
  roomId: Joi.string().hex().length(24).optional(),
  studentId: Joi.string().hex().length(24).optional(),
  search: Joi.string().trim().optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  recordReadingSchema,
  matrixGridReadingSchema,
  billReadingSchema,
  queryInvoiceSchema,
};

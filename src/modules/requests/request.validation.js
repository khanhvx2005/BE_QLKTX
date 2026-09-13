/**
 * Validation schema cho Module Requests sử dụng Joi.
 * Tuân thủ theo API.md §9 và §10.
 */

const Joi = require('joi');

const createRequestSchema = Joi.object({
  type: Joi.string().valid('renewal', 'checkout').required().messages({
    'any.required': 'Loại yêu cầu (renewal hoặc checkout) là bắt buộc',
    'any.only': 'Loại yêu cầu phải là renewal hoặc checkout',
  }),
  requestedEndDate: Joi.date().iso().required().messages({
    'any.required': 'Ngày dự kiến kết thúc/trả phòng là bắt buộc',
    'date.format': 'Ngày phải có định dạng ISO hợp lệ (YYYY-MM-DD)',
  }),
  reason: Joi.string().trim().max(500).allow('').optional().messages({
    'string.max': 'Lý do không được vượt quá 500 ký tự',
  }),
  contractId: Joi.string().hex().length(24).optional(),
});

const approveRequestSchema = Joi.object({
  actualCheckoutDate: Joi.date().iso().optional(),
  requestedEndDate: Joi.date().iso().optional(),
  forceConfirm: Joi.boolean().default(false),
  staffNote: Joi.string().trim().max(500).allow('').optional(),
});

const rejectRequestSchema = Joi.object({
  reviewNote: Joi.string().trim().min(3).max(500).required().messages({
    'any.required': 'Lý do từ chối là bắt buộc',
    'string.empty': 'Lý do từ chối không được để trống',
    'string.min': 'Lý do từ chối phải có ít nhất 3 ký tự',
    'string.max': 'Lý do từ chối không được vượt quá 500 ký tự',
  }),
});

const queryRequestSchema = Joi.object({
  type: Joi.string().valid('renewal', 'checkout').optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'cancelled').optional(),
  studentId: Joi.string().hex().length(24).optional(),
  contractId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createRequestSchema,
  approveRequestSchema,
  rejectRequestSchema,
  queryRequestSchema,
};

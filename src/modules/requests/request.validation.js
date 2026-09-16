/**
 * Validation schema cho Module Requests sử dụng Joi.
 * Tuân thủ theo API.md §9 và §10 (v1.2).
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
  reason: Joi.when('type', {
    is: 'checkout',
    then: Joi.string().trim().required().messages({
      'any.required': 'Lý do trả phòng là bắt buộc',
      'string.empty': 'Lý do trả phòng không được để trống',
    }),
    otherwise: Joi.string().trim().allow('').optional(),
  }),
  contractId: Joi.string().hex().length(24).optional(),
});

const approveCheckoutSchema = Joi.object({
  actualCheckoutDate: Joi.date().iso().optional(),
  refundMethod: Joi.string().valid('cash', 'bank_transfer').default('cash'),
  forceConfirm: Joi.boolean().default(false),
});

const rejectRequestSchema = Joi.object({
  reviewNote: Joi.string().trim().min(1).max(500).required().messages({
    'any.required': 'Lý do từ chối là bắt buộc',
    'string.empty': 'Lý do từ chối không được để trống',
  }),
});

const queryRequestSchema = Joi.object({
  type: Joi.string().valid('renewal', 'checkout').optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'cancelled').optional(),
  search: Joi.string().trim().optional().allow(''),
  studentId: Joi.string().hex().length(24).optional(),
  contractId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createRequestSchema,
  approveCheckoutSchema,
  rejectRequestSchema,
  queryRequestSchema,
};

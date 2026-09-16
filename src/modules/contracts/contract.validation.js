/**
 * Validation schema cho Module Contracts sử dụng Joi.
 * Tuân thủ theo API.md §6 (v1.2).
 */

const Joi = require('joi');

const updateContractSchema = Joi.object({
  terms: Joi.string().trim().required().messages({
    'string.empty': 'Điều khoản không được để trống',
    'any.required': 'Điều khoản là bắt buộc',
  }),
});

const terminateContractSchema = Joi.object({
  reason: Joi.string().trim().min(10).required().messages({
    'string.min': 'Lý do chấm dứt phải có ít nhất 10 ký tự',
    'string.empty': 'Lý do chấm dứt không được để trống',
    'any.required': 'Lý do chấm dứt hợp đồng là bắt buộc',
  }),
  terminationDate: Joi.date().iso().optional(),
});

const queryContractSchema = Joi.object({
  status: Joi.string().valid('active', 'expired', 'terminated').optional(),
  buildingId: Joi.string().hex().length(24).optional(),
  roomTypeId: Joi.string().hex().length(24).optional(),
  search: Joi.string().trim().optional().allow(''),
  expiringInDays: Joi.number().integer().min(1).max(365).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  updateContractSchema,
  terminateContractSchema,
  queryContractSchema,
};

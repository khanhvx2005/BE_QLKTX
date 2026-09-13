/**
 * Validation schema cho Module Contracts sử dụng Joi.
 * Tuân thủ theo API.md §6.
 */

const Joi = require('joi');

const createContractSchema = Joi.object({
  residencyId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID lưu trú không hợp lệ (phải là ObjectId)',
    'any.required': 'Lưu trú là bắt buộc',
  }),
  studentId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID sinh viên không hợp lệ (phải là ObjectId)',
    'any.required': 'Sinh viên là bắt buộc',
  }),
  startDate: Joi.date().iso().required().messages({
    'any.required': 'Ngày bắt đầu hợp đồng là bắt buộc',
  }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'Ngày kết thúc phải sau ngày bắt đầu',
    'any.required': 'Ngày kết thúc hợp đồng là bắt buộc',
  }),
  roomFeeSnapshot: Joi.number().integer().min(0).required().messages({
    'any.required': 'Giá thuê phòng là bắt buộc',
  }),
  depositAmount: Joi.number().integer().min(0).default(0),
});

const updateContractSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  roomFeeSnapshot: Joi.number().integer().min(0).optional(),
  depositAmount: Joi.number().integer().min(0).optional(),
  depositStatus: Joi.string().valid('pending', 'paid', 'refunded', 'forfeited').optional(),
});

const queryContractSchema = Joi.object({
  status: Joi.string().valid('pending', 'active', 'expired', 'terminated').optional(),
  studentId: Joi.string().hex().length(24).optional(),
  search: Joi.string().trim().optional().allow(''),
  expiringInDays: Joi.number().integer().min(1).max(365).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createContractSchema,
  updateContractSchema,
  queryContractSchema,
};

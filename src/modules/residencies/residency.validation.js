/**
 * Validation schema cho Module Residencies sử dụng Joi.
 * Tuân thủ theo API.md §5.
 */

const Joi = require('joi');

const createResidencySchema = Joi.object({
  studentId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID sinh viên không hợp lệ (phải là ObjectId)',
    'any.required': 'Sinh viên là bắt buộc',
  }),
  bedId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID giường không hợp lệ (phải là ObjectId)',
    'any.required': 'Giường là bắt buộc',
  }),
  startDate: Joi.date().iso().required().messages({
    'date.format': 'Ngày bắt đầu phải đúng định dạng ISO',
    'any.required': 'Ngày bắt đầu là bắt buộc',
  }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).optional().allow(null, '').messages({
    'date.greater': 'Ngày kết thúc phải sau ngày bắt đầu',
  }),
});

const queryResidencySchema = Joi.object({
  studentId: Joi.string().hex().length(24).optional(),
  bedId: Joi.string().hex().length(24).optional(),
  status: Joi.string().valid('active', 'closed', 'ended').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createResidencySchema,
  queryResidencySchema,
};

/**
 * Validation schema cho Module Applications (API.md §5.1, §10).
 */

const Joi = require('joi');

const createApplicationStaffSchema = Joi.object({
  studentId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID sinh viên không hợp lệ',
    'any.required': 'Sinh viên là bắt buộc',
  }),
  roomId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID phòng không hợp lệ',
    'any.required': 'Phòng đăng ký là bắt buộc',
  }),
  startDate: Joi.date().iso().required().messages({
    'any.required': 'Ngày bắt đầu ở là bắt buộc',
  }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'Ngày kết thúc phải sau ngày bắt đầu',
    'any.required': 'Ngày kết thúc là bắt buộc',
  }),
  note: Joi.string().trim().optional().allow(''),
});

const createApplicationStudentSchema = Joi.object({
  roomId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID phòng không hợp lệ',
    'any.required': 'Phòng đăng ký là bắt buộc',
  }),
  startDate: Joi.date().iso().required().messages({
    'any.required': 'Ngày bắt đầu ở là bắt buộc',
  }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'Ngày kết thúc phải sau ngày bắt đầu',
    'any.required': 'Ngày kết thúc là bắt buộc',
  }),
  note: Joi.string().trim().optional().allow(''),
});

const approveApplicationSchema = Joi.object({
  roomId: Joi.string().hex().length(24).optional(),
});

const rejectApplicationSchema = Joi.object({
  reviewNote: Joi.string().trim().min(10).required().messages({
    'string.min': 'Lý do từ chối phải có ít nhất 10 ký tự',
    'string.empty': 'Lý do từ chối không được để trống',
    'any.required': 'Lý do từ chối là bắt buộc',
  }),
});

const queryApplicationSchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected', 'cancelled').optional(),
  roomTypeId: Joi.string().hex().length(24).optional(),
  search: Joi.string().trim().optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createApplicationStaffSchema,
  createApplicationStudentSchema,
  approveApplicationSchema,
  rejectApplicationSchema,
  queryApplicationSchema,
};

/**
 * Validation schema cho Module Quản lý Tài khoản (/api/users).
 * Tuân thủ theo API.md §2.1 (v1.2.6).
 */

const Joi = require('joi');
const { ROLES } = require('../../shared/constants/enums');

const createUserSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).trim().required().messages({
    'string.email': 'Email không đúng định dạng',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là bắt buộc',
  }),
  role: Joi.string().valid(...ROLES).required().messages({
    'any.only': 'Vai trò không hợp lệ',
    'any.required': 'Vai trò là bắt buộc',
  }),
  fullName: Joi.when('role', {
    is: 'student',
    then: Joi.string().trim().optional().allow(''),
    otherwise: Joi.string().trim().required().messages({
      'string.empty': 'Họ và tên không được để trống',
      'any.required': 'Họ và tên là bắt buộc đối với cán bộ',
    }),
  }),
  studentId: Joi.when('role', {
    is: 'student',
    then: Joi.string().hex().length(24).required().messages({
      'string.hex': 'ID sinh viên không hợp lệ',
      'any.required': 'Vui lòng chọn sinh viên để tạo tài khoản',
    }),
    otherwise: Joi.forbidden(),
  }),
});

const updateUserSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).trim().optional(),
  fullName: Joi.string().trim().optional(),
  role: Joi.string().valid(...ROLES).optional(),
});

const updateStatusSchema = Joi.object({
  isActive: Joi.boolean().required().messages({
    'any.required': 'Trạng thái isActive là bắt buộc',
  }),
});

const queryUserSchema = Joi.object({
  search: Joi.string().trim().optional().allow(''),
  role: Joi.string().valid(...ROLES).optional(),
  isActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  queryUserSchema,
};

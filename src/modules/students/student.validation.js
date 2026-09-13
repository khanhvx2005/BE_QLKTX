/**
 * Validation schema cho Module Students sử dụng Joi.
 * Tuân thủ theo API.md §3 và DATA-SCHEMA.md §3.2.
 */

const Joi = require('joi');

const createStudentSchema = Joi.object({
  fullName: Joi.string().trim().max(150).required().messages({
    'string.empty': 'Họ và tên không được để trống',
    'any.required': 'Họ và tên sinh viên là bắt buộc',
  }),
  studentCode: Joi.string().trim().uppercase().max(20).required().messages({
    'string.empty': 'Mã số sinh viên không được để trống',
    'any.required': 'Mã số sinh viên là bắt buộc',
  }),
  gender: Joi.string().valid('male', 'female').required().messages({
    'any.only': 'Giới tính chỉ chấp nhận male hoặc female',
    'any.required': 'Giới tính là bắt buộc',
  }),
  dob: Joi.date().iso().optional().allow(null, '').messages({
    'date.format': 'Ngày sinh phải đúng định dạng ISO (YYYY-MM-DD)',
  }),
  phone: Joi.string()
    .pattern(/^0\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0',
      'any.required': 'Số điện thoại là bắt buộc',
    }),
  email: Joi.string().email({ tlds: false }).trim().optional().allow(null, '').messages({
    'string.email': 'Email liên hệ không đúng định dạng',
  }),
  className: Joi.string().trim().optional().allow(null, ''),
  faculty: Joi.string().trim().optional().allow(null, ''),
  emergencyContact: Joi.object({
    name: Joi.string().trim().optional().allow(null, ''),
    phone: Joi.string().trim().optional().allow(null, ''),
    relationship: Joi.string().trim().optional().allow(null, ''),
  }).optional(),
});

const updateStudentSchema = Joi.object({
  fullName: Joi.string().trim().max(150).optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  dob: Joi.date().iso().optional().allow(null, ''),
  phone: Joi.string().pattern(/^0\d{9}$/).optional().messages({
    'string.pattern.base': 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0',
  }),
  email: Joi.string().email({ tlds: false }).trim().optional().allow(null, ''),
  className: Joi.string().trim().optional().allow(null, ''),
  faculty: Joi.string().trim().optional().allow(null, ''),
  emergencyContact: Joi.object({
    name: Joi.string().trim().optional().allow(null, ''),
    phone: Joi.string().trim().optional().allow(null, ''),
    relationship: Joi.string().trim().optional().allow(null, ''),
  }).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
});

const queryStudentSchema = Joi.object({
  search: Joi.string().trim().optional().allow(''),
  status: Joi.string().valid('active', 'inactive').optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().optional().default('-createdAt'),
});

module.exports = {
  createStudentSchema,
  updateStudentSchema,
  queryStudentSchema,
};

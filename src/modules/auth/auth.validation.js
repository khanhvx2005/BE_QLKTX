/**
 * Validation schema cho Module Auth sử dụng Joi.
 * Định dạng lỗi trả về tuân thủ API.md §1.1.
 */

const Joi = require('joi');

const registerSchema = Joi.object({
  fullName: Joi.string().trim().max(150).required().messages({
    'string.empty': 'Họ và tên không được để trống',
    'any.required': 'Họ và tên là bắt buộc',
  }),
  email: Joi.string().email({ tlds: false }).trim().required().messages({
    'string.email': 'Email không đúng định dạng',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là bắt buộc',
  }),
  password: Joi.string().min(6).max(100).required().messages({
    'string.min': 'Mật khẩu phải có ít nhất 6 ký tự',
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
  studentCode: Joi.string().trim().uppercase().max(20).required().messages({
    'string.empty': 'Mã số sinh viên không được để trống',
    'any.required': 'Mã số sinh viên là bắt buộc',
  }),
  phone: Joi.string()
    .pattern(/^0\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      'string.empty': 'Số điện thoại không được để trống',
      'any.required': 'Số điện thoại là bắt buộc',
    }),
  gender: Joi.string().valid('male', 'female').required().messages({
    'any.only': 'Giới tính chỉ chấp nhận male hoặc female',
    'any.required': 'Giới tính là bắt buộc',
  }),
  className: Joi.string().trim().optional().allow(''),
  faculty: Joi.string().trim().optional().allow(''),
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).trim().required().messages({
    'string.email': 'Email không đúng định dạng',
    'string.empty': 'Email không được để trống',
    'any.required': 'Email là bắt buộc',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    'string.empty': 'Mật khẩu hiện tại không được để trống',
    'any.required': 'Mật khẩu hiện tại là bắt buộc',
  }),
  newPassword: Joi.string()
    .min(6)
    .max(100)
    .invalid(Joi.ref('oldPassword'))
    .required()
    .messages({
      'string.min': 'Mật khẩu mới phải có ít nhất 6 ký tự',
      'any.invalid': 'Mật khẩu mới không được trùng với mật khẩu hiện tại',
      'string.empty': 'Mật khẩu mới không được để trống',
      'any.required': 'Mật khẩu mới là bắt buộc',
    }),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
};

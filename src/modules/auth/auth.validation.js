/**
 * Joi Validation cho Module Auth.
 */

const Joi = require('joi');

const loginSchema = Joi.object({
  identifier: Joi.string().trim().optional(),
  email: Joi.string().trim().optional(),
  username: Joi.string().trim().optional(),
  password: Joi.string().required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
}).or('identifier', 'email', 'username').messages({
  'object.missing': 'Vui lòng cung cấp email hoặc mã sinh viên để đăng nhập',
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Mật khẩu hiện tại không được để trống',
    'any.required': 'Mật khẩu hiện tại là bắt buộc',
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'Mật khẩu mới phải có tối thiểu 6 ký tự',
    'string.empty': 'Mật khẩu mới không được để trống',
    'any.required': 'Mật khẩu mới là bắt buộc',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Xác nhận mật khẩu mới không khớp',
    'any.required': 'Xác nhận mật khẩu là bắt buộc',
  }),
});

module.exports = {
  loginSchema,
  changePasswordSchema,
};

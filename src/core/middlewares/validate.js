/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu đầu vào sử dụng Joi.
 * Định dạng phản hồi lỗi chuẩn theo API.md §1.1:
 * {
 *   "code": "VALIDATION_ERROR",
 *   "message": "Dữ liệu không hợp lệ",
 *   "data": { "errors": [ { "field": "fieldName", "message": "..." } ] }
 * }
 */

const ApiError = require('../errors/api-error');

/**
 * Tạo middleware validate theo Joi schema
 * @param {import('joi').ObjectSchema} schema - Schema của Joi
 * @param {'body'|'query'|'params'} [source='body'] - Nguồn dữ liệu cần validate
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    if (!schema) return next();

    const dataToValidate = req[source] || {};
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Thu thập tất cả các lỗi thay vì dừng ở lỗi đầu tiên
      allowUnknown: true, // Cho phép các trường không định nghĩa nếu cần
      stripUnknown: false,
    });

    if (error) {
      const formattedErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }));

      return next(
        new ApiError(
          400,
          'VALIDATION_ERROR',
          'Dữ liệu không hợp lệ',
          { errors: formattedErrors }
        )
      );
    }

    // Gán lại giá trị đã qua sanitize / type coercion của Joi
    req[source] = value;
    return next();
  };
};

module.exports = validate;

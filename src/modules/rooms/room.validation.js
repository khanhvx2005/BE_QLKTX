/**
 * Validation schema cho Module Rooms (Tòa nhà, Phòng, Giường) sử dụng Joi.
 * Tuân thủ theo API.md §4.
 */

const Joi = require('joi');

const createBuildingSchema = Joi.object({
  code: Joi.string().trim().uppercase().max(10).required().messages({
    'string.empty': 'Mã tòa nhà không được để trống',
    'any.required': 'Mã tòa nhà là bắt buộc',
  }),
  name: Joi.string().trim().max(100).required().messages({
    'string.empty': 'Tên tòa nhà không được để trống',
    'any.required': 'Tên tòa nhà là bắt buộc',
  }),
  address: Joi.string().trim().optional().allow(''),
  description: Joi.string().trim().optional().allow(''),
  isActive: Joi.boolean().optional(),
});

const updateBuildingSchema = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  address: Joi.string().trim().optional().allow(''),
  description: Joi.string().trim().optional().allow(''),
  isActive: Joi.boolean().optional(),
});

const createRoomSchema = Joi.object({
  buildingId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID tòa nhà không hợp lệ (phải là ObjectId)',
    'any.required': 'ID tòa nhà là bắt buộc',
  }),
  roomNumber: Joi.string().trim().max(20).required().messages({
    'string.empty': 'Số phòng không được để trống',
    'any.required': 'Số phòng là bắt buộc',
  }),
  gender: Joi.string().valid('male', 'female').required().messages({
    'any.only': 'Giới tính phòng chỉ chấp nhận male hoặc female',
    'any.required': 'Giới tính phòng là bắt buộc',
  }),
  capacity: Joi.number().integer().min(1).max(20).required().messages({
    'number.min': 'Sức chứa tối thiểu 1 giường',
    'number.max': 'Sức chứa tối đa 20 giường',
    'any.required': 'Sức chứa là bắt buộc',
  }),
  pricePerBed: Joi.number().integer().min(0).required().messages({
    'number.min': 'Đơn giá giường không được âm',
    'any.required': 'Đơn giá giường là bắt buộc',
  }),
  status: Joi.string().valid('active', 'maintenance', 'inactive').optional(),
});

const updateRoomSchema = Joi.object({
  pricePerBed: Joi.number().integer().min(0).optional(),
  capacity: Joi.number().integer().min(1).max(20).optional(),
  status: Joi.string().valid('active', 'maintenance', 'inactive').optional(),
});

const queryRoomSchema = Joi.object({
  buildingId: Joi.string().hex().length(24).optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  hasAvailableBed: Joi.boolean().optional(),
  status: Joi.string().valid('active', 'maintenance', 'inactive').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const createBedSchema = Joi.object({
  bedNumber: Joi.number().integer().min(1).required().messages({
    'any.required': 'Số thứ tự giường là bắt buộc',
  }),
});

const updateBedStatusSchema = Joi.object({
  status: Joi.string().valid('available', 'maintenance').required().messages({
    'any.only': 'Chỉ có thể đổi trạng thái thủ công thành available hoặc maintenance',
    'any.required': 'Trạng thái là bắt buộc',
  }),
});

module.exports = {
  createBuildingSchema,
  updateBuildingSchema,
  createRoomSchema,
  updateRoomSchema,
  queryRoomSchema,
  createBedSchema,
  updateBedStatusSchema,
};

/**
 * Validation schema cho Module Rooms (Tòa nhà, Loại phòng, Phòng, Giường) sử dụng Joi.
 * Tuân thủ theo API.md §4 và DATA-SCHEMA.md §3.4 - 3.5.
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

const createRoomTypeSchema = Joi.object({
  name: Joi.string().trim().max(100).required().messages({
    'string.empty': 'Tên loại phòng không được để trống',
    'any.required': 'Tên loại phòng là bắt buộc',
  }),
  tier: Joi.string().valid('standard', 'premium').required().messages({
    'any.only': 'Hạng loại phòng chỉ chấp nhận standard hoặc premium',
    'any.required': 'Hạng loại phòng là bắt buộc',
  }),
  capacity: Joi.number().integer().min(1).max(20).required().messages({
    'number.min': 'Sức chứa tối thiểu 1 người',
    'number.max': 'Sức chứa tối đa 20 người',
    'any.required': 'Sức chứa là bắt buộc',
  }),
  pricePerMonth: Joi.number().integer().min(0).required().messages({
    'number.min': 'Đơn giá thuê không được âm',
    'any.required': 'Đơn giá thuê theo tháng là bắt buộc',
  }),
  depositAmount: Joi.number().integer().min(0).required().messages({
    'number.min': 'Tiền cọc không được âm',
    'any.required': 'Tiền cọc là bắt buộc',
  }),
  amenities: Joi.array().items(Joi.string().trim()).default([]),
  includedSupplies: Joi.array().items(Joi.string().trim()).default([]),
  isActive: Joi.boolean().default(true),
});

const updateRoomTypeSchema = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  tier: Joi.string().valid('standard', 'premium').optional(),
  capacity: Joi.number().integer().min(1).max(20).optional(),
  pricePerMonth: Joi.number().integer().min(0).optional(),
  depositAmount: Joi.number().integer().min(0).optional(),
  amenities: Joi.array().items(Joi.string().trim()).optional(),
  includedSupplies: Joi.array().items(Joi.string().trim()).optional(),
  isActive: Joi.boolean().optional(),
});

const queryRoomTypeSchema = Joi.object({
  tier: Joi.string().valid('standard', 'premium').optional(),
  isActive: Joi.boolean().optional(),
  withAvailability: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const createRoomSchema = Joi.object({
  buildingId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID tòa nhà không hợp lệ (phải là ObjectId)',
    'any.required': 'ID tòa nhà là bắt buộc',
  }),
  roomTypeId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'ID loại phòng không hợp lệ (phải là ObjectId)',
    'any.required': 'ID loại phòng là bắt buộc',
  }),
  roomNumber: Joi.string().trim().max(20).required().messages({
    'string.empty': 'Số phòng không được để trống',
    'any.required': 'Số phòng là bắt buộc',
  }),
  floor: Joi.number().integer().min(1).default(1).messages({
    'number.min': 'Tầng tối thiểu là 1',
  }),
  gender: Joi.string().valid('male', 'female').required().messages({
    'any.only': 'Giới tính phòng chỉ chấp nhận male hoặc female',
    'any.required': 'Giới tính phòng là bắt buộc',
  }),
  status: Joi.string().valid('active', 'maintenance', 'inactive').default('active'),
});

const updateRoomSchema = Joi.object({
  roomNumber: Joi.string().trim().max(20).optional(),
  floor: Joi.number().integer().min(1).optional(),
  roomTypeId: Joi.string().hex().length(24).optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  status: Joi.string().valid('active', 'maintenance', 'inactive').optional(),
});

const queryRoomSchema = Joi.object({
  buildingId: Joi.string().hex().length(24).optional(),
  roomTypeId: Joi.string().hex().length(24).optional(),
  floor: Joi.number().integer().min(1).optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  availability: Joi.string().valid('has_slot', 'full', 'has_maintenance').optional(),
  search: Joi.string().trim().optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const queryAvailableRoomsSchema = Joi.object({
  roomTypeId: Joi.string().hex().length(24).optional(),
  buildingId: Joi.string().hex().length(24).optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const updateBedStatusSchema = Joi.object({
  status: Joi.string().valid('available', 'maintenance').required().messages({
    'any.only': 'Chỉ có thể đổi trạng thái thành available hoặc maintenance',
    'any.required': 'Trạng thái là bắt buộc',
  }),
  note: Joi.string().trim().optional().allow('', null),
});

module.exports = {
  createBuildingSchema,
  updateBuildingSchema,
  createRoomTypeSchema,
  updateRoomTypeSchema,
  queryRoomTypeSchema,
  createRoomSchema,
  updateRoomSchema,
  queryRoomSchema,
  queryAvailableRoomsSchema,
  updateBedStatusSchema,
};

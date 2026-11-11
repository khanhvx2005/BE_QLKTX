/**
 * Joi Validation cho Module Rooms (Tòa nhà & Phòng KTX).
 */

const Joi = require('joi');
const { GENDER, ROOM_STATUS, ROOM_CAPACITY } = require('../../shared/constants/enums');

// Validation tạo tòa nhà mới
const createBuilding = Joi.object({
  code: Joi.string().trim().uppercase().max(10).required().messages({
    'string.empty': 'Mã tòa nhà không được để trống',
    'any.required': 'Mã tòa nhà là bắt buộc',
  }),
  name: Joi.string().trim().max(100).required().messages({
    'string.empty': 'Tên tòa nhà không được để trống',
    'any.required': 'Tên tòa nhà là bắt buộc',
  }),
  address: Joi.string().trim().allow('', null),
  description: Joi.string().trim().allow('', null),
  isActive: Joi.boolean().default(true),
});

// Validation cập nhật tòa nhà
const updateBuilding = Joi.object({
  name: Joi.string().trim().max(100),
  address: Joi.string().trim().allow('', null),
  description: Joi.string().trim().allow('', null),
  isActive: Joi.boolean(),
});

// Validation tạo phòng mới (FR-24)
const createRoom = Joi.object({
  buildingId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Mã tòa nhà không đúng định dạng ObjectId',
    'any.required': 'Tòa nhà là bắt buộc',
  }),
  roomNumber: Joi.string().trim().max(20).required().messages({
    'string.empty': 'Số phòng không được để trống',
    'any.required': 'Số phòng là bắt buộc',
  }),
  floor: Joi.number().integer().min(1).required().messages({
    'number.min': 'Tầng phải lớn hơn hoặc bằng 1',
    'any.required': 'Tầng là bắt buộc',
  }),
  gender: Joi.string().valid(...GENDER).required().messages({
    'any.only': 'Giới tính phòng chỉ chấp nhận male hoặc female',
    'any.required': 'Giới tính phòng là bắt buộc (BR-01)',
  }),
  capacity: Joi.number().valid(...ROOM_CAPACITY).required().messages({
    'any.only': 'Sức chứa phòng chỉ chấp nhận 4, 6 hoặc 8 người',
    'any.required': 'Sức chứa phòng là bắt buộc',
  }),
  pricePerMonth: Joi.number().min(0).default(500000).messages({
    'number.min': 'Đơn giá thuê không được âm',
  }),
  depositAmount: Joi.number().min(0).default(500000).messages({
    'number.min': 'Tiền đặt cọc không được âm',
  }),
  status: Joi.string().valid(...ROOM_STATUS).default('active'),
});

// Validation cập nhật phòng
const updateRoom = Joi.object({
  floor: Joi.number().integer().min(1),
  gender: Joi.string().valid(...GENDER),
  capacity: Joi.number().valid(...ROOM_CAPACITY),
  pricePerMonth: Joi.number().min(0),
  depositAmount: Joi.number().min(0),
  status: Joi.string().valid(...ROOM_STATUS),
});

module.exports = {
  createBuilding,
  updateBuilding,
  createRoom,
  updateRoom,
};

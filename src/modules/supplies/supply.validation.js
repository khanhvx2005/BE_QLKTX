/**
 * Validation schema cho Module Supplies (Nhu yếu phẩm).
 * Tuân thủ theo API.md §11 và 16-YEU-CAU-API-BACKEND.md §3.14.
 */

const Joi = require('joi');
const { SUPPLY_CATEGORY } = require('../../shared/constants/enums');

const createSupplyItemSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Tên vật phẩm là bắt buộc',
  }),
  category: Joi.string().valid(...SUPPLY_CATEGORY).required().messages({
    'any.required': 'Danh mục vật phẩm là bắt buộc',
    'any.only': 'Danh mục không hợp lệ',
  }),
  unit: Joi.string().trim().required().messages({
    'any.required': 'Đơn vị tính là bắt buộc',
  }),
  price: Joi.number().integer().min(0).required().messages({
    'any.required': 'Đơn giá là bắt buộc',
    'number.min': 'Đơn giá không được âm',
  }),
  imageUrl: Joi.string().trim().uri().allow('', null).optional(),
  includedInRoomTypes: Joi.array().items(Joi.string().hex().length(24)).default([]),
  isActive: Joi.boolean().default(true),
});

const updateSupplyItemSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  category: Joi.string().valid(...SUPPLY_CATEGORY).optional(),
  unit: Joi.string().trim().optional(),
  price: Joi.number().integer().min(0).optional(),
  imageUrl: Joi.string().trim().uri().allow('', null).optional(),
  includedInRoomTypes: Joi.array().items(Joi.string().hex().length(24)).optional(),
  isActive: Joi.boolean().optional(),
});

const querySupplyItemSchema = Joi.object({
  category: Joi.string().valid(...SUPPLY_CATEGORY).optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().trim().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

const querySupplyOrderSchema = Joi.object({
  status: Joi.string().valid('pending_payment', 'ready', 'delivered', 'cancelled').optional(),
  search: Joi.string().trim().allow('').optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const cancelSupplyOrderSchema = Joi.object({
  cancelReason: Joi.string().trim().min(2).required().messages({
    'any.required': 'Lý do hủy đơn là bắt buộc',
  }),
});

const placeSupplyOrderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      supplyItemId: Joi.string().hex().length(24).required().messages({
        'string.hex': 'ID vật phẩm không hợp lệ',
        'any.required': 'ID vật phẩm là bắt buộc',
      }),
      quantity: Joi.number().integer().min(1).max(99).required().messages({
        'number.min': 'Số lượng tối thiểu là 1',
        'any.required': 'Số lượng là bắt buộc',
      }),
    })
  ).min(1).required().messages({
    'array.min': 'Đơn hàng phải có ít nhất một sản phẩm',
    'any.required': 'Danh sách sản phẩm là bắt buộc',
  }),
});

module.exports = {
  createSupplyItemSchema,
  updateSupplyItemSchema,
  querySupplyItemSchema,
  querySupplyOrderSchema,
  cancelSupplyOrderSchema,
  placeSupplyOrderSchema,
};

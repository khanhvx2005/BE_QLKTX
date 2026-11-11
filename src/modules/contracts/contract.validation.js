/**
 * Joi Validation cho Module Contracts (Hợp đồng & Đăng ký KTX Online).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.4 và EDIT_DOCS_DATA_SCHEMA.md §3.5.
 */

const Joi = require('joi');
const { GENDER, CONTRACT_TERMS, CONTRACT_STATUS, PAYMENT_METHOD } = require('../../shared/constants/enums');

// 1. Validation Đăng ký KTX Online công khai (FR-30) - Không cần đăng nhập trước
const registerOnlineSchema = Joi.object({
  studentCode: Joi.string().trim().uppercase().max(20).required().messages({
    'string.empty': 'Mã số sinh viên (MSSV) không được để trống',
    'any.required': 'Mã số sinh viên (MSSV) là bắt buộc',
  }),
  fullName: Joi.string().trim().max(150).required().messages({
    'string.empty': 'Họ và tên không được để trống',
    'any.required': 'Họ và tên là bắt buộc',
  }),
  gender: Joi.string().valid(...GENDER).required().messages({
    'any.only': 'Giới tính chỉ chấp nhận male hoặc female',
    'any.required': 'Giới tính là bắt buộc (dùng để lọc phòng phù hợp)',
  }),
  phone: Joi.string().pattern(/^0\d{9}$/).required().messages({
    'string.pattern.base': 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
    'any.required': 'Số điện thoại là bắt buộc',
  }),
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc (dùng để nhận tài khoản & kết quả xét duyệt)',
  }),
  dob: Joi.date().iso().allow(null, ''),
  faculty: Joi.string().trim().allow(null, ''),
  className: Joi.string().trim().allow(null, ''),
  emergencyContact: Joi.object({
    name: Joi.string().trim().allow(null, ''),
    phone: Joi.string().trim().allow(null, ''),
    relationship: Joi.string().trim().allow(null, ''),
  }).optional(),
  roomId: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Mã phòng không đúng định dạng ObjectId',
    'any.required': 'Phòng KTX là bắt buộc',
  }),
  bedNumber: Joi.number().integer().min(1).required().messages({
    'number.min': 'Vị trí giường tối thiểu là 1',
    'any.required': 'Vị trí giường là bắt buộc',
  }),
  term: Joi.string().valid(...CONTRACT_TERMS).required().messages({
    'any.only': 'Thời hạn hợp đồng chỉ chấp nhận 6_months hoặc 12_months',
    'any.required': 'Thời hạn hợp đồng là bắt buộc',
  }),
});

// 2. Validation Từ chối đơn đăng ký (FR-33)
const rejectContractSchema = Joi.object({
  reason: Joi.string().trim().min(5).required().messages({
    'string.min': 'Lý do từ chối phải có ít nhất 5 ký tự',
    'string.empty': 'Lý do từ chối không được để trống',
    'any.required': 'Lý do từ chối đơn đăng ký là bắt buộc',
  }),
});

// 3. Validation Trả phòng & Thanh lý Hợp đồng (FR-34 - Kèm Hoàn tiền cọc)
const terminateContractSchema = Joi.object({
  reason: Joi.string().trim().allow(null, '').default('Hết kỳ hạn lưu trú hoặc sinh viên xin trả phòng'),
  deductionAmount: Joi.number().min(0).default(0).messages({
    'number.min': 'Số tiền khấu trừ thiệt hại không được âm',
  }),
  deductionReason: Joi.string().trim().allow(null, '').default(''),
  refundMethod: Joi.string().valid(...PAYMENT_METHOD).default('cash').messages({
    'any.only': 'Hình thức hoàn trả tiền cọc không hợp lệ',
  }),
  note: Joi.string().trim().allow(null, ''),
});

// 4. Query hợp đồng (FR-31)
const queryContractSchema = Joi.object({
  status: Joi.string().valid(...CONTRACT_STATUS).optional(),
  buildingId: Joi.string().hex().length(24).optional(),
  roomId: Joi.string().hex().length(24).optional(),
  search: Joi.string().trim().optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  registerOnlineSchema,
  rejectContractSchema,
  terminateContractSchema,
  queryContractSchema,
};

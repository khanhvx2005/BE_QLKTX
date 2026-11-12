/**
 * Hồ sơ sinh viên — API.md §3. Hồ sơ có thể có trước tài khoản (tài khoản sinh ra khi duyệt đơn).
 * Ngày sinh lưu chuỗi `YYYY-MM-DD` (ngày chỉ có ngày, không múi giờ — API.md §1.3).
 */

const mongoose = require('mongoose');
const { GENDER, STUDENT_STATUS } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const emergencyContactSchema = new mongoose.Schema(
  { name: { type: String, trim: true }, phone: { type: String, trim: true }, relationship: { type: String, trim: true } },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    studentCode: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxLength: 150 },
    gender: { type: String, enum: GENDER, required: true },
    dob: { type: String, default: null },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    /** Số CCCD 12 chữ số — bắt buộc ở đơn đăng ký (bổ sung 12/11/2026) */
    citizenId: { type: String, default: null, trim: true },
    /** Địa chỉ thường trú — bắt buộc ở đơn đăng ký (bổ sung 12/11/2026) */
    address: { type: String, default: null, trim: true },
    faculty: { type: String, default: '', trim: true },
    className: { type: String, default: '', trim: true },
    emergencyContact: { type: emergencyContactSchema, default: null },
    status: { type: String, enum: STUDENT_STATUS, default: 'active' },
  },
  { timestamps: true, toJSON }
);

module.exports = mongoose.model('Student', studentSchema);

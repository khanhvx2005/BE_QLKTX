/**
 * Hồ sơ sinh viên HaUI — EDIT_DOCS_DATA_SCHEMA.md §3.2, API.md §3.
 * Tự động lưu `enrollmentYear` (4 chữ số đầu MSSV `YYYY60xxxx`) phục vụ phân luồng Tân SV vs Năm 2+.
 */

const mongoose = require('mongoose');
const { GENDER, STUDENT_STATUS, PRIORITY_TYPES } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    relationship: { type: String, trim: true },
  },
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
    citizenId: { type: String, default: null, trim: true },
    address: { type: String, default: null, trim: true },
    faculty: { type: String, default: '', trim: true },
    className: { type: String, default: '', trim: true },
    /** Năm nhập học bóc từ 4 chữ số đầu MSSV HaUI (VD: 202660xxxx -> 2026) */
    enrollmentYear: { type: Number, default: null },
    /** Diện ưu tiên xét duyệt KTX (policy_family > poor_household > remote_area > normal) */
    priorityType: { type: String, enum: PRIORITY_TYPES, default: 'normal' },
    /** BR-09: có vấn đề sức khỏe/vận động -> ưu tiên xếp phòng tầng thấp (floor <= 2) */
    hasHealthCondition: { type: Boolean, default: false },
    healthNote: { type: String, default: '', trim: true },
    emergencyContact: { type: emergencyContactSchema, default: null },
    status: { type: String, enum: STUDENT_STATUS, default: 'active' },
  },
  { timestamps: true, toJSON }
);

studentSchema.pre('validate', function deriveEnrollmentYear() {
  if (/^\d{10}$/.test(String(this.studentCode || ''))) {
    const yr = Number(String(this.studentCode).slice(0, 4));
    if (yr >= 2000 && yr <= 2100) this.enrollmentYear = yr;
  }
});

module.exports = mongoose.model('Student', studentSchema);

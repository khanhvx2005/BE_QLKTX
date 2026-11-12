/**
 * Tài khoản đăng nhập (admin, staff, student) — API.md §2.
 * Tài khoản sinh viên chỉ sinh ra khi duyệt đơn (FR-02): đăng nhập bằng email hoặc MSSV (`studentCode`, FR-01).
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true, maxLength: 150 },
    role: { type: String, enum: ROLES, required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    /** MSSV để đăng nhập (FR-01). Đổi MSSV ở hồ sơ thì đổi theo (students.service) */
    studentCode: { type: String, default: null, trim: true },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON }
);

// MSSV duy nhất nhưng tài khoản cán bộ không có MSSV — chỉ đánh unique trên giá trị là chuỗi
userSchema.index({ studentCode: 1 }, { unique: true, partialFilterExpression: { studentCode: { $type: 'string' } } });

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
};

module.exports = mongoose.model('User', userSchema);

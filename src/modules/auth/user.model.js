/**
 * Mongoose Schema cho collection Users.
 * Định nghĩa tài khoản đăng nhập cho toàn bộ hệ thống (admin, staff, student, viewer).
 * Tuân thủ theo DATA-SCHEMA.md §3.1 và 07-PHAN-QUYEN-BAO-MAT.md §1.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../../shared/constants/enums');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Định dạng email không hợp lệ'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
      select: false, // Mặc định không trả về passwordHash trong các câu query thông thường
    },
    fullName: {
      type: String,
      required: [true, 'Họ và tên là bắt buộc'],
      trim: true,
      maxLength: [150, 'Họ và tên tối đa 150 ký tự'],
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: 'Vai trò {VALUE} không hợp lệ',
      },
      default: 'student',
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Method so khớp mật khẩu người dùng nhập với hash đã lưu
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper tạo hash từ mật khẩu
userSchema.statics.hashPassword = async function (plainPassword) {
  return bcrypt.hash(plainPassword, 10);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

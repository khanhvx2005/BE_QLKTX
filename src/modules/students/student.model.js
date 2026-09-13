/**
 * Mongoose Schema cho collection Students.
 * Quản lý thông tin lý lịch sinh viên.
 * Tuân thủ theo DATA-SCHEMA.md §3.2 và PRD.md §2.9 (Quy tắc giới tính phòng A1).
 */

const mongoose = require('mongoose');
const { GENDER, STUDENT_STATUS } = require('../../shared/constants/enums');

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      sparse: true, // Cho phép null khi sinh viên chưa có tài khoản tự phục vụ
    },
    fullName: {
      type: String,
      required: [true, 'Họ và tên sinh viên là bắt buộc'],
      trim: true,
      maxLength: [150, 'Họ và tên tối đa 150 ký tự'],
    },
    studentCode: {
      type: String,
      required: [true, 'Mã số sinh viên là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
      maxLength: [20, 'Mã số sinh viên tối đa 20 ký tự'],
    },
    phone: {
      type: String,
      required: [true, 'Số điện thoại là bắt buộc'],
      match: [/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Định dạng email liên hệ không hợp lệ'],
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      enum: {
        values: GENDER,
        message: 'Giới tính {VALUE} không hợp lệ, chỉ chấp nhận male hoặc female',
      },
      required: [true, 'Giới tính là bắt buộc (dùng kiểm tra xếp phòng nam/nữ)'],
    },
    className: {
      type: String,
      trim: true,
    },
    faculty: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: {
        values: STUDENT_STATUS,
        message: 'Trạng thái {VALUE} không hợp lệ',
      },
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Tạo text index phục vụ tìm kiếm theo tên sinh viên
studentSchema.index({ fullName: 'text' });

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;

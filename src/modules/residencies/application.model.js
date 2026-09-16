/**
 * Mongoose Schema cho collection Applications (DATA-SCHEMA.md §3.6a, API.md §5.1).
 * Quản lý đơn đăng ký thuê phòng KTX của sinh viên.
 */

const mongoose = require('mongoose');
const { APPLICATION_STATUS } = require('../../shared/constants/enums');

const applicationSchema = new mongoose.Schema(
  {
    applicationCode: {
      type: String,
      required: [true, 'Mã đơn đăng ký là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Sinh viên là bắt buộc'],
    },
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType',
      required: [true, 'Loại phòng là bắt buộc'],
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Phòng đăng ký là bắt buộc'],
    },
    startDate: {
      type: Date,
      required: [true, 'Ngày bắt đầu là bắt buộc'],
    },
    endDate: {
      type: Date,
      required: [true, 'Ngày kết thúc là bắt buộc'],
    },
    status: {
      type: String,
      enum: {
        values: APPLICATION_STATUS,
        message: 'Trạng thái đơn {VALUE} không hợp lệ',
      },
      default: 'pending',
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: null,
    },
    assignedRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    assignedBedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
      default: null,
    },
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
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
        return ret;
      },
    },
  }
);

applicationSchema.index({ status: 1, createdAt: 1 });
applicationSchema.index({ studentId: 1, status: 1 });

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;

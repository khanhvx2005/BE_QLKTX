/**
 * Đợt đăng ký KTX (`registration_periods`) — EDIT_DOCS_DATA_SCHEMA.md §3.5.
 * Kiểm soát khung thời gian mở cổng, phạm vi 3 Cơ sở và tự động phân luồng Tân SV vs SV năm 2+.
 */

const mongoose = require('mongoose');
const { CAMPUS_SCOPE, TARGET_COHORTS, CONTRACT_TERMS, PERIOD_STATUS } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const registrationPeriodSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxLength: 40 },
    name: { type: String, required: true, trim: true, maxLength: 200 },
    /** Năm bắt đầu năm học (VD: 2026 cho năm học 2026-2027) — đối chiếu 4 số đầu MSSV HaUI */
    academicYearStart: { type: Number, required: true, min: 2020, max: 2100 },
    campus: { type: String, enum: CAMPUS_SCOPE, required: true },
    targetCohort: { type: String, enum: TARGET_COHORTS, default: 'all' },
    /** Nếu không rỗng: chỉ các khoa/ngành trong mảng mới được nộp vào đợt này */
    allowedFaculties: { type: [String], default: [] },
    /** Danh sách khoa/ngành bị loại trừ khỏi đợt này (VD: các ngành học Hà Nội từ năm nhất không cần về CS3) */
    excludedFaculties: { type: [String], default: [] },
    allowedTerms: {
      type: [{ type: String, enum: CONTRACT_TERMS }],
      default: ['6_months', '12_months'],
    },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    paymentDeadlineDays: { type: Number, default: 7, min: 1, max: 30 },
    status: { type: String, enum: PERIOD_STATUS, default: 'upcoming' },
    description: { type: String, default: '', trim: true },
  },
  { timestamps: true, toJSON }
);

registrationPeriodSchema.index({ status: 1, startDate: 1, endDate: 1 });
registrationPeriodSchema.index({ campus: 1, status: 1 });

module.exports = mongoose.model('RegistrationPeriod', registrationPeriodSchema);

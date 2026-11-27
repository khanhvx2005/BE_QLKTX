/**
 * Thông báo In-app & Bảng tin chung KTX — EDIT_DOCS_DATA_SCHEMA.md §3.11.
 */

const mongoose = require('mongoose');
const { CAMPUS_SCOPE, NOTIFICATION_SCOPE, NOTIFICATION_TYPE, NOTIFICATION_PRIORITY } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    scope: { type: String, enum: NOTIFICATION_SCOPE, default: 'personal' },
    campus: { type: String, enum: CAMPUS_SCOPE, default: 'all' },
    type: { type: String, enum: NOTIFICATION_TYPE, required: true },
    priority: { type: String, enum: NOTIFICATION_PRIORITY, default: 'normal' },
    title: { type: String, required: true, trim: true, maxLength: 200 },
    content: { type: String, required: true, trim: true },
    refType: { type: String, default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: null },
  },
  { timestamps: true, toJSON }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ scope: 1, campus: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

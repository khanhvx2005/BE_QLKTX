/**
 * Dịch vụ Chuông thông báo cá nhân & Bảng tin công khai KTX (API.md §1, §8, §9).
 */

const Notification = require('./notification.model');
const User = require('../auth/user.model');
const { CAMPUS_SCOPE } = require('../../shared/constants/enums');
const { fail, fieldErrors, paginate, isObjectId } = require('../../core/utils/http');

const notificationView = (n) => ({
  id: String(n._id),
  scope: n.scope,
  campus: n.campus,
  type: n.type,
  title: n.title,
  content: n.content,
  refType: n.refType ?? null,
  refId: n.refId ? String(n.refId) : null,
  isRead: n.scope === 'broadcast' ? true : Boolean(n.isRead),
  readAt: n.readAt ?? null,
  createdByName: n.createdByName ?? null,
  createdAt: n.createdAt,
});

/** Helper nội bộ: gửi thông báo vào chuông của 1 sinh viên theo studentId */
async function notifyStudent(studentId, { type, title, content, refType = null, refId = null, campus = 'all' }) {
  if (!studentId) return null;
  const user = await User.findOne({ studentId }).select('_id').lean();
  if (!user) return null;
  return Notification.create({
    recipientId: user._id,
    scope: 'personal',
    campus,
    type,
    title,
    content,
    refType,
    refId,
  });
}

/** Helper nội bộ: gửi thông báo đồng loạt cho nhiều sinh viên (VD: chốt hóa đơn điện nước phòng) */
async function notifyStudents(studentIds, payload) {
  const uniqueIds = [...new Set((studentIds || []).filter(Boolean).map(String))];
  if (!uniqueIds.length) return 0;
  const users = await User.find({ studentId: { $in: uniqueIds } }).select('_id').lean();
  if (!users.length) return 0;
  await Notification.insertMany(
    users.map((u) => ({
      recipientId: u._id,
      scope: 'personal',
      campus: payload.campus || 'all',
      type: payload.type,
      title: payload.title,
      content: payload.content,
      refType: payload.refType || null,
      refId: payload.refId || null,
    }))
  );
  return users.length;
}

/** Công khai: GET /api/public/announcements?campus=&limit= */
async function listPublicAnnouncements(q = {}) {
  const filter = { scope: 'broadcast' };
  if (q.campus && q.campus !== 'all' && CAMPUS_SCOPE.includes(q.campus)) {
    filter.campus = { $in: ['all', q.campus] };
  }
  const rows = (await Notification.find(filter).sort({ createdAt: -1 }).lean()).map(notificationView);
  return { data: paginate(rows, { limit: 20, ...q }) };
}

/** Quản trị: POST /api/notifications/announcements */
async function createAnnouncement(body = {}, actor) {
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const campus = body.campus ? String(body.campus).trim().toLowerCase() : 'all';
  const errors = [];
  if (!title) errors.push({ field: 'title', message: 'Nhập tiêu đề bảng tin' });
  if (!content) errors.push({ field: 'content', message: 'Nhập nội dung thông báo' });
  if (!CAMPUS_SCOPE.includes(campus)) errors.push({ field: 'campus', message: 'Cơ sở không hợp lệ (cs1, cs2, cs3 hoặc all)' });
  if (errors.length) fieldErrors(errors);

  const created = await Notification.create({
    recipientId: null,
    scope: 'broadcast',
    campus,
    type: 'announcement',
    title,
    content,
    createdBy: actor.id,
    createdByName: actor.fullName,
  });
  return { data: notificationView(created.toObject()), message: 'Đã đăng bảng tin KTX', status: 201 };
}

/** Quản trị: DELETE /api/notifications/announcements/:id */
async function deleteAnnouncement(id) {
  const doc = isObjectId(id) ? await Notification.findOneAndDelete({ _id: id, scope: 'broadcast' }) : null;
  if (!doc) fail(404, 'NOT_FOUND', 'Không tìm thấy bảng tin');
  return { data: null, message: 'Đã xóa bảng tin' };
}

/** Portal SV: danh sách thông báo cá nhân + bảng tin chung kèm unreadCount */
async function listForUser(userId, q = {}) {
  const filter = { $or: [{ scope: 'personal', recipientId: userId }, { scope: 'broadcast' }] };
  if (q.type) filter.type = q.type;
  const list = await Notification.find(filter).sort({ createdAt: -1 }).lean();
  const unreadCount = list.filter((n) => n.scope === 'personal' && !n.isRead).length;
  return { data: paginate(list.map(notificationView), { limit: 30, ...q }, { unreadCount }) };
}

async function countUnreadForUser(userId) {
  return Notification.countDocuments({ scope: 'personal', recipientId: userId, isRead: false });
}

async function markRead(userId, id) {
  const updated = isObjectId(id)
    ? await Notification.findOneAndUpdate(
        { _id: id, scope: 'personal', recipientId: userId },
        { $set: { isRead: true, readAt: new Date() } },
        { returnDocument: 'after' }
      ).lean()
    : null;
  if (!updated) fail(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
  return { data: notificationView(updated), message: 'Đã đánh dấu đã đọc' };
}

async function markAllRead(userId) {
  const res = await Notification.updateMany(
    { scope: 'personal', recipientId: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { data: { modifiedCount: res.modifiedCount }, message: 'Đã đánh dấu tất cả là đã đọc' };
}

module.exports = {
  notifyStudent,
  notifyStudents,
  listPublicAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  listForUser,
  countUnreadForUser,
  markRead,
  markAllRead,
};

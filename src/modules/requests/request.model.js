/**
 * Phiếu Yêu cầu Trực tuyến của Sinh viên (HaUI - DMS v3.0 — Collection 10: `requests`).
 * 3 loại nghiệp vụ cốt lõi:
 *   - `repair`:   Báo hỏng sửa chữa cơ sở vật chất (điện, nước, điều hòa, nội thất...)
 *   - `transfer`: Xin chuyển phòng (chỉ Manager duyệt -> tự khóa chỗ phòng mới & nhả chỗ phòng cũ nguyên tử)
 *   - `checkout`: Đăng ký xin trả phòng trước hạn / đúng hạn (UC14)
 */

const mongoose = require('mongoose');
const { REQUEST_TYPE, REQUEST_STATUS, REPAIR_CATEGORY } = require('../../shared/constants/enums');
const toJSON = require('../../shared/to-json');

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });

const requestSchema = new mongoose.Schema(
  {
    requestCode: { type: String, required: true, unique: true, trim: true },
    studentId: { ...ref('Student'), required: true },
    contractId: { ...ref('Contract'), required: true },
    roomId: { ...ref('Room'), required: true },
    type: { type: String, enum: REQUEST_TYPE, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    repairCategory: { type: String, enum: [...REPAIR_CATEGORY, null], default: null },
    /** Phòng mong muốn chuyển sang (áp dụng khi `type === 'transfer'`) */
    targetRoomId: ref('Room'),
    attachmentUrl: { type: String, default: null, trim: true },
    status: { type: String, enum: REQUEST_STATUS, default: 'pending' },
    handlerNote: { type: String, default: '', trim: true },
    handledBy: ref('User'),
    handledByName: { type: String, default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON }
);

requestSchema.index({ studentId: 1, createdAt: -1 });
requestSchema.index({ type: 1, status: 1 });
requestSchema.index({ roomId: 1, status: 1 });

module.exports = mongoose.model('Request', requestSchema);

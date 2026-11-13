/**
 * Đơn đăng ký và hợp đồng — API.md §5 (công khai), §6 (cán bộ). Một collection `contracts` cho cả hai:
 *   pending (đơn chờ) → active (duyệt) → terminated (thanh lý) ; pending → rejected (từ chối)
 * `expired` không lưu, suy ra lúc đọc (views.contractStatusOf).
 *
 * ⚠️ BR-05: giường CHỈ khóa lúc duyệt, bằng MỘT lệnh có điều kiện trên đúng giường đó ($elemMatch).
 *    Lọc `{'beds.bedNumber': n, 'beds.status': 'available'}` (không $elemMatch) sai: khớp khi phòng có BẤT KỲ giường
 *    trống nào, rồi `$` trỏ nhầm phần tử → hai người một giường. Đừng "đơn giản hóa" điều kiện này.
 * CSDL không chạy replica set nên không có transaction: duyệt đơn tự hoàn tác (trả giường) nếu bước sau lỗi.
 */

const Contract = require('./contract.model');
const Student = require('../students/student.model');
const User = require('../auth/user.model');
const Room = require('../rooms/room.model');
const Building = require('../rooms/building.model');
const Invoice = require('../fees/invoice.model');
const { pickStudent, studentErrors } = require('../students/student.rules');
const { fail, fieldErrors, paginate, matches, isObjectId } = require('../../core/utils/http');
const { createWithCode, yearPrefix } = require('../../core/utils/code-generator');
const { today, addDays, addMonths } = require('../../core/utils/dates');
const { TERM_MONTHS } = require('../../shared/constants/enums');
const {
  loadCtx, contractView, invoiceView, contractStatusOf, roomRef, debtsOf, byId,
} = require('../../shared/views');
const { numericSort } = require('../rooms/room.service');
const logger = require('../../core/logger/logger');

const pad2 = (n) => String(n).padStart(2, '0');
const bedText = (b, room, n) => `giường ${pad2(n)} phòng ${b?.code ?? ''}-${room.roomNumber}`;
const genderText = (g) => (g === 'male' ? 'nam' : 'nữ');

async function pendingOn(roomId, bedNumber, exceptId = null) {
  return Contract.exists({ roomId, bedNumber, status: 'pending', ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
}

async function findContract(id, message = 'Không tìm thấy hợp đồng') {
  const c = isObjectId(id) ? await Contract.findById(id).lean() : null;
  if (!c) fail(404, 'NOT_FOUND', message);
  return c;
}

async function viewOne(c) {
  const ctx = await loadCtx({ roomIds: [c.roomId], studentIds: [c.studentId] });
  return contractView(c, ctx, await debtsOf([c.studentId]));
}

// ================================================================ công khai (§5, không cần token)

/** GET /public/rooms/available?gender= — phòng còn giường chọn được, xếp tầng → số phòng (BR-07), không lộ tên người ở */
async function availableRooms(q = {}) {
  if (!['male', 'female'].includes(q.gender)) fieldErrors([{ field: 'gender', message: 'Chọn giới tính để xem phòng trống' }]);
  const open = await Building.find({ isActive: true }).lean();
  const buildings = byId(open);
  const rooms = await Room.find({
    status: 'active', gender: q.gender, buildingId: { $in: open.map((b) => b._id) }, ...(q.buildingId ? { buildingId: q.buildingId } : {}),
  }).lean();
  const pending = await Contract.find({ roomId: { $in: rooms.map((r) => r._id) }, status: 'pending' }).select('roomId bedNumber').lean();
  const held = (roomId, n) => pending.some((p) => String(p.roomId) === String(roomId) && p.bedNumber === n);
  const ctx = { buildings };
  const rows = rooms.map((r) => {
    const beds = (r.beds || []).slice().sort((a, b) => a.bedNumber - b.bedNumber)
      .map((b) => ({ bedNumber: b.bedNumber, status: b.status, hasPendingApplication: held(r._id, b.bedNumber) }));
    return {
      ...roomRef(r, ctx), pricePerMonth: r.pricePerMonth, depositAmount: r.depositAmount,
      availableSlots: beds.filter((b) => b.status === 'available' && !b.hasPendingApplication).length,
      beds,
    };
  }).filter((r) => r.availableSlots > 0).sort(numericSort);
  return { data: paginate(rows, { page: 1, limit: 100, ...q }) };
}

/** POST /contracts/register-online (FR-30) — giá đọc từ phòng, KHÔNG khóa giường (BR-05 khóa lúc duyệt) */
async function registerOnline(body = {}) {
  const profile = pickStudent(body);
  const errors = studentErrors(profile);
  if (!TERM_MONTHS[body.term]) errors.push({ field: 'term', message: 'Chọn gói thuê 6 hoặc 12 tháng' });
  if (!isObjectId(body.roomId)) errors.push({ field: 'roomId', message: 'Chọn phòng' });
  if (!(Number(body.bedNumber) >= 1)) errors.push({ field: 'bedNumber', message: 'Chọn giường' });
  if (errors.length) fieldErrors(errors);

  let st = await Student.findOne({ studentCode: profile.studentCode });
  if (st && (await Contract.exists({ studentId: st._id, status: { $in: ['pending', 'active'] } }))) {
    fail(409, 'APPLICATION_OR_CONTRACT_EXISTS', 'Mã sinh viên này đã có đơn đăng ký hoặc đang lưu trú tại ký túc xá');
  }
  const room = await Room.findOne({ _id: body.roomId, status: 'active' }).lean();
  const building = room && (await Building.findOne({ _id: room.buildingId, isActive: true }).lean());
  if (!room || !building) fail(404, 'NOT_FOUND', 'Phòng không còn nhận đơn, vui lòng chọn phòng khác');
  if (room.gender !== profile.gender) fail(422, 'GENDER_MISMATCH', `Phòng này chỉ dành cho sinh viên ${genderText(room.gender)}`);
  const bedNumber = Number(body.bedNumber);
  const bed = (room.beds || []).find((b) => b.bedNumber === bedNumber);
  if (!bed || bed.status !== 'available') fail(409, 'BED_ALREADY_OCCUPIED', `${bedText(building, room, bedNumber)} không còn trống, vui lòng chọn giường khác`);
  if (await pendingOn(room._id, bedNumber)) fail(409, 'BED_ALREADY_REQUESTED', `${bedText(building, room, bedNumber)} vừa có người khác đăng ký, vui lòng chọn giường khác`);

  // MSSV đã có hồ sơ (sinh viên cũ quay lại) → dùng lại hồ sơ, cập nhật theo form
  if (st) { Object.assign(st, profile); await st.save(); } else st = await Student.create({ ...profile, status: 'active' });

  const months = TERM_MONTHS[body.term];
  const c = await createWithCode(Contract, 'contractCode', yearPrefix('HD'), (contractCode) => ({
    contractCode, studentId: st._id, roomId: room._id, bedNumber, term: body.term, status: 'pending',
    pricePerMonth: room.pricePerMonth, totalRoomFee: room.pricePerMonth * months, depositAmount: room.depositAmount,
  }));
  return {
    data: {
      contractCode: c.contractCode, status: c.status, room: roomRef(room, { buildings: byId([building]) }), bedNumber, term: c.term,
      pricePerMonth: c.pricePerMonth, totalRoomFee: c.totalRoomFee, depositAmount: c.depositAmount,
    },
    message: 'Đã gửi đơn đăng ký. Vui lòng theo dõi email để nhận kết quả xét duyệt',
    status: 201,
  };
}

/** GET /public/applications/status?studentCode=&email= (FR-33) — sai mã hay sai email đều báo như nhau */
async function applicationStatus(q = {}) {
  const code = String(q.studentCode || '').trim().toUpperCase();
  const mail = String(q.email || '').trim().toLowerCase();
  if (!code || !mail) fail(400, 'VALIDATION_ERROR', 'Nhập mã sinh viên và email đã khai trong đơn');
  const st = await Student.findOne({ studentCode: code, email: mail }).lean();
  const c = st && (await Contract.findOne({ studentId: st._id }).sort({ createdAt: -1 }).lean());
  if (!c) fail(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy đơn đăng ký khớp mã sinh viên và email này');
  const ctx = await loadCtx({ roomIds: [c.roomId] });
  return {
    data: {
      contractCode: c.contractCode, status: contractStatusOf(c), submittedAt: c.createdAt, room: roomRef(ctx.rooms.get(String(c.roomId)), ctx),
      bedNumber: c.bedNumber, term: c.term, startDate: c.startDate, endDate: c.endDate, rejectionReason: c.rejectionReason,
      pricePerMonth: c.pricePerMonth, totalRoomFee: c.totalRoomFee, depositAmount: c.depositAmount,
    },
  };
}

// ================================================================ cán bộ (§6)

/** ?status= một hoặc nhiều trạng thái, cách nhau dấu phẩy. `summary` đếm theo tab, không phụ thuộc bộ lọc */
async function list(q = {}) {
  const all = await Contract.find().lean();
  const ctx = await loadCtx({ roomIds: all.map((c) => c.roomId), studentIds: all.map((c) => c.studentId) });
  const debts = await debtsOf(all.map((c) => c.studentId));
  let rows = all.map((c) => contractView(c, ctx, debts));
  const summary = {
    pending: 0, active: 0, expired: 0, terminated: 0, rejected: 0,
    awaitingDepositRefund: all.filter((c) => c.status === 'terminated' && !c.isDepositRefunded).length,
  };
  rows.forEach((c) => { summary[c.status] += 1; });

  const statuses = q.status ? String(q.status).split(',') : null;
  if (statuses) rows = rows.filter((c) => statuses.includes(c.status));
  if (q.buildingId) rows = rows.filter((c) => c.buildingId === String(q.buildingId));
  if (q.roomId) rows = rows.filter((c) => c.roomId === String(q.roomId));
  if (q.term) rows = rows.filter((c) => c.term === q.term);
  if (q.isDepositRefunded !== undefined && q.isDepositRefunded !== '') rows = rows.filter((c) => String(c.isDepositRefunded) === String(q.isDepositRefunded));
  rows = rows.filter((c) => matches(q.search, [c.contractCode, c.studentCode, c.studentName, c.roomNumber, `${c.buildingCode}-${c.roomNumber}`]));
  // Đơn chờ: nộp sớm lên đầu · còn lại: mốc gần nhất (bắt đầu / xử lý / nộp) lên đầu
  const key = (c) => String(c.startDate || c.reviewedAt?.toISOString?.() || c.reviewedAt || c.createdAt?.toISOString?.() || c.createdAt);
  if (statuses?.length === 1 && statuses[0] === 'pending') rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  else rows.sort((a, b) => key(b).localeCompare(key(a)) || a.contractCode.localeCompare(b.contractCode));
  return { data: paginate(rows, q, { summary }) };
}

async function getById(id) {
  const c = await findContract(id);
  const st = await Student.findById(c.studentId).lean();
  const invoices = await Invoice.find({ contractId: c._id }).sort({ createdAt: -1 }).lean();
  const ctx = await loadCtx({ roomIds: [c.roomId], studentIds: [c.studentId] });
  const view = contractView(c, ctx, await debtsOf([c.studentId]));
  const status = view.status;
  const history = [
    { at: c.createdAt, type: 'application_submitted', title: 'Nộp đơn đăng ký', description: `Mã ${c.contractCode}` },
    c.reviewedAt && c.status !== 'rejected' && {
      at: c.reviewedAt, type: 'application_approved', title: 'Duyệt đơn, khóa giường',
      description: `Phòng ${view.roomNumber} giường ${pad2(c.bedNumber)} · tạo hóa đơn tiền cọc và tiền phòng cả kỳ`,
    },
    c.status === 'rejected' && { at: c.reviewedAt, type: 'rejected', title: 'Từ chối đơn', description: c.rejectionReason },
    status === 'expired' && { at: c.endDate, type: 'expired', title: 'Hết hạn hợp đồng', description: 'Chưa thanh lý — sinh viên vẫn giữ giường' },
    c.status === 'terminated' && { at: c.terminatedAt, type: 'terminated', title: 'Thanh lý hợp đồng', description: 'Trả phòng, giường trả về trống' },
    c.isDepositRefunded && {
      at: c.depositRefundedAt, type: 'deposit_refunded', title: 'Hoàn cọc',
      description: `Đã trả lại tiền cọc${c.depositRefundedByName ? ` · ${c.depositRefundedByName}` : ''}`,
    },
  ].filter(Boolean).sort((a, b) => new Date(b.at) - new Date(a.at));
  const invoiceViews = invoices.map((i) => invoiceView(i, ctx));
  return {
    data: {
      ...view,
      student: {
        id: String(st._id), studentCode: st.studentCode, fullName: st.fullName, gender: st.gender, phone: st.phone, email: st.email,
        dob: st.dob, citizenId: st.citizenId, address: st.address, faculty: st.faculty, className: st.className, emergencyContact: st.emergencyContact,
      },
      depositStatus: invoiceViews.find((i) => i.type === 'deposit')?.status ?? null,
      invoices: invoiceViews,
      history,
    },
  };
}

/** Hai hóa đơn cá nhân lúc duyệt (FR-32): tiền cọc và tiền phòng cả kỳ, hạn 7 ngày */
async function issuePersonalInvoices(c, room, building) {
  const dueDate = addDays(today(), 7);
  const make = (type) => createWithCode(Invoice, 'invoiceCode', yearPrefix('INV'), (invoiceCode) => ({
    invoiceCode, type, scope: 'personal',
    amount: type === 'deposit' ? c.depositAmount : c.totalRoomFee,
    description: type === 'deposit'
      ? `Tiền đặt cọc - ${c.contractCode}`
      : `Tiền phòng ${building.code}-${room.roomNumber} - ${TERM_MONTHS[c.term]} tháng (${c.contractCode})`,
    studentId: c.studentId, roomId: room._id, contractId: c._id, dueDate, status: 'unpaid',
  }));
  return [await make('deposit'), await make('room_semester')];
}

/** PATCH /contracts/:id/approve — { roomId?, bedNumber? }: bỏ trống là giữ giường SV đã chọn (FR-32, UC-02 4a) */
async function approve(id, body = {}, actor) {
  const c = await findContract(id, 'Không tìm thấy đơn đăng ký');
  if (c.status !== 'pending') fail(409, 'CONTRACT_NOT_PENDING', 'Đơn đăng ký đã được xử lý');
  const st = await Student.findById(c.studentId).lean();
  const roomId = body.roomId || c.roomId;
  const room = isObjectId(roomId) ? await Room.findById(roomId).lean() : null;
  if (!room) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  const building = await Building.findById(room.buildingId).lean();
  if (room.status !== 'active' || !building?.isActive) {
    fail(422, 'ROOM_NOT_AVAILABLE', `Phòng ${building?.code ?? ''}-${room.roomNumber} đang bảo trì hoặc tòa ngừng hoạt động — chọn phòng khác`);
  }
  const bedNo = Number(body.bedNumber ?? c.bedNumber);
  if (room.gender !== st.gender) fail(422, 'GENDER_MISMATCH', `Phòng này chỉ dành cho sinh viên ${genderText(room.gender)}`);
  if (await Contract.exists({ studentId: st._id, status: 'active' })) fail(409, 'APPLICATION_OR_CONTRACT_EXISTS', 'Sinh viên đã có hợp đồng đang hiệu lực');
  if (await pendingOn(room._id, bedNo, c._id)) fail(409, 'BED_ALREADY_REQUESTED', `${bedText(building, room, bedNo)} đang được giữ cho một đơn khác`);

  // Tài khoản: dùng lại tài khoản của chính SV (SV cũ quay lại); email đã thuộc người khác thì DỪNG, không gắn nhầm
  let account = await User.findOne({ studentId: st._id });
  const email = String(st.email || '').toLowerCase();
  if (!account && (await User.exists({ email }))) {
    fail(409, 'EMAIL_ALREADY_USED', `Email ${st.email} đã thuộc tài khoản khác. Liên hệ sinh viên để đổi email trong đơn`);
  }

  // BR-05: khóa ĐÚNG giường, một lệnh có điều kiện
  const locked = await Room.findOneAndUpdate(
    { _id: room._id, beds: { $elemMatch: { bedNumber: bedNo, status: 'available' } } },
    { $set: { 'beds.$.status': 'occupied', 'beds.$.studentId': st._id } },
    { returnDocument: 'after' }
  );
  if (!locked) fail(409, 'BED_ALREADY_OCCUPIED', `${bedText(building, room, bedNo)} vừa có người nhận. Vui lòng chọn giường khác`);

  const releaseBed = () => Room.updateOne(
    { _id: room._id, beds: { $elemMatch: { bedNumber: bedNo, studentId: st._id } } },
    { $set: { 'beds.$.status': 'available', 'beds.$.studentId': null } }
  );
  try {
    const months = TERM_MONTHS[c.term];
    const startDate = today();
    const updated = await Contract.findOneAndUpdate(
      { _id: c._id, status: 'pending' },
      {
        $set: {
          status: 'active', roomId: room._id, bedNumber: bedNo,
          pricePerMonth: room.pricePerMonth, depositAmount: room.depositAmount, totalRoomFee: room.pricePerMonth * months,
          startDate, endDate: addMonths(startDate, months),
          reviewedAt: new Date(), reviewedBy: actor.id, reviewedByName: actor.fullName,
        },
      },
      { returnDocument: 'after' }
    ).lean();
    if (!updated) { await releaseBed(); fail(409, 'CONTRACT_NOT_PENDING', 'Đơn đăng ký đã được xử lý'); }

    // FR-02, BR-06: tài khoản = mật khẩu = MSSV, buộc đổi ở lần đăng nhập đầu
    const isNew = !account;
    if (isNew) {
      account = await User.create({
        email, fullName: st.fullName, role: 'student', studentId: st._id, studentCode: st.studentCode,
        passwordHash: await User.hashPassword(st.studentCode), mustChangePassword: true,
      });
    }
    const created = await issuePersonalInvoices(updated, room, building);
    // Chưa có dịch vụ gửi mail: báo `emailSent: false` để màn duyệt nhắc cán bộ tự báo SV (API.md §6)
    logger.info(`[Duyệt đơn] ${updated.contractCode}: cần gửi tài khoản ${st.studentCode} tới ${email}`);
    return {
      data: {
        contract: await viewOne(updated),
        account: { studentCode: st.studentCode, email: account.email, isNew },
        emailSent: false,
        invoices: created.map((i) => ({ id: String(i._id), invoiceCode: i.invoiceCode, type: i.type, amount: i.amount, dueDate: i.dueDate })),
      },
      message: 'Đã duyệt đơn',
    };
  } catch (err) {
    // Hoàn tác thủ công (không có transaction): trả giường, đưa đơn về chờ duyệt
    if (err.statusCode !== 409) {
      await releaseBed();
      await Contract.updateOne({ _id: c._id, status: 'active' }, { $set: { status: 'pending', startDate: null, endDate: null, reviewedAt: null } });
      await Invoice.deleteMany({ contractId: c._id, status: 'unpaid' });
    }
    throw err;
  }
}

/** PATCH /contracts/:id/reject — { reason } bắt buộc (FR-33), không đụng giường */
async function reject(id, body = {}, actor) {
  const reason = String(body.reason || '').trim();
  if (!reason) fieldErrors([{ field: 'reason', message: 'Nhập lý do từ chối' }]);
  const c = await findContract(id, 'Không tìm thấy đơn đăng ký');
  if (c.status !== 'pending') fail(409, 'CONTRACT_NOT_PENDING', 'Đơn đăng ký đã được xử lý');
  const updated = await Contract.findOneAndUpdate(
    { _id: c._id, status: 'pending' },
    { $set: { status: 'rejected', rejectionReason: reason, reviewedAt: new Date(), reviewedBy: actor.id, reviewedByName: actor.fullName } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'CONTRACT_NOT_PENDING', 'Đơn đăng ký đã được xử lý');
  return { data: await viewOne(updated), message: 'Đã từ chối đơn đăng ký' };
}

/**
 * PATCH /contracts/:id/terminate — thanh lý khi SV trả phòng tại văn phòng (FR-34, D1). Không body.
 * Áp cho active và expired (lưu là active). BR-04: còn hóa đơn cá nhân hoặc điện nước của phòng chưa trả thì chặn.
 */
async function terminate(id) {
  const c = await findContract(id);
  if (c.status !== 'active') fail(409, 'CONTRACT_NOT_TERMINABLE', 'Chỉ thanh lý được hợp đồng đang hiệu lực hoặc đã hết hạn');
  const outstanding = await Invoice.find({
    status: 'unpaid',
    $or: [{ studentId: c.studentId, scope: 'personal' }, { type: 'utility', roomId: c.roomId }],
  }).lean();
  if (outstanding.length) {
    fail(422, 'OUTSTANDING_INVOICES', `Còn ${outstanding.length} hóa đơn chưa thanh toán, chưa thể thanh lý`, {
      invoices: outstanding.map((i) => ({ id: String(i._id), invoiceCode: i.invoiceCode, type: i.type, amount: i.amount, status: i.status })),
    });
  }
  const updated = await Contract.findOneAndUpdate(
    { _id: c._id, status: 'active' }, { $set: { status: 'terminated', terminatedAt: today() } }, { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'CONTRACT_NOT_TERMINABLE', 'Hợp đồng vừa được xử lý');
  // Trả đúng giường của sinh viên này
  await Room.updateOne(
    { _id: c.roomId, beds: { $elemMatch: { bedNumber: c.bedNumber, studentId: c.studentId } } },
    { $set: { 'beds.$.status': 'available', 'beds.$.studentId': null } }
  );
  return { data: { contract: await viewOne(updated) }, message: `Đã thanh lý hợp đồng ${c.contractCode}` };
}

/** PATCH /contracts/:id/deposit-refund — xác nhận đã trả cọc tại văn phòng (FR-35, BR-08): một chiều, một lần, hoàn đủ */
async function refundDeposit(id, actor) {
  const c = await findContract(id);
  if (c.status !== 'terminated') fail(409, 'CONTRACT_NOT_TERMINATED', 'Chỉ hoàn cọc sau khi đã thanh lý hợp đồng');
  if (c.isDepositRefunded) fail(409, 'DEPOSIT_ALREADY_REFUNDED', 'Hợp đồng này đã được xác nhận hoàn cọc');
  const updated = await Contract.findOneAndUpdate(
    { _id: c._id, status: 'terminated', isDepositRefunded: false },
    { $set: { isDepositRefunded: true, depositRefundedAt: new Date(), depositRefundedBy: actor.id, depositRefundedByName: actor.fullName } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'DEPOSIT_ALREADY_REFUNDED', 'Hợp đồng này đã được xác nhận hoàn cọc');
  return { data: await viewOne(updated), message: 'Đã xác nhận hoàn cọc' };
}

module.exports = {
  availableRooms, registerOnline, applicationStatus,
  list, getById, approve, reject, terminate, refundDeposit,
};

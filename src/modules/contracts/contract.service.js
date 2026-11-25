/**
 * Đơn đăng ký & Hợp đồng lưu trú — HaUI - DMS v3.0 (Quản lý gọn tới cấp Phòng).
 * Vòng đời:
 *   pending -> pending_payment (khóa 1 chỗ phòng nguyên tử, hạn đóng phí 7 ngày)
 *           -> active (tự kích hoạt khi gạch nợ đủ tiền phòng & cọc + sinh mã QR Check-in)
 *           -> terminated (sạch nợ 100% -> nhả chỗ phòng -> hoàn cọc có khấu trừ hỏng đồ)
 *   pending -> rejected / cancelled (SV tự hủy)
 *   pending_payment -> cancelled (quá hạn đóng phí -> hủy 2 HĐ nháp & nhả chỗ phòng ngay)
 */

const crypto = require('crypto');
const Contract = require('./contract.model');
const RegistrationPeriod = require('../periods/registration-period.model');
const Student = require('../students/student.model');
const User = require('../auth/user.model');
const Room = require('../rooms/room.model');
const Building = require('../rooms/building.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const periodService = require('../periods/period.service');
const notificationService = require('../notifications/notification.service');
const { pickStudent, studentErrors } = require('../students/student.rules');
const { fail, fieldErrors, paginate, matches, isObjectId } = require('../../core/utils/http');
const { createWithCode, yearPrefix } = require('../../core/utils/code-generator');
const { today, addDays, addMonths } = require('../../core/utils/dates');
const {
  CAMPUSES,
  CAMPUS_INFO,
  ROOM_PRICES_2026,
  TERM_MONTHS,
} = require('../../shared/constants/enums');
const {
  loadCtx,
  contractView,
  invoiceView,
  contractStatusOf,
  roomRef,
  debtsOf,
  byId,
} = require('../../shared/views');
const { availableSlotsOf } = require('../rooms/room.service');
const logger = require('../../core/logger/logger');
const { sendAccountEmail, sendRejectionEmail, sendCheckinReadyEmail } = require('../../core/email/email.service');

const genderText = (g) => (g === 'male' ? 'nam' : 'nữ');
const termLabel = (term) => `${TERM_MONTHS[term] ?? ''} tháng`;

async function findContract(id, message = 'Không tìm thấy hợp đồng') {
  const c = isObjectId(id) ? await Contract.findById(id).lean() : null;
  if (!c) fail(404, 'NOT_FOUND', message);
  return c;
}

async function viewOne(c) {
  const ctx = await loadCtx({ roomIds: [c.roomId], studentIds: [c.studentId] });
  return contractView(c, ctx, await debtsOf([c.studentId]));
}

/** Kiểm tra phòng có nhận được sinh viên giới tính `gender` không (cùng giới hoặc phòng đang trống hoàn toàn) */
const roomAcceptsGender = (room, gender) =>
  room.gender === gender || (!room.gender && (room.occupiedCount || 0) === 0);

/** Khóa nguyên tử 1 chỗ trống & tự động gán giới tính nếu là người đầu tiên vào phòng trống (BR-05) */
const lockRoomSlot = (roomId, gender) =>
  Room.findOneAndUpdate(
    {
      _id: roomId,
      status: 'active',
      $expr: { $lt: ['$occupiedCount', '$capacity'] },
      ...(gender ? { $or: [{ gender }, { gender: null, occupiedCount: 0 }] } : {}),
    },
    { $inc: { occupiedCount: 1 }, ...(gender ? { $set: { gender } } : {}) },
    { returnDocument: 'after' }
  );

/** Giải phóng 1 chỗ trong phòng an toàn; nếu phòng về 0 người -> tự động mở lại thành phòng Trống (`gender: null`) */
async function releaseRoomSlot(roomId) {
  const updated = await Room.findOneAndUpdate(
    { _id: roomId, occupiedCount: { $gt: 0 } },
    { $inc: { occupiedCount: -1 } },
    { returnDocument: 'after' }
  );
  if (updated && updated.occupiedCount === 0) {
    await Room.updateOne({ _id: roomId, occupiedCount: 0 }, { $set: { gender: null } });
  }
  return updated;
}

// ================================================================ 1. TRANG CHỦ CÔNG KHAI (§1)

/** GET /api/public/campuses — Thông tin 3 cơ sở (địa chỉ 2026), tòa nhà hoạt động & bảng giá 2026-2027 */
async function publicCampuses() {
  const buildings = await Building.find({ isActive: true }).sort({ campus: 1, code: 1 }).lean();
  const rooms = await Room.find({ buildingId: { $in: buildings.map((b) => b._id) } })
    .select('buildingId capacity occupiedCount status')
    .lean();

  const campuses = CAMPUSES.map((code) => {
    const info = CAMPUS_INFO[code];
    const ownB = buildings.filter((b) => b.campus === code);
    const ownR = rooms.filter((r) => ownB.some((b) => String(b._id) === String(r.buildingId)));
    return {
      ...info,
      buildings: ownB.map((b) => ({
        id: String(b._id),
        code: b.code,
        name: b.name,
        totalFloors: b.totalFloors || 5,
        description: b.description || '',
      })),
      stats: {
        totalRooms: ownR.length,
        totalSlots: ownR.reduce((t, r) => t + (r.capacity || 0), 0),
        occupiedSlots: ownR.reduce((t, r) => t + (r.occupiedCount || 0), 0),
        availableSlots: ownR.reduce((t, r) => t + availableSlotsOf(r), 0),
      },
    };
  });

  return {
    data: {
      academicYear: '2026-2027',
      campuses,
      priceTable: ROOM_PRICES_2026,
      hotline: '0964.331.300',
      website: 'https://ssc.haui.edu.vn',
    },
  };
}

/**
 * Sắp xếp xếp phòng chuẩn KTX:
 * 1. Lấp đầy phòng cùng giới đang có người trước (tránh rải rác, giữ phòng trống linh hoạt cho giới tính còn lại)
 * 2. Lấp đầy lần lượt từ TẦNG THẤP -> TẦNG CAO (`floor ASC`)
 * 3. Cùng tầng theo mã tòa và số phòng tăng dần (`buildingCode ASC`, `roomNumber ASC`)
 */
const placementSort = (gender) => (a, b) => {
  const aSame = a.gender === gender && (a.occupied ?? a.occupiedCount ?? 0) > 0 ? 0 : 1;
  const bSame = b.gender === gender && (b.occupied ?? b.occupiedCount ?? 0) > 0 ? 0 : 1;
  if (aSame !== bSame) return aSame - bSame;
  return (
    (a.floor ?? 99) - (b.floor ?? 99) ||
    String(a.campus || '').localeCompare(String(b.campus || '')) ||
    String(a.buildingCode || '').localeCompare(String(b.buildingCode || '')) ||
    String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), 'vi', { numeric: true })
  );
};

const TIER_ORDER = { high_quality: 1, standard: 2, basic: 3 };

/** GET /api/public/rooms/available?periodId=&campus=&buildingId=&gender=&roomTier=&capacity= */
async function availableRooms(q = {}) {
  if (!['male', 'female'].includes(q.gender)) {
    fieldErrors([{ field: 'gender', message: 'Chọn giới tính để xem phòng còn chỗ' }]);
  }
  let campusFilter = q.campus && CAMPUSES.includes(q.campus) ? q.campus : null;
  if (q.periodId && isObjectId(q.periodId)) {
    const p = await RegistrationPeriod.findById(q.periodId).lean();
    if (p && p.campus !== 'all') campusFilter = p.campus;
  }

  const bQuery = { isActive: true, ...(campusFilter ? { campus: campusFilter } : {}) };
  const openBuildings = await Building.find(bQuery).lean();
  const buildings = byId(openBuildings);
  const bIds = openBuildings.map((b) => b._id);

  // Tải toàn bộ phòng đang hoạt động trong phạm vi cơ sở để tính đủ cả loại phòng CÒN CHỖ lẫn loại phòng HẾT CHỖ (khóa chọn)
  const campusRooms = await Room.find({
    status: 'active',
    buildingId: q.buildingId && isObjectId(q.buildingId) ? q.buildingId : { $in: bIds },
  }).lean();

  // Tổng hợp tất cả các loại phòng (roomTier + capacity) của cơ sở kèm số chỗ còn trống cho giới tính `q.gender`
  const typeMap = new Map();
  for (const r of campusRooms) {
    const key = `${r.roomTier || 'standard'}__${r.capacity}`;
    const usableSlots = roomAcceptsGender(r, q.gender) ? availableSlotsOf(r) : 0;
    const cur = typeMap.get(key);
    if (!cur) {
      typeMap.set(key, {
        key,
        roomTier: r.roomTier || 'standard',
        capacity: r.capacity,
        pricePerMonth: r.pricePerMonth,
        depositAmount: r.depositAmount,
        totalSlots: r.capacity || 0,
        availableSlots: usableSlots,
      });
    } else {
      cur.totalSlots += r.capacity || 0;
      cur.availableSlots += usableSlots;
      cur.pricePerMonth = Math.min(cur.pricePerMonth, r.pricePerMonth);
    }
  }
  const roomTypes = [...typeMap.values()]
    .map((t) => ({ ...t, isFull: t.availableSlots <= 0 }))
    .sort((a, b) => (TIER_ORDER[a.roomTier] ?? 9) - (TIER_ORDER[b.roomTier] ?? 9) || a.capacity - b.capacity);

  const matchingRooms = campusRooms.filter(
    (r) =>
      roomAcceptsGender(r, q.gender) &&
      (!q.roomTier || r.roomTier === q.roomTier) &&
      (!q.capacity || r.capacity === Number(q.capacity))
  );

  const pendingAgg = await Contract.aggregate([
    { $match: { roomId: { $in: matchingRooms.map((r) => r._id) }, status: 'pending' } },
    { $group: { _id: '$roomId', n: { $sum: 1 } } },
  ]);
  const pendingMap = new Map(pendingAgg.map((x) => [String(x._id), x.n]));
  const ctx = { buildings };

  const rows = matchingRooms
    .map((r) => {
      const availableSlots = availableSlotsOf(r);
      const pendingApplications = pendingMap.get(String(r._id)) || 0;
      const rr = roomRef(r, ctx);
      return {
        ...rr,
        pricePerMonth: r.pricePerMonth,
        depositAmount: r.depositAmount,
        amenities: r.amenities || [],
        occupied: r.occupiedCount || 0,
        availableSlots,
        pendingApplications,
        effectiveAvailableSlots: Math.max(0, availableSlots - pendingApplications),
      };
    })
    .filter((r) => r.availableSlots > 0)
    .sort(placementSort(q.gender));

  return { data: paginate(rows, { page: 1, limit: 100, ...q }, { roomTypes }) };
}

/**
 * Tự động chọn phòng trống tốt nhất theo quy tắc KTX thực tế:
 * - Giới tính phòng động: khớp phòng cùng giới tính đang mở còn chỗ trước, rồi mới mở phòng Trống (gender = null)
 * - Lấp đầy lần lượt từ TẦNG THẤP -> TẦNG CAO (floor ASC -> buildingCode ASC -> roomNumber ASC)
 * - Đúng tuyệt đối loại phòng nguyện vọng (roomTier/capacity) — hết loại phòng thì không tự đẩy sang loại khác.
 */
async function pickBestRoomForWish({ campus, gender, roomTier, capacity }) {
  const bQuery = { isActive: true, ...(campus && campus !== 'all' ? { campus } : {}) };
  const openBuildings = await Building.find(bQuery).lean();
  if (!openBuildings.length) return null;
  const bMap = byId(openBuildings);
  const allRooms = await Room.find({
    status: 'active',
    buildingId: { $in: openBuildings.map((b) => b._id) },
    $or: [{ gender }, { gender: null, occupiedCount: 0 }],
    ...(roomTier ? { roomTier } : {}),
    ...(capacity ? { capacity: Number(capacity) } : {}),
  }).lean();

  const sortFn = placementSort(gender);
  const candidates = allRooms
    .filter((r) => availableSlotsOf(r) > 0 && roomAcceptsGender(r, gender))
    .map((r) => ({ room: r, building: bMap.get(String(r.buildingId)) }))
    .sort((a, b) =>
      sortFn(
        {
          gender: a.room.gender,
          occupied: a.room.occupiedCount || 0,
          campus: a.building?.campus,
          buildingCode: a.building?.code,
          floor: a.room.floor,
          roomNumber: a.room.roomNumber,
        },
        {
          gender: b.room.gender,
          occupied: b.room.occupiedCount || 0,
          campus: b.building?.campus,
          buildingCode: b.building?.code,
          floor: b.room.floor,
          roomNumber: b.room.roomNumber,
        }
      )
    );

  return candidates[0] || null;
}

/** Logic dùng chung cho nộp đơn (cả Cổng công khai lẫn Portal nội bộ SV năm 2+) */
async function createApplication({ student, body }) {
  if (!isObjectId(body.periodId)) {
    fieldErrors([{ field: 'periodId', message: 'Vui lòng chọn đợt đăng ký KTX đang mở' }]);
  }
  const period = await RegistrationPeriod.findById(body.periodId).lean();
  if (!period) fail(404, 'NOT_FOUND', 'Không tìm thấy đợt đăng ký');
  const check = periodService.evaluateEligibility(period, { studentCode: student.studentCode, faculty: student.faculty });
  if (!check.eligible) {
    const code = periodService.isCurrentlyOpen(period) ? 'PERIOD_NOT_ELIGIBLE' : 'PERIOD_NOT_OPEN';
    fail(422, code, check.reason);
  }
  if (!TERM_MONTHS[body.term] || !(period.allowedTerms || []).includes(body.term)) {
    fail(422, 'TERM_NOT_ALLOWED_IN_PERIOD', `Đợt này chỉ chấp nhận các gói thời hạn: ${(period.allowedTerms || []).join(', ')}`);
  }

  if (await Contract.exists({ studentId: student._id, status: { $in: ['pending', 'pending_payment', 'active'] } })) {
    fail(409, 'APPLICATION_OR_CONTRACT_EXISTS', 'Sinh viên này đã có đơn đăng ký đang xử lý hoặc đang lưu trú tại ký túc xá');
  }

  const months = TERM_MONTHS[body.term];
  const preferredRoomTier = body.preferredRoomTier || null;
  const preferredCapacity = body.preferredCapacity ? Number(body.preferredCapacity) : null;

  let room = null;
  let building = null;
  let campus = period.campus !== 'all' ? period.campus : null;
  let estimatedPrice = 0;
  let estimatedDeposit = 500000;

  if (body.roomId) {
    if (!isObjectId(body.roomId)) fieldErrors([{ field: 'roomId', message: 'Mã phòng không hợp lệ' }]);
    room = await Room.findOne({ _id: body.roomId, status: 'active' }).lean();
    building = room && (await Building.findOne({ _id: room.buildingId, isActive: true }).lean());
    if (!room || !building) fail(404, 'NOT_FOUND', 'Phòng không còn nhận đơn, vui lòng chọn phòng khác');
    if (period.campus !== 'all' && building.campus !== period.campus) {
      fail(422, 'PERIOD_NOT_ELIGIBLE', `Phòng này thuộc cơ sở ${building.campus.toUpperCase()}, không thuộc phạm vi đợt đăng ký (${period.campus.toUpperCase()})`);
    }
    if (!roomAcceptsGender(room, student.gender)) fail(422, 'GENDER_MISMATCH', `Phòng này chỉ dành cho sinh viên ${genderText(room.gender)}`);
    if (availableSlotsOf(room) <= 0) fail(409, 'ROOM_FULL', `Phòng ${building.code}-${room.roomNumber} đã hết chỗ trống`);
    campus = building.campus;
    estimatedPrice = room.pricePerMonth;
    estimatedDeposit = room.depositAmount;
  } else {
    // Luồng chuẩn KTX: kiểm tra loại phòng nguyện vọng còn chỗ không; hết chỗ -> khóa & báo SV chọn loại phòng khác
    const sample = await pickBestRoomForWish({
      campus: period.campus,
      gender: student.gender,
      roomTier: preferredRoomTier,
      capacity: preferredCapacity,
    });
    if (!sample) {
      fail(409, 'ROOM_FULL', 'Loại phòng này hiện đã hết chỗ trống, vui lòng chọn loại phòng khác');
    }
    campus = campus || sample.building.campus;
    estimatedPrice = sample.room.pricePerMonth;
    estimatedDeposit = sample.room.depositAmount;
  }

  const totalRoomFee = Math.round(estimatedPrice * months);
  const c = await createWithCode(Contract, 'contractCode', yearPrefix('HD'), (contractCode) => ({
    contractCode,
    periodId: period._id,
    studentId: student._id,
    roomId: room ? room._id : null,
    campus,
    preferredRoomTier: preferredRoomTier || room?.roomTier || null,
    preferredCapacity: preferredCapacity || room?.capacity || null,
    term: body.term,
    status: 'pending',
    pricePerMonth: estimatedPrice,
    totalRoomFee,
    depositAmount: estimatedDeposit,
  }));

  return {
    data: {
      id: String(c._id),
      contractCode: c.contractCode,
      periodId: String(period._id),
      periodName: period.name,
      campus: c.campus,
      campusName: c.campus ? CAMPUS_INFO[c.campus]?.name ?? null : null,
      preferredRoomTier: c.preferredRoomTier,
      preferredCapacity: c.preferredCapacity,
      status: c.status,
      room: room ? roomRef(room, { buildings: byId([building]) }) : null,
      term: c.term,
      pricePerMonth: c.pricePerMonth,
      totalRoomFee: c.totalRoomFee,
      depositAmount: c.depositAmount,
    },
    message: 'Đã gửi đơn đăng ký KTX thành công. Ban quản lý sẽ xét duyệt và xếp phòng từ tầng thấp lên cao theo đúng giới tính.',
    status: 201,
  };
}

/** POST /api/contracts/register-online — Công khai (kiểm tra khớp CCCD nếu MSSV đã có hồ sơ để chống giả mạo) */
async function registerOnline(body = {}) {
  const profile = pickStudent(body);
  const errors = studentErrors(profile);
  if (!isObjectId(body.periodId)) errors.push({ field: 'periodId', message: 'Chọn đợt đăng ký KTX đang mở' });
  if (!TERM_MONTHS[body.term]) errors.push({ field: 'term', message: 'Chọn gói kỳ hạn hợp lệ' });
  if (errors.length) fieldErrors(errors);

  let st = await Student.findOne({ studentCode: profile.studentCode });
  if (st) {
    if (st.citizenId && st.citizenId !== profile.citizenId) {
      fail(403, 'IDENTITY_MISMATCH', 'MSSV này đã có hồ sơ trên hệ thống nhưng số CCCD không trùng khớp. Vui lòng kiểm tra lại hoặc liên hệ Trung tâm KTX');
    }
    Object.assign(st, profile);
    st.status = 'active';
    await st.save();
  } else {
    st = await Student.create({ ...profile, status: 'active' });
  }

  return createApplication({ student: st.toObject(), body });
}

/** POST /api/portal/applications — Sinh viên đã có tài khoản đăng ký/gia hạn kỳ mới ngay trên Portal */
async function applyFromPortal(studentId, body = {}) {
  const st = await Student.findById(studentId).lean();
  if (!st) fail(403, 'FORBIDDEN', 'Tài khoản chưa gắn với hồ sơ sinh viên');
  return createApplication({ student: st, body });
}

/** GET /api/public/applications/status?studentCode=&email= */
async function applicationStatus(q = {}) {
  const code = String(q.studentCode || '').trim().toUpperCase();
  const mail = String(q.email || '').trim().toLowerCase();
  if (!code || !mail) fail(400, 'VALIDATION_ERROR', 'Nhập mã sinh viên và email đã khai trong đơn');
  const st = await Student.findOne({ studentCode: code, email: mail }).lean();
  const c = st && (await Contract.findOne({ studentId: st._id }).sort({ createdAt: -1 }).lean());
  if (!c) fail(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy đơn đăng ký khớp mã sinh viên và email này');
  const ctx = await loadCtx({ roomIds: c.roomId ? [c.roomId] : [] });
  const rr = c.roomId ? roomRef(ctx.rooms.get(String(c.roomId)), ctx) : null;
  const effectiveCampus = rr?.campus ?? (c.campus && c.campus !== 'all' ? c.campus : null);
  return {
    data: {
      contractCode: c.contractCode,
      periodId: c.periodId ? String(c.periodId) : null,
      campus: effectiveCampus,
      campusName: rr?.campusName ?? (effectiveCampus ? CAMPUS_INFO[effectiveCampus]?.name ?? null : null),
      preferredRoomTier: c.preferredRoomTier ?? null,
      preferredCapacity: c.preferredCapacity ?? null,
      status: contractStatusOf(c),
      submittedAt: c.createdAt,
      room: rr,
      term: c.term,
      paymentDeadline: c.paymentDeadline ?? null,
      startDate: c.startDate ?? null,
      endDate: c.endDate ?? null,
      rejectionReason: c.rejectionReason ?? null,
      cancelReason: c.cancelReason ?? null,
      pricePerMonth: c.pricePerMonth,
      totalRoomFee: c.totalRoomFee,
      depositAmount: c.depositAmount,
    },
  };
}

/** POST /api/public/applications/cancel — SV tự hủy đơn khi đang pending (xác thực MSSV + Email + CCCD) */
async function cancelPendingByStudent(body = {}) {
  const code = String(body.studentCode || '').trim();
  const mail = String(body.email || '').trim().toLowerCase();
  const citizenId = String(body.citizenId || '').trim();
  if (!code || !mail || !citizenId) {
    fail(400, 'VALIDATION_ERROR', 'Nhập đủ mã sinh viên, email và số CCCD để xác nhận hủy đơn');
  }
  const st = await Student.findOne({ studentCode: code, email: mail, citizenId }).lean();
  if (!st) fail(404, 'APPLICATION_NOT_FOUND', 'Thông tin xác thực không khớp với đơn đăng ký nào');
  const updated = await Contract.findOneAndUpdate(
    { studentId: st._id, status: 'pending' },
    { $set: { status: 'cancelled', cancelReason: String(body.reason || 'Sinh viên tự hủy đơn trước khi xét duyệt').trim() } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'CONTRACT_NOT_PENDING', 'Không có đơn đăng ký nào đang ở trạng thái chờ duyệt để hủy');
  return { data: await viewOne(updated), message: `Đã hủy đơn đăng ký ${updated.contractCode}` };
}

// ================================================================ 2. QUẢN TRỊ & XÉT DUYỆT (§6)

async function list(q = {}) {
  const all = await Contract.find().lean();
  const ctx = await loadCtx({ roomIds: all.map((c) => c.roomId), studentIds: all.map((c) => c.studentId) });
  const debts = await debtsOf(all.map((c) => c.studentId));
  let rows = all.map((c) => contractView(c, ctx, debts));

  const summary = {
    pending: 0,
    pending_payment: 0,
    overduePayment: 0,
    active: 0,
    expired: 0,
    terminated: 0,
    rejected: 0,
    cancelled: 0,
    awaitingDepositRefund: all.filter((c) => c.status === 'terminated' && !c.isDepositRefunded && c.depositAmount > 0).length,
  };
  rows.forEach((c) => {
    if (summary[c.status] !== undefined) summary[c.status] += 1;
    if (c.isPaymentOverdue) summary.overduePayment += 1;
  });

  const statuses = q.status ? String(q.status).split(',') : null;
  if (statuses) rows = rows.filter((c) => statuses.includes(c.status));
  if (q.periodId) rows = rows.filter((c) => c.periodId === String(q.periodId));
  if (q.campus) rows = rows.filter((c) => c.campus === q.campus);
  if (q.buildingId) rows = rows.filter((c) => c.buildingId === String(q.buildingId));
  if (q.roomId) rows = rows.filter((c) => c.roomId === String(q.roomId));
  if (q.term) rows = rows.filter((c) => c.term === q.term);
  if (q.overduePayment === 'true') rows = rows.filter((c) => c.isPaymentOverdue);
  if (q.isDepositRefunded !== undefined && q.isDepositRefunded !== '') {
    rows = rows.filter((c) => String(c.isDepositRefunded) === String(q.isDepositRefunded));
  }
  rows = rows.filter((c) => matches(q.search, [c.contractCode, c.studentCode, c.studentName, c.roomNumber, `${c.buildingCode}-${c.roomNumber}`]));

  const key = (c) => String(c.startDate || c.reviewedAt?.toISOString?.() || c.reviewedAt || c.createdAt?.toISOString?.() || c.createdAt);
  if (statuses?.length === 1 && statuses[0] === 'pending') rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  else rows.sort((a, b) => key(b).localeCompare(key(a)) || a.contractCode.localeCompare(b.contractCode));

  return { data: paginate(rows, q, { summary }) };
}

async function getById(id) {
  const c = await findContract(id);
  const st = await Student.findById(c.studentId).lean();
  const [invoices, roomUnpaidRaw] = await Promise.all([
    Invoice.find({ contractId: c._id }).sort({ createdAt: -1 }).lean(),
    c.roomId && c.status === 'active'
      ? Invoice.find({ type: 'utility', roomId: c.roomId, status: 'unpaid' }).sort({ dueDate: 1 }).lean()
      : Promise.resolve([]),
  ]);
  const ctx = await loadCtx({ roomIds: [c.roomId], studentIds: [c.studentId] });
  const view = contractView(c, ctx, await debtsOf([c.studentId]));
  const status = view.status;
  const history = [
    { at: c.createdAt, type: 'application_submitted', title: 'Nộp đơn đăng ký', description: `Mã ${c.contractCode}` },
    c.reviewedAt && !['rejected', 'pending'].includes(c.status) && {
      at: c.reviewedAt,
      type: 'application_approved',
      title: 'Duyệt giữ chỗ & chờ đóng phí',
      description: `Phòng ${view.buildingCode}-${view.roomNumber} · hạn đóng phí ${c.paymentDeadline || '7 ngày'}`,
    },
    c.status === 'rejected' && { at: c.reviewedAt, type: 'rejected', title: 'Từ chối đơn', description: c.rejectionReason },
    c.status === 'cancelled' && { at: c.updatedAt, type: 'cancelled', title: 'Đã hủy hợp đồng / đơn', description: c.cancelReason },
    c.startDate && {
      at: c.startDate,
      type: 'contract_activated',
      title: 'Đã hoàn tất đóng phí & kích hoạt hợp đồng',
      description: `Hiệu lực ${c.startDate} → ${c.endDate}`,
    },
    c.checkedInAt && {
      at: c.checkedInAt,
      type: 'checked_in',
      title: 'Quét QR Check-in nhận phòng',
      description: `Cán bộ xác nhận: ${c.checkedInByName || ''}`,
    },
    status === 'expired' && { at: c.endDate, type: 'expired', title: 'Hết hạn hợp đồng', description: 'Chưa thanh lý — sinh viên vẫn giữ chỗ phòng' },
    c.status === 'terminated' && { at: c.terminatedAt, type: 'terminated', title: 'Thanh lý hợp đồng', description: 'Trả phòng, giải phóng chỗ trống' },
    c.isDepositRefunded && {
      at: c.depositRefundedAt,
      type: 'deposit_refunded',
      title: 'Quyết toán hoàn cọc',
      description: `Hoàn ${Number(c.depositRefundAmount || 0).toLocaleString('vi-VN')}đ (khấu trừ ${Number(c.depositDeductionAmount || 0).toLocaleString('vi-VN')}đ)${c.depositRefundReason ? ` · ${c.depositRefundReason}` : ''}`,
    },
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  const invoiceViews = invoices.map((i) => invoiceView(i, ctx));
  const roomUnpaidInvoices = roomUnpaidRaw.map((i) => invoiceView(i, ctx));
  const roomUtilityDebt = roomUnpaidInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  return {
    data: {
      ...view,
      student: st
        ? {
            id: String(st._id),
            studentCode: st.studentCode,
            fullName: st.fullName,
            gender: st.gender,
            phone: st.phone,
            email: st.email,
            dob: st.dob,
            citizenId: st.citizenId,
            address: st.address,
            faculty: st.faculty,
            className: st.className,
            enrollmentYear: st.enrollmentYear,
            priorityType: st.priorityType,
            hasHealthCondition: st.hasHealthCondition,
            healthNote: st.healthNote,
            emergencyContact: st.emergencyContact,
          }
        : null,
      depositStatus: invoiceViews.find((i) => i.type === 'deposit')?.status ?? null,
      roomUtilityDebt,
      roomUnpaidInvoices,
      invoices: invoiceViews,
      history,
    },
  };
}

/** Sinh các hóa đơn đầu kỳ khi duyệt đơn (bỏ qua hóa đơn cọc nếu depositAmount === 0) */
async function issuePersonalInvoices(c, room, building, dueDate) {
  const created = [];
  const make = (type) =>
    createWithCode(Invoice, 'invoiceCode', yearPrefix('INV'), (invoiceCode) => ({
      invoiceCode,
      type,
      scope: 'personal',
      amount: type === 'deposit' ? c.depositAmount : c.totalRoomFee,
      description:
        type === 'deposit'
          ? `Tiền đặt cọc tài sản - ${c.contractCode}`
          : `Tiền phòng ${building.code}-${room.roomNumber} (${termLabel(c.term)}) - ${c.contractCode}`,
      studentId: c.studentId,
      roomId: room._id,
      contractId: c._id,
      dueDate,
      status: 'unpaid',
    }));

  if (c.depositAmount > 0) created.push(await make('deposit'));
  created.push(await make('room_semester'));
  return created;
}

/** PATCH /api/contracts/:id/approve — Tự động xếp phòng tầng thấp -> cao (hoặc phòng cán bộ chọn) & khóa chỗ nguyên tử -> `pending_payment` */
async function approve(id, body = {}, actor) {
  const c = await findContract(id, 'Không tìm thấy đơn đăng ký');
  if (c.status !== 'pending') fail(409, 'CONTRACT_NOT_PENDING', 'Đơn đăng ký đã được xử lý');
  const st = await Student.findById(c.studentId).lean();
  const period = c.periodId ? await RegistrationPeriod.findById(c.periodId).lean() : null;
  const targetCampus = c.campus || period?.campus || null;

  let room = null;
  let building = null;
  const explicitRoomId = body.roomId || c.roomId;
  if (explicitRoomId) {
    room = isObjectId(explicitRoomId) ? await Room.findById(explicitRoomId).lean() : null;
    if (!room) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng');
    building = await Building.findById(room.buildingId).lean();
    if (room.status !== 'active' || !building?.isActive) {
      fail(422, 'ROOM_NOT_AVAILABLE', `Phòng ${building?.code ?? ''}-${room.roomNumber} đang bảo trì hoặc tòa ngừng hoạt động`);
    }
    if (!roomAcceptsGender(room, st.gender)) {
      fail(422, 'GENDER_MISMATCH', `Phòng này đang dành cho sinh viên ${genderText(room.gender)}`);
    }
  } else {
    const picked = await pickBestRoomForWish({
      campus: targetCampus,
      gender: st.gender,
      roomTier: c.preferredRoomTier,
      capacity: c.preferredCapacity,
    });
    if (!picked) fail(409, 'ROOM_FULL', 'Hiện không còn chỗ trống cho loại phòng này trong cơ sở. Vui lòng chọn phòng khác hoặc từ chối đơn');
    room = picked.room;
    building = picked.building;
  }

  if (await Contract.exists({ studentId: st._id, status: { $in: ['pending_payment', 'active'] } })) {
    fail(409, 'APPLICATION_OR_CONTRACT_EXISTS', 'Sinh viên đã có hợp đồng chờ đóng phí hoặc đang hiệu lực');
  }

  let account = await User.findOne({ studentId: st._id });
  const email = String(st.email || '').toLowerCase();
  if (!account && (await User.exists({ email }))) {
    fail(409, 'EMAIL_ALREADY_USED', `Email ${st.email} đã thuộc tài khoản khác. Liên hệ sinh viên để cập nhật email`);
  }

  // BR-05: Khóa nguyên tử 1 chỗ trống & tự gán giới tính phòng nếu là người đầu tiên
  const locked = await lockRoomSlot(room._id, st.gender);
  if (!locked) fail(409, 'ROOM_FULL', `Phòng ${building.code}-${room.roomNumber} vừa hết chỗ trống. Vui lòng điều phối phòng khác`);

  try {
    const deadlineDays = period?.paymentDeadlineDays || 7;
    const paymentDeadline = addDays(today(), deadlineDays);
    const months = TERM_MONTHS[c.term];
    const totalRoomFee = Math.round(room.pricePerMonth * months);

    const updated = await Contract.findOneAndUpdate(
      { _id: c._id, status: 'pending' },
      {
        $set: {
          status: 'pending_payment',
          roomId: room._id,
          campus: building.campus,
          pricePerMonth: room.pricePerMonth,
          depositAmount: room.depositAmount,
          totalRoomFee,
          paymentDeadline,
          reviewedAt: new Date(),
          reviewedBy: actor.id,
          reviewedByName: actor.fullName,
        },
      },
      { returnDocument: 'after' }
    ).lean();
    if (!updated) {
      await releaseRoomSlot(room._id);
      fail(409, 'CONTRACT_NOT_PENDING', 'Đơn đăng ký vừa được người khác xử lý');
    }

    const isNew = !account;
    if (isNew) {
      account = await User.create({
        email,
        fullName: st.fullName,
        role: 'student',
        studentId: st._id,
        studentCode: st.studentCode,
        passwordHash: await User.hashPassword(st.studentCode),
        mustChangePassword: true,
      });
    }

    const createdInvoices = await issuePersonalInvoices(updated, room, building, paymentDeadline);

    // Nếu cả tiền phòng lẫn cọc đều = 0 (miễn phí 100%) -> kích hoạt luôn
    let finalContract = updated;
    if (createdInvoices.every((i) => i.amount === 0)) {
      await Invoice.updateMany({ contractId: updated._id }, { $set: { status: 'paid', paidAt: new Date() } });
      finalContract = (await activateIfInitialPaid(updated._id)) || updated;
    }

    const roomLabel = `${building.name} (${building.code}) - Phòng ${room.roomNumber}`;
    let emailSent = false;
    try {
      emailSent = await sendAccountEmail({
        to: email,
        studentName: st.fullName,
        studentCode: st.studentCode,
        roomName: roomLabel,
        termName: termLabel(updated.term),
        paymentDeadline,
        isNewAccount: isNew,
      });
    } catch (mailErr) {
      logger.error('[Duyệt đơn] Lỗi gửi email:', mailErr);
    }

    await notificationService
      .notifyStudent(st._id, {
        type: 'application',
        campus: building.campus,
        title: `Đơn ${updated.contractCode} đã được duyệt giữ chỗ`,
        content: `Bạn được xếp tạm vào ${roomLabel}. Vui lòng hoàn tất thanh toán trước ngày ${paymentDeadline} để kích hoạt hợp đồng và nhận mã QR Check-in.`,
        refType: 'contract',
        refId: updated._id,
      })
      .catch(() => {});

    return {
      data: {
        contract: await viewOne(finalContract),
        account: { studentCode: st.studentCode, email: account.email, isNew },
        emailSent,
        invoices: createdInvoices.map((i) => ({
          id: String(i._id),
          invoiceCode: i.invoiceCode,
          type: i.type,
          amount: i.amount,
          dueDate: i.dueDate,
        })),
      },
      message: 'Đã duyệt đơn, giữ chỗ phòng và phát hành hóa đơn chờ thanh toán',
    };
  } catch (err) {
    if (err.statusCode !== 409) {
      await releaseRoomSlot(room._id);
      await Contract.updateOne(
        { _id: c._id, status: 'pending_payment' },
        { $set: { status: 'pending', roomId: c.roomId ?? null, paymentDeadline: null, reviewedAt: null } }
      );
      await Invoice.deleteMany({ contractId: c._id, status: 'unpaid' });
    }
    throw err;
  }
}

/** POST /api/contracts/auto-approve — Duyệt hàng loạt thuần FIFO (ai nộp trước duyệt trước), xếp tầng thấp -> cao theo đúng loại phòng */
async function autoApprove(body = {}, actor) {
  const filter = { status: 'pending' };
  if (body.periodId && isObjectId(body.periodId)) filter.periodId = body.periodId;
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);

  const pendingList = await Contract.find(filter).sort({ createdAt: 1 }).lean();
  if (!pendingList.length) return { data: { approvedCount: 0, skippedCount: 0, approved: [], skipped: [] }, message: 'Không có đơn chờ duyệt' };

  const students = byId(await Student.find({ _id: { $in: pendingList.map((c) => c.studentId) } }).lean());
  const approved = [];
  const skipped = [];

  const periods = byId(await RegistrationPeriod.find({ _id: { $in: pendingList.map((c) => c.periodId).filter(Boolean) } }).lean());

  for (const c of pendingList.slice(0, limit)) {
    const st = students.get(String(c.studentId));
    if (!st) continue;
    try {
      const period = c.periodId ? periods.get(String(c.periodId)) : null;
      const curRoom = c.roomId ? await Room.findById(c.roomId).lean() : null;
      const curBuilding = curRoom ? await Building.findById(curRoom.buildingId).lean() : null;
      const targetCampus = c.campus || curBuilding?.campus || period?.campus || null;

      // Xếp lấp đầy từ tầng thấp lên tầng cao đúng loại phòng sinh viên đã chọn & đúng giới tính
      const picked = await pickBestRoomForWish({
        campus: targetCampus,
        gender: st.gender,
        roomTier: c.preferredRoomTier || curRoom?.roomTier || null,
        capacity: c.preferredCapacity || curRoom?.capacity || null,
      });
      if (!picked) {
        skipped.push({ contractCode: c.contractCode, studentCode: st.studentCode, reason: 'Loại phòng đăng ký hiện đã hết chỗ trống' });
        continue;
      }

      const res = await approve(c._id, { roomId: picked.room._id }, actor);
      approved.push({
        contractCode: res.data.contract.contractCode,
        studentCode: st.studentCode,
        room: `${res.data.contract.buildingCode}-${res.data.contract.roomNumber}`,
        floor: res.data.contract.room?.floor,
      });
    } catch (err) {
      skipped.push({ contractCode: c.contractCode, studentCode: st.studentCode, reason: err.message });
    }
  }

  return {
    data: { approvedCount: approved.length, skippedCount: skipped.length, approved, skipped },
    message: `Đã duyệt hàng loạt ${approved.length} đơn theo thứ tự nộp${skipped.length ? `, bỏ qua ${skipped.length} đơn do hết chỗ loại phòng` : ''}`,
  };
}

/** Tự kích hoạt hợp đồng pending_payment -> active ngay khi đóng đủ hóa đơn đầu kỳ + sinh mã QR Check-in */
async function activateIfInitialPaid(contractId) {
  if (!contractId) return null;
  const c = await Contract.findById(contractId).lean();
  if (!c || c.status !== 'pending_payment') return null;

  const remainingUnpaid = await Invoice.countDocuments({
    contractId: c._id,
    type: { $in: ['deposit', 'room_semester'] },
    status: 'unpaid',
  });
  if (remainingUnpaid > 0) return null;

  const startDate = today();
  const endDate = addMonths(startDate, TERM_MONTHS[c.term] || 6);
  const checkinCode = `QRC-${c.contractCode}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const updated = await Contract.findOneAndUpdate(
    { _id: c._id, status: 'pending_payment' },
    { $set: { status: 'active', startDate, endDate, checkinCode } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) return null;

  const [st, room] = await Promise.all([Student.findById(c.studentId).lean(), Room.findById(c.roomId).lean()]);
  const building = room ? await Building.findById(room.buildingId).lean() : null;
  const cInfo = building ? CAMPUS_INFO[building.campus] : null;
  const roomName = building && room ? `${building.name} (${building.code}) - Phòng ${room.roomNumber}` : 'KTX HaUI';

  if (st) {
    await notificationService
      .notifyStudent(st._id, {
        type: 'payment',
        campus: building?.campus || 'all',
        title: `Hợp đồng ${updated.contractCode} đã chính thức có hiệu lực`,
        content: `Đã hoàn tất thanh toán phí đầu kỳ. Mã QR Check-in nhận phòng của bạn là ${checkinCode}. Mời đến ${cInfo?.officeLocation || 'Văn phòng KTX'} để nhận phòng.`,
        refType: 'contract',
        refId: updated._id,
      })
      .catch(() => {});

    if (st.email) {
      sendCheckinReadyEmail({
        to: st.email,
        studentName: st.fullName,
        studentCode: st.studentCode,
        contractCode: updated.contractCode,
        roomName,
        checkinCode,
        officeLocation: cInfo?.officeLocation,
      }).catch(() => {});
    }
  }
  return updated;
}

/** PATCH /api/contracts/:id/reject — Từ chối đơn pending + gửi Email */
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

  const st = await Student.findById(updated.studentId).lean();
  if (st?.email) {
    sendRejectionEmail({
      to: st.email,
      studentName: st.fullName,
      studentCode: st.studentCode,
      contractCode: updated.contractCode,
      reason,
    }).catch((err) => logger.error('[Từ chối đơn] Lỗi gửi email:', err));
  }
  return { data: await viewOne(updated), message: 'Đã từ chối đơn đăng ký' };
}

/** PATCH /api/contracts/:id/cancel — Hủy hợp đồng `pending_payment` (bỏ cọc/quá hạn) -> hủy HĐ nháp + nhả chỗ phòng */
async function cancelPendingPayment(id, body = {}, actor) {
  const c = await findContract(id);
  if (c.status !== 'pending_payment') {
    fail(409, 'CONTRACT_NOT_PENDING_PAYMENT', 'Chỉ hủy thu hồi chỗ đối với hợp đồng đang chờ đóng phí (pending_payment)');
  }
  const hasPaid = await Invoice.exists({ contractId: c._id, status: 'paid' });
  if (hasPaid) {
    fail(422, 'OUTSTANDING_INVOICES', 'Hợp đồng này đã có hóa đơn được thanh toán một phần, vui lòng hoàn tất đối soát hoặc xử lý thanh lý riêng');
  }
  const reason = String(body.reason || 'Hủy do quá hạn đóng phí giữ chỗ').trim();
  const updated = await Contract.findOneAndUpdate(
    { _id: c._id, status: 'pending_payment' },
    { $set: { status: 'cancelled', cancelReason: `${reason} (${actor.fullName})` } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'CONTRACT_NOT_PENDING_PAYMENT', 'Hợp đồng vừa được xử lý');

  await Invoice.updateMany({ contractId: c._id, status: 'unpaid' }, { $set: { status: 'cancelled' } });
  await releaseRoomSlot(c.roomId);

  await notificationService
    .notifyStudent(c.studentId, {
      type: 'application',
      title: `Hủy giữ chỗ hợp đồng ${c.contractCode}`,
      content: `Hợp đồng giữ chỗ đã bị hủy (${reason}). Chỗ ở đã được thu hồi về quỹ phòng trống.`,
      refType: 'contract',
      refId: c._id,
    })
    .catch(() => {});

  return { data: await viewOne(updated), message: `Đã hủy giữ chỗ ${c.contractCode} và giải phóng chỗ trống` };
}

/** POST /api/contracts/cancel-overdue — Hủy hàng loạt toàn bộ đơn `pending_payment` đã quá hạn đóng phí */
async function cancelOverdue(actor) {
  const overdue = await Contract.find({ status: 'pending_payment', paymentDeadline: { $lt: today() } }).lean();
  const cancelled = [];
  const skipped = [];
  for (const c of overdue) {
    try {
      const res = await cancelPendingPayment(c._id, { reason: 'Tự động thu hồi chỗ do quá hạn thanh toán giữ chỗ' }, actor);
      cancelled.push(res.data.contractCode);
    } catch (err) {
      skipped.push({ contractCode: c.contractCode, reason: err.message });
    }
  }
  return {
    data: { cancelledCount: cancelled.length, skippedCount: skipped.length, cancelled, skipped },
    message: `Đã hủy ${cancelled.length} hợp đồng quá hạn đóng phí`,
  };
}

/** POST /api/contracts/checkin-qr — Cán bộ quét mã QR Check-in bàn giao phòng */
async function checkinQr(body = {}, actor) {
  const code = String(body.checkinCode || '').trim().toUpperCase();
  if (!code) fieldErrors([{ field: 'checkinCode', message: 'Nhập hoặc quét mã QR Check-in' }]);
  const c = await Contract.findOne({ checkinCode: code }).lean();
  if (!c) fail(404, 'INVALID_CHECKIN_CODE', 'Mã QR Check-in không tồn tại hoặc không hợp lệ');
  if (c.status !== 'active') fail(409, 'CONTRACT_NOT_ACTIVE', 'Hợp đồng chưa được kích hoạt thanh toán hoặc đã kết thúc');
  if (c.checkedInAt) fail(409, 'ALREADY_CHECKED_IN', `Sinh viên đã làm thủ tục nhận phòng lúc ${new Date(c.checkedInAt).toLocaleString('vi-VN')}`);

  const updated = await Contract.findOneAndUpdate(
    { _id: c._id, status: 'active', checkedInAt: null },
    { $set: { checkedInAt: new Date(), checkedInBy: actor.id, checkedInByName: actor.fullName } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'ALREADY_CHECKED_IN', 'Hợp đồng đã được check-in trước đó');

  await notificationService
    .notifyStudent(c.studentId, {
      type: 'application',
      title: `Xác nhận đã nhận phòng (${c.contractCode})`,
      content: `Cán bộ ${actor.fullName} đã quét mã QR Check-in bàn giao phòng thành công. Chúc bạn có kỳ nội trú vui vẻ tại HaUI!`,
      refType: 'contract',
      refId: c._id,
    })
    .catch(() => {});

  return { data: await viewOne(updated), message: `Check-in nhận phòng thành công cho hợp đồng ${c.contractCode}` };
}

/** PATCH /api/contracts/:id/terminate — Sạch nợ 100% -> thanh lý & nhả 1 chỗ phòng */
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
    { _id: c._id, status: 'active' },
    { $set: { status: 'terminated', terminatedAt: today() } },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'CONTRACT_NOT_TERMINABLE', 'Hợp đồng vừa được xử lý');

  await releaseRoomSlot(c.roomId);

  await notificationService
    .notifyStudent(c.studentId, {
      type: 'application',
      title: `Đã thanh lý hợp đồng ${c.contractCode}`,
      content: 'Thủ tục trả phòng đã hoàn tất. Bạn vui lòng nhận lại tiền đặt cọc sau khi cán bộ quyết toán tài sản.',
      refType: 'contract',
      refId: c._id,
    })
    .catch(() => {});

  return { data: { contract: await viewOne(updated) }, message: `Đã thanh lý hợp đồng ${c.contractCode}` };
}

/** PATCH /api/contracts/:id/deposit-refund — Quyết toán hoàn cọc có khấu trừ hỏng đồ + lưu phiếu chi refund */
async function refundDeposit(id, body = {}, actor) {
  const c = await findContract(id);
  if (c.status !== 'terminated') fail(409, 'CONTRACT_NOT_TERMINATED', 'Chỉ quyết toán hoàn cọc sau khi đã thanh lý hợp đồng');
  if (c.isDepositRefunded) fail(409, 'DEPOSIT_ALREADY_REFUNDED', 'Hợp đồng này đã được quyết toán hoàn cọc');

  const deductionAmount = body.deductionAmount !== undefined ? Number(body.deductionAmount) : 0;
  if (!Number.isInteger(deductionAmount) || deductionAmount < 0 || deductionAmount > c.depositAmount) {
    fail(400, 'INVALID_DEDUCTION_AMOUNT', `Số tiền khấu trừ phải là số nguyên từ 0 đến ${c.depositAmount.toLocaleString('vi-VN')} VNĐ`, {
      errors: [{ field: 'deductionAmount', message: `Khấu trừ phải nằm trong khoảng 0..${c.depositAmount}` }],
    });
  }
  const reason = String(body.reason || (deductionAmount > 0 ? 'Khấu trừ hư hại tài sản phòng KTX' : 'Tài sản nguyên vẹn — hoàn đủ 100% cọc')).trim();
  const refundAmount = c.depositAmount - deductionAmount;
  const refundedAt = new Date();

  const updated = await Contract.findOneAndUpdate(
    { _id: c._id, status: 'terminated', isDepositRefunded: false },
    {
      $set: {
        isDepositRefunded: true,
        depositDeductionAmount: deductionAmount,
        depositRefundAmount: refundAmount,
        depositRefundReason: reason,
        depositRefundedAt: refundedAt,
        depositRefundedBy: actor.id,
        depositRefundedByName: actor.fullName,
      },
    },
    { returnDocument: 'after' }
  ).lean();
  if (!updated) fail(409, 'DEPOSIT_ALREADY_REFUNDED', 'Hợp đồng này đã được quyết toán hoàn cọc');

  let refundPayment = null;
  if (refundAmount > 0) {
    const depInv = await Invoice.findOne({ contractId: c._id, type: 'deposit' }).select('_id').lean();
    refundPayment = await createWithCode(Payment, 'paymentCode', yearPrefix('REF'), (paymentCode) => ({
      paymentCode,
      paymentType: 'refund',
      invoiceId: depInv?._id ?? null,
      contractId: c._id,
      amount: refundAmount,
      method: body.method === 'vietqr' ? 'vietqr' : 'cash',
      note: `${reason}${deductionAmount > 0 ? ` (Khấu trừ ${deductionAmount.toLocaleString('vi-VN')}đ)` : ''}`,
      paidAt: refundedAt,
      payerStudentId: c.studentId,
      collectedBy: actor.id,
      collectedByName: actor.fullName,
    }));
  }

  await notificationService
    .notifyStudent(c.studentId, {
      type: 'payment',
      title: `Quyết toán hoàn cọc hợp đồng ${c.contractCode}`,
      content: `Số tiền cọc hoàn trả: ${refundAmount.toLocaleString('vi-VN')} VNĐ (Khấu trừ: ${deductionAmount.toLocaleString('vi-VN')} VNĐ — ${reason}).`,
      refType: 'contract',
      refId: c._id,
    })
    .catch(() => {});

  return {
    data: {
      ...(await viewOne(updated)),
      refundPaymentCode: refundPayment?.paymentCode ?? null,
    },
    message: `Đã quyết toán hoàn cọc ${refundAmount.toLocaleString('vi-VN')} VNĐ`,
  };
}

module.exports = {
  publicCampuses,
  availableRooms,
  registerOnline,
  applyFromPortal,
  applicationStatus,
  cancelPendingByStudent,
  list,
  getById,
  approve,
  autoApprove,
  activateIfInitialPaid,
  reject,
  cancelPendingPayment,
  cancelOverdue,
  checkinQr,
  terminate,
  refundDeposit,
  lockRoomSlot,
  releaseRoomSlot,
};

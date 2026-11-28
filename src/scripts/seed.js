/**
 * Dữ liệu mẫu HaUI - DMS v3.2 (KTX Cơ sở 1 Cầu Diễn · 2 Tòa A14 & A15 · 40 Phòng [40% CLC / 60% Tiêu chuẩn] · 110 SV · Kỳ hạn 6/12 tháng).
 *
 * Chạy trên DB cục bộ:
 *   npm run seed
 *   # hoặc: MONGODB_URI=mongodb://127.0.0.1:27017/dms_ktx_test node src/scripts/seed.js
 *
 * ⚠️ XÓA SẠCH CSDL rồi dựng lại. Tự động từ chối nếu MONGODB_URI trỏ vào cụm Atlas (`mongodb.net`)
 *    trừ khi đặt SEED_ALLOW_REMOTE=true.
 */

require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');
const Building = require('../modules/rooms/building.model');
const Room = require('../modules/rooms/room.model');
const RegistrationPeriod = require('../modules/periods/registration-period.model');
const Contract = require('../modules/contracts/contract.model');
const UtilityReading = require('../modules/fees/utility-reading.model');
const Invoice = require('../modules/fees/invoice.model');
const Payment = require('../modules/payments/payment.model');
const Request = require('../modules/requests/request.model');
const Notification = require('../modules/notifications/notification.model');

const { ROOM_PRICES_2026, TERM_MONTHS } = require('../shared/constants/enums');
const { today, addDays, addMonths, addMonthsToMonth, localMonth } = require('../core/utils/dates');
const { utilityInvoiceCode } = require('../core/utils/code-generator');

const pad = (n, w = 4) => String(n).padStart(w, '0');
const YEAR = Number(today().slice(0, 4));
const YEAR_STR = String(YEAR);
const STAFF_NAME = 'Lê Thị Thu Hà';
const MANAGER_NAME = 'TS. Nguyễn Minh Đức';
const UNIT = { electricity: 3000, water: 15000 };

const LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
const MIDDLE_M = ['Văn', 'Quốc', 'Minh', 'Đức', 'Hoàng'];
const MIDDLE_F = ['Thị', 'Ngọc', 'Phương', 'Thu', 'Minh'];
const FIRST_M = ['An', 'Bảo', 'Cường', 'Dũng', 'Hùng', 'Khoa', 'Long', 'Nam', 'Phúc', 'Tuấn'];
const FIRST_F = ['Anh', 'Châu', 'Hà', 'Lan', 'Linh', 'Mai', 'Ngân', 'Thảo', 'Trang', 'Yến'];
const FACULTIES = [
  'Công nghệ thông tin',
  'Cơ khí',
  'Điện',
  'Điện tử',
  'Kế toán - Kiểm toán',
  'Quản lý kinh doanh',
  'Ngôn ngữ Anh',
  'Ngôn ngữ Trung Quốc',
  'Công nghệ May và Thiết kế thời trang',
  'Công nghệ Hóa',
];
const PROVINCES = ['Hà Nội', 'Ninh Bình', 'Nam Định', 'Thái Bình', 'Nghệ An', 'Thanh Hóa', 'Hải Dương', 'Bắc Ninh', 'Phú Thọ', 'Hải Phòng'];

let invSeq = 0;
let paySeq = 0;
let refSeq = 0;
let contractSeq = 0;
let reqSeq = 0;

function amenitiesOf(tier, capacity) {
  if (tier === 'high_quality') {
    return ['Wifi miễn phí', 'Điều hòa', 'Bình nóng lạnh', 'Tủ cá nhân', capacity <= 3 ? 'Giường gỗ' : 'Giường tầng', 'Đệm', 'Quạt trần', 'Dụng cụ vệ sinh', 'Khép kín >30m²'];
  }
  return ['Wifi miễn phí', 'Bình nóng lạnh', 'Tủ cá nhân', 'Giường tầng', 'Quạt trần', 'Dụng cụ vệ sinh', 'Khép kín >30m²'];
}

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dms_ktx';
  if (/mongodb\.net/i.test(uri) && process.env.SEED_ALLOW_REMOTE !== 'true') {
    console.error('[SEED] ⛔ Từ chối: MONGODB_URI trỏ vào cụm Atlas (CSDL dùng chung). Seed sẽ XÓA SẠCH dữ liệu.');
    console.error('[SEED]    Dùng MongoDB cục bộ, hoặc đặt SEED_ALLOW_REMOTE=true nếu cả nhóm đã đồng ý.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`[SEED] Kết nối ${mongoose.connection.name} — xóa dữ liệu cũ`);
  await mongoose.connection.dropDatabase();
  await Promise.all(
    [User, Student, Building, Room, RegistrationPeriod, Contract, UtilityReading, Invoice, Payment, Request, Notification].map((m) =>
      m.syncIndexes()
    )
  );

  // ================================================================ 1. 2 Tòa nhà KTX Cơ sở 1 (A14 & A15 — Cầu Diễn, Hà Nội)
  const buildingSpecs = [
    {
      campus: 'cs1',
      code: 'A14',
      name: 'Nhà A14',
      totalFloors: 5,
      description: 'Tầng 1: Văn phòng Trung tâm KTX · 20 phòng (>30m² khép kín: 8 phòng CLC tầng 1–2, 12 phòng Tiêu chuẩn tầng 3–5)',
    },
    {
      campus: 'cs1',
      code: 'A15',
      name: 'Nhà A15',
      totalFloors: 5,
      description: 'Khu nội trú sinh viên Cơ sở 1 · 20 phòng (>30m² khép kín: 8 phòng CLC tầng 1–2, 12 phòng Tiêu chuẩn tầng 3–5)',
    },
  ];
  const buildings = {};
  for (const spec of buildingSpecs) {
    buildings[spec.code] = await Building.create({ ...spec, isActive: true });
  }

  // ================================================================ 2. 40 Phòng mẫu (20 phòng/tòa × 5 tầng × 4 phòng/tầng · 40% CLC / 60% Tiêu chuẩn)
  const ROOM_LAYOUT = [
    // Tầng 1 — Chất lượng cao (101 là CLC 3 người duy nhất mỗi tòa -> kín 3/3 để khóa tự động; 102-103 CLC 4 người; 104 CLC 6 người)
    { roomNumber: '101', floor: 1, roomTier: 'high_quality', capacity: 3 },
    { roomNumber: '102', floor: 1, roomTier: 'high_quality', capacity: 4 },
    { roomNumber: '103', floor: 1, roomTier: 'high_quality', capacity: 4 },
    { roomNumber: '104', floor: 1, roomTier: 'high_quality', capacity: 6 },
    // Tầng 2 — Chất lượng cao (201-202 CLC 4 người; 203-204 CLC 6 người)
    { roomNumber: '201', floor: 2, roomTier: 'high_quality', capacity: 4 },
    { roomNumber: '202', floor: 2, roomTier: 'high_quality', capacity: 4 },
    { roomNumber: '203', floor: 2, roomTier: 'high_quality', capacity: 6 },
    { roomNumber: '204', floor: 2, roomTier: 'high_quality', capacity: 6 },
    // Tầng 3 — Tiêu chuẩn (301-302 TC 4 người; 303-304 TC 6 người)
    { roomNumber: '301', floor: 3, roomTier: 'standard',     capacity: 4 },
    { roomNumber: '302', floor: 3, roomTier: 'standard',     capacity: 4 },
    { roomNumber: '303', floor: 3, roomTier: 'standard',     capacity: 6 },
    { roomNumber: '304', floor: 3, roomTier: 'standard',     capacity: 6 },
    // Tầng 4 — Tiêu chuẩn (401-402 TC 4 người; 403-404 TC 6 người)
    { roomNumber: '401', floor: 4, roomTier: 'standard',     capacity: 4 },
    { roomNumber: '402', floor: 4, roomTier: 'standard',     capacity: 4 },
    { roomNumber: '403', floor: 4, roomTier: 'standard',     capacity: 6 },
    { roomNumber: '404', floor: 4, roomTier: 'standard',     capacity: 6 },
    // Tầng 5 — Tiêu chuẩn (501-502 TC 4 người; 503-504 TC 6 người, phòng 504 bảo trì)
    { roomNumber: '501', floor: 5, roomTier: 'standard',     capacity: 4 },
    { roomNumber: '502', floor: 5, roomTier: 'standard',     capacity: 4 },
    { roomNumber: '503', floor: 5, roomTier: 'standard',     capacity: 6 },
    { roomNumber: '504', floor: 5, roomTier: 'standard',     capacity: 6 },
  ];

  const rooms = [];
  for (const b of Object.values(buildings)) {
    for (const tpl of ROOM_LAYOUT) {
      const pricePerMonth = ROOM_PRICES_2026[tpl.roomTier][tpl.capacity].cs1;
      const status = tpl.roomNumber === '504' ? 'maintenance' : 'active';
      rooms.push(
        await Room.create({
          buildingId: b._id,
          roomNumber: tpl.roomNumber,
          floor: tpl.floor,
          gender: null,
          roomTier: tpl.roomTier,
          capacity: tpl.capacity,
          hasAirConditioner: tpl.roomTier === 'high_quality',
          hasWaterHeater: true,
          amenities: amenitiesOf(tpl.roomTier, tpl.capacity),
          pricePerMonth,
          depositAmount: 500000,
          status,
          occupiedCount: 0,
        })
      );
    }
  }
  const buildingById = new Map(Object.values(buildings).map((b) => [String(b._id), b]));
  const roomOf = (bCode, roomNumber) => rooms.find((r) => buildingById.get(String(r.buildingId)).code === bCode && r.roomNumber === roomNumber);
  const codeOfRoom = (room) => buildingById.get(String(room.buildingId)).code;

  // ================================================================ 3. 3 Đợt Đăng ký cho KTX Cơ sở 1 (Chỉ 2 gói kỳ hạn: Nửa năm 6T & 1 năm 12T)
  const periodFreshman = await RegistrationPeriod.create({
    code: `DOT-${YEAR}-CS1-TSV`,
    name: `Đợt đăng ký KTX Tân sinh viên K${YEAR - 2005} — Cơ sở 1`,
    academicYearStart: YEAR,
    campus: 'cs1',
    targetCohort: 'freshman',
    allowedFaculties: [],
    excludedFaculties: [],
    allowedTerms: ['6_months', '12_months'],
    startDate: addDays(today(), -15),
    endDate: addDays(today(), 30),
    paymentDeadlineDays: 7,
    status: 'open',
    description: 'Dành cho Tân sinh viên năm nhất đăng ký ở nội trú tại Nhà A14 & A15 (Cơ sở 1). Chỉ 2 hạng phòng Chất lượng cao & Tiêu chuẩn, gói Nửa năm (6 tháng) hoặc 1 năm (12 tháng).',
  });

  const periodReturning = await RegistrationPeriod.create({
    code: `DOT-${YEAR}-CS1-KCU`,
    name: `Đợt đăng ký / Gia hạn KTX Sinh viên năm 2 trở lên — Cơ sở 1`,
    academicYearStart: YEAR,
    campus: 'cs1',
    targetCohort: 'returning',
    allowedFaculties: [],
    excludedFaculties: [],
    allowedTerms: ['6_months', '12_months'],
    startDate: addDays(today(), -10),
    endDate: addDays(today(), 30),
    paymentDeadlineDays: 7,
    status: 'open',
    description: 'Dành cho sinh viên từ năm 2 trở lên đăng ký mới hoặc gia hạn trực tiếp trên Cổng Sinh viên tại Nhà A14, A15 (Cơ sở 1).',
  });

  await RegistrationPeriod.create({
    code: `DOT-${YEAR - 1}-HK2`,
    name: `Đợt đăng ký KTX Học kỳ II năm học ${YEAR - 1}–${YEAR} (Đã đóng)`,
    academicYearStart: YEAR - 1,
    campus: 'cs1',
    targetCohort: 'all',
    allowedTerms: ['6_months', '12_months'],
    startDate: addDays(today(), -180),
    endDate: addDays(today(), -150),
    paymentDeadlineDays: 7,
    status: 'closed',
    description: 'Đợt đăng ký năm học trước đã kết thúc.',
  });

  // ================================================================ 4. Tài khoản Quản trị & Cán bộ (4 Vai trò RBAC)
  const makeUser = async (email, password, role, fullName, st = null, extra = {}) =>
    User.create({
      email,
      role,
      fullName: st ? st.fullName : fullName,
      passwordHash: await User.hashPassword(password),
      studentId: st?._id ?? null,
      studentCode: st?.studentCode ?? null,
      ...extra,
    });

  await makeUser('admin@dorm.local', 'Admin@123', 'admin', 'Nguyễn Văn Quản Trị');
  const managerUser = await makeUser('manager@dorm.local', 'Manager@123', 'manager', MANAGER_NAME);
  const staffUser = await makeUser('staff@dorm.local', 'Staff@123', 'staff', STAFF_NAME);
  await makeUser('staff2@dorm.local', 'Staff@123', 'staff', 'Đỗ Minh Tuấn', null, { isActive: false });
  await makeUser('doimk@dorm.local', 'Tam@12345', 'staff', 'Phạm Văn Mới Vào', null, { mustChangePassword: true });

  // ================================================================ 5. 110 Hồ sơ Sinh viên HaUI (0..49: Năm 3, 50..109: Tân SV; chẵn=Nam, lẻ=Nữ)
  const students = [];
  for (let i = 0; i < 110; i += 1) {
    const isFreshman = i >= 50;
    const enrollYear = isFreshman ? YEAR : YEAR - 2;
    const male = i % 2 === 0;
    const studentCode = `${enrollYear}600${pad(i + 1, 3)}`;
    const faculty = FACULTIES[i % FACULTIES.length];
    const fullName = `${LAST[i % 10]} ${(male ? MIDDLE_M : MIDDLE_F)[i % 5]} ${(male ? FIRST_M : FIRST_F)[Math.floor(i / 2) % 10]}`;
    students.push(
      await Student.create({
        studentCode,
        fullName,
        gender: male ? 'male' : 'female',
        dob: `${enrollYear - 18}-${pad((i % 12) + 1, 2)}-${pad((i % 27) + 1, 2)}`,
        phone: `0912${pad(100000 + i * 137, 6)}`,
        email: `sv${studentCode}@sv.haui.edu.vn`,
        citizenId: `0012040${pad(10000 + i * 31, 5)}`,
        address: `Phường Trung Tâm, ${PROVINCES[i % PROVINCES.length]}`,
        faculty,
        className: `K${enrollYear - 2005}-0${(i % 4) + 1}`,
        enrollmentYear: enrollYear,
        priorityType: 'normal',
        hasHealthCondition: false,
        healthNote: '',
        emergencyContact: {
          name: `${LAST[(i + 3) % 10]} Văn ${FIRST_M[(i + 1) % 10]}`,
          phone: `0987${pad(200000 + i * 71, 6)}`,
          relationship: i % 2 ? 'Mẹ' : 'Bố',
        },
        status: 'active',
      })
    );
  }

  // Tài khoản Demo SV (100% tại Cơ sở 1 — A14 & A15)
  // sv001 (idx 0, nam, năm 3)  : active A14-101 (kín 3/3 CLC), còn hóa đơn điện nước chưa nộp + 1 phiếu báo hỏng
  // sv002 (idx 1, nữ, năm 3)   : active A15-103 (3/4 CLC 4), sạch nợ -> test chuyển phòng cùng hạng (A15-202) / báo hỏng / thanh lý
  // sv003 (idx 40, nam, năm 3) : CỰU nội trú (HĐ năm trước đã thanh lý & hoàn cọc xong) -> test gia hạn tự động 100%
  // sv004 (idx 52, nam, TSV)   : pending_payment còn hạn tại A14-301 (TC 4) -> test nút Giả lập VietQR Sandbox 1 hóa đơn gộp
  // sv005 (idx 54, nam, TSV)   : pending_payment QUÁ HẠN 2 ngày tại A15-403 (1/6 TC 6) -> test Hủy quá hạn reset phòng về Trống
  // sv006 (idx 42, nam, năm 3) : terminated CHƯA hoàn cọc -> test nút Hoàn cọc + checklist khấu trừ trực tiếp trên bảng
  // sv007 (idx 50, nam, TSV)   : pending_payment mới xếp tại A14-301, TK = MK = MSSV (2026600051), mustChangePassword = true
  const DEMO_MAP = { sv001: 0, sv002: 1, sv003: 40, sv004: 52, sv005: 54, sv006: 42, sv007: 50 };

  const createContract = async (st, room, period, { term = '12_months', status = 'active', startDate = null, paymentDeadline = null, createdAt, reviewedAt = null, pricePerMonth = null, depositAmount = 500000, ...extra } = {}) => {
    contractSeq += 1;
    const months = TERM_MONTHS[term];
    const contractCode = `HD-${YEAR_STR}-${pad(contractSeq)}`;
    const checkinCode = status === 'active' ? `QRC-${contractCode}-${crypto.randomBytes(3).toString('hex').toUpperCase()}` : null;
    const effPrice = room ? room.pricePerMonth : (pricePerMonth ?? 380000);
    const effDeposit = room ? room.depositAmount : depositAmount;
    const c = await Contract.create({
      contractCode,
      periodId: period?._id ?? null,
      studentId: st._id,
      roomId: room ? room._id : null,
      campus: 'cs1',
      preferredRoomTier: room?.roomTier ?? null,
      preferredCapacity: room?.capacity ?? null,
      term,
      status,
      pricePerMonth: effPrice,
      totalRoomFee: Math.round(effPrice * months),
      depositAmount: effDeposit,
      paymentDeadline,
      startDate,
      endDate: startDate ? addMonths(startDate, months) : null,
      checkinCode,
      checkedInAt: status === 'active' && extra.checkedInAt !== null ? extra.checkedInAt ?? new Date(`${startDate}T14:00:00+07:00`) : null,
      checkedInBy: status === 'active' && extra.checkedInAt !== null ? staffUser._id : null,
      checkedInByName: status === 'active' && extra.checkedInAt !== null ? STAFF_NAME : null,
      reviewedAt,
      reviewedBy: null,
      reviewedByName: reviewedAt ? 'Hệ thống tự động xếp phòng' : null,
      ...extra,
    });
    if (createdAt) await Contract.collection.updateOne({ _id: c._id }, { $set: { createdAt: new Date(createdAt) } });
    if (room && (status === 'active' || status === 'pending_payment')) {
      await Room.updateOne({ _id: room._id }, { $inc: { occupiedCount: 1 }, $set: { gender: st.gender } });
    }
    return c;
  };

  /** Phương án 1A: sinh 01 hóa đơn gộp đầu kỳ (`initial_payment` = Tiền phòng cả kỳ + Tiền cọc tài sản) */
  const issueInitialInvoice = async (c, issuedAt, room, dueDate = null) => {
    invSeq += 1;
    const totalAmount = (c.totalRoomFee || 0) + (c.depositAmount || 0);
    const depositPart = c.depositAmount > 0 ? ` + Cọc tài sản ${c.depositAmount.toLocaleString('vi-VN')}đ` : '';
    const inv = await Invoice.create({
      invoiceCode: `INV-${YEAR_STR}-${pad(invSeq)}`,
      type: 'initial_payment',
      scope: 'personal',
      amount: totalAmount,
      roomFeeAmount: c.totalRoomFee || 0,
      depositAmount: c.depositAmount || 0,
      description: `Phí đầu kỳ: Tiền phòng ${codeOfRoom(room)}-${room.roomNumber} (${TERM_MONTHS[c.term]} tháng)${depositPart} - ${c.contractCode}`,
      studentId: c.studentId,
      roomId: room._id,
      contractId: c._id,
      dueDate: dueDate || addDays(issuedAt.slice(0, 10), 7),
      status: 'unpaid',
    });
    await Invoice.collection.updateOne({ _id: inv._id }, { $set: { createdAt: new Date(issuedAt) } });
    return inv;
  };

  const payInvoice = async (inv, payerStudentId, paidAt, idx = 0) => {
    paySeq += 1;
    const method = idx % 3 === 0 ? 'cash' : 'vietqr';
    await Payment.create({
      paymentCode: `PAY-${YEAR_STR}-${pad(paySeq)}`,
      paymentType: 'payment',
      invoiceId: inv._id,
      contractId: inv.contractId ?? null,
      amount: inv.amount,
      method,
      transactionCode: method === 'vietqr' ? `FT${YEAR_STR.slice(-2)}${pad(250000 + paySeq * 37, 7)}` : null,
      note: method === 'cash' ? 'Nộp tiền mặt tại văn phòng KTX Cơ sở 1' : 'Webhook VietQR tự động',
      paidAt: new Date(paidAt),
      payerStudentId,
      collectedBy: staffUser._id,
      collectedByName: STAFF_NAME,
    });
    await Invoice.updateOne({ _id: inv._id }, { $set: { status: 'paid', paidAt: new Date(paidAt), payerStudentId } });
  };

  // ================================================================ 6. Xếp 76 SV `active` rải đều A14 (39) & A15 (37) -> lấp đầy ~43% đẹp mắt
  const activeRecords = [];
  const start2mAgo = addMonths(today(), -2);
  const start1mAgo = addMonths(today(), -1);
  // idx chẵn = Nam, idx lẻ = Nữ (tránh 40, 42, 43, 44, 46, 50, 52, 54 dành cho demo đặc biệt)
  const placements = [
    // ---------- Nhà A14 (39 SV đang ở across Floors 1–3) ----------
    // A14-101: 3/3 Nam (CLC 3 kín)
    { idx: 0,  room: roomOf('A14', '101'), period: periodReturning, term: '12_months', start: start2mAgo }, // sv001
    { idx: 2,  room: roomOf('A14', '101'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 4,  room: roomOf('A14', '101'), period: periodReturning, term: '12_months', start: start2mAgo },
    // A14-102: 3/4 Nữ (CLC 4) — nữ cạnh nam tầng 1
    { idx: 7,  room: roomOf('A14', '102'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 9,  room: roomOf('A14', '102'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 11, room: roomOf('A14', '102'), period: periodReturning, term: '6_months',  start: start1mAgo },
    // A14-103: 3/4 Nam (CLC 4)
    { idx: 6,  room: roomOf('A14', '103'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 8,  room: roomOf('A14', '103'), period: periodReturning, term: '12_months', start: start1mAgo },
    { idx: 10, room: roomOf('A14', '103'), period: periodReturning, term: '6_months',  start: start2mAgo },
    // A14-104: 5/6 Nam (CLC 6)
    { idx: 12, room: roomOf('A14', '104'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 14, room: roomOf('A14', '104'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 16, room: roomOf('A14', '104'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 56, room: roomOf('A14', '104'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 58, room: roomOf('A14', '104'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    // A14-201: 3/4 Nữ (CLC 4)
    { idx: 13, room: roomOf('A14', '201'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 15, room: roomOf('A14', '201'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 51, room: roomOf('A14', '201'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    // A14-202: 3/4 Nam (CLC 4)
    { idx: 60, room: roomOf('A14', '202'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 62, room: roomOf('A14', '202'), period: periodFreshman,  term: '12_months', start: start1mAgo },
    { idx: 64, room: roomOf('A14', '202'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    // A14-203: 5/6 Nữ (CLC 6)
    { idx: 53, room: roomOf('A14', '203'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 55, room: roomOf('A14', '203'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    { idx: 57, room: roomOf('A14', '203'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 59, room: roomOf('A14', '203'), period: periodFreshman,  term: '12_months', start: start1mAgo },
    { idx: 61, room: roomOf('A14', '203'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    // A14-204: 4/6 Nam (CLC 6)
    { idx: 66, room: roomOf('A14', '204'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 68, room: roomOf('A14', '204'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 70, room: roomOf('A14', '204'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    { idx: 72, room: roomOf('A14', '204'), period: periodFreshman,  term: '12_months', start: start1mAgo },
    // A14-303: 5/6 Nam (Tiêu chuẩn 6)
    { idx: 74, room: roomOf('A14', '303'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 76, room: roomOf('A14', '303'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 78, room: roomOf('A14', '303'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    { idx: 80, room: roomOf('A14', '303'), period: periodFreshman,  term: '12_months', start: start1mAgo },
    { idx: 82, room: roomOf('A14', '303'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    // A14-304: 5/6 Nữ (Tiêu chuẩn 6)
    { idx: 63, room: roomOf('A14', '304'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 65, room: roomOf('A14', '304'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 67, room: roomOf('A14', '304'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    { idx: 69, room: roomOf('A14', '304'), period: periodFreshman,  term: '12_months', start: start1mAgo },
    { idx: 71, room: roomOf('A14', '304'), period: periodFreshman,  term: '6_months',  start: start1mAgo },

    // ---------- Nhà A15 (37 SV đang ở across Floors 1–3) ----------
    // A15-101: 3/3 Nữ (CLC 3 kín để khóa loại phòng CLC 3 trên /apply)
    { idx: 17, room: roomOf('A15', '101'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 3,  room: roomOf('A15', '101'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 5,  room: roomOf('A15', '101'), period: periodReturning, term: '12_months', start: start2mAgo },
    // A15-102: 3/4 Nam (CLC 4) — nam cạnh nữ tầng 1
    { idx: 18, room: roomOf('A15', '102'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 20, room: roomOf('A15', '102'), period: periodReturning, term: '12_months', start: start1mAgo },
    { idx: 22, room: roomOf('A15', '102'), period: periodReturning, term: '6_months',  start: start2mAgo },
    // A15-103: 3/4 Nữ (CLC 4 — sv002 ở đây để test chuyển phòng cùng hạng sang A15-202 / A14-102)
    { idx: 1,  room: roomOf('A15', '103'), period: periodReturning, term: '12_months', start: start2mAgo }, // sv002
    { idx: 19, room: roomOf('A15', '103'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 21, room: roomOf('A15', '103'), period: periodReturning, term: '12_months', start: start2mAgo },
    // A15-104: 5/6 Nữ (CLC 6)
    { idx: 23, room: roomOf('A15', '104'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 25, room: roomOf('A15', '104'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 27, room: roomOf('A15', '104'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 29, room: roomOf('A15', '104'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 31, room: roomOf('A15', '104'), period: periodReturning, term: '12_months', start: start2mAgo },
    // A15-201: 3/4 Nam (CLC 4)
    { idx: 24, room: roomOf('A15', '201'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 26, room: roomOf('A15', '201'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 28, room: roomOf('A15', '201'), period: periodReturning, term: '6_months',  start: start1mAgo },
    // A15-202: 3/4 Nữ (CLC 4)
    { idx: 33, room: roomOf('A15', '202'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 35, room: roomOf('A15', '202'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 37, room: roomOf('A15', '202'), period: periodReturning, term: '12_months', start: start1mAgo },
    // A15-203: 5/6 Nam (CLC 6)
    { idx: 30, room: roomOf('A15', '203'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 32, room: roomOf('A15', '203'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 34, room: roomOf('A15', '203'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 36, room: roomOf('A15', '203'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 38, room: roomOf('A15', '203'), period: periodReturning, term: '6_months',  start: start1mAgo },
    // A15-301: 3/4 Nữ (Tiêu chuẩn 4)
    { idx: 39, room: roomOf('A15', '301'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 41, room: roomOf('A15', '301'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 45, room: roomOf('A15', '301'), period: periodReturning, term: '12_months', start: start1mAgo },
    // A15-302: 4/4 Nam (Tiêu chuẩn 4 kín)
    { idx: 48, room: roomOf('A15', '302'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 84, room: roomOf('A15', '302'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 86, room: roomOf('A15', '302'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
    { idx: 88, room: roomOf('A15', '302'), period: periodFreshman,  term: '12_months', start: start1mAgo },
    // A15-303: 5/6 Nữ (Tiêu chuẩn 6)
    { idx: 47, room: roomOf('A15', '303'), period: periodReturning, term: '12_months', start: start2mAgo },
    { idx: 49, room: roomOf('A15', '303'), period: periodReturning, term: '6_months',  start: start1mAgo },
    { idx: 73, room: roomOf('A15', '303'), period: periodFreshman,  term: '12_months', start: start2mAgo },
    { idx: 75, room: roomOf('A15', '303'), period: periodFreshman,  term: '12_months', start: start1mAgo },
    { idx: 77, room: roomOf('A15', '303'), period: periodFreshman,  term: '6_months',  start: start1mAgo },
  ];

  for (const [k, item] of placements.entries()) {
    const st = students[item.idx];
    const c = await createContract(st, item.room, item.period, {
      term: item.term,
      status: 'active',
      startDate: item.start,
      createdAt: `${addDays(item.start, -3)}T09:00:00+07:00`,
      reviewedAt: new Date(`${addDays(item.start, -3)}T09:00:05+07:00`),
    });
    const issuedAt = `${addDays(item.start, -3)}T09:00:10+07:00`;
    const initInv = await issueInitialInvoice(c, issuedAt, item.room);
    const paidAt = `${addDays(item.start, -1)}T10:${pad((k * 7) % 60, 2)}:00+07:00`;
    await payInvoice(initInv, st._id, paidAt, k);
    activeRecords.push({ c, st, room: item.room, idx: item.idx });
  }

  // ================================================================ 7. Hợp đồng `pending_payment` (tự động xếp phòng giữ chỗ 7 ngày · 01 hóa đơn gộp đầu kỳ)
  // sv004: pending_payment còn hạn 5 ngày tại A14-301 (TC 4 nam) -> test nút Giả lập VietQR Sandbox 1 chạm
  const sv004 = students[DEMO_MAP.sv004];
  const cSv004 = await createContract(sv004, roomOf('A14', '301'), periodFreshman, {
    term: '12_months',
    status: 'pending_payment',
    paymentDeadline: addDays(today(), 5),
    createdAt: `${addDays(today(), -2)}T08:30:00+07:00`,
    reviewedAt: new Date(`${addDays(today(), -2)}T08:30:05+07:00`),
  });
  await issueInitialInvoice(cSv004, `${addDays(today(), -2)}T08:30:10+07:00`, roomOf('A14', '301'), addDays(today(), 5));

  // sv005: pending_payment ĐÃ QUÁ HẠN 2 ngày tại A15-403 (1/6 TC nam) -> test Hủy quá hạn nhả chỗ & reset Trống
  const sv005 = students[DEMO_MAP.sv005];
  const cSv005 = await createContract(sv005, roomOf('A15', '403'), periodFreshman, {
    term: '6_months',
    status: 'pending_payment',
    paymentDeadline: addDays(today(), -2),
    createdAt: `${addDays(today(), -9)}T08:00:00+07:00`,
    reviewedAt: new Date(`${addDays(today(), -9)}T08:00:05+07:00`),
  });
  await issueInitialInvoice(cSv005, `${addDays(today(), -9)}T08:00:10+07:00`, roomOf('A15', '403'), addDays(today(), -2));

  // sv007: vừa tự động xếp vào A14-301 (mustChangePassword = true, TK = MK = MSSV)
  const sv007 = students[DEMO_MAP.sv007];
  const cSv007 = await createContract(sv007, roomOf('A14', '301'), periodFreshman, {
    term: '12_months',
    status: 'pending_payment',
    paymentDeadline: addDays(today(), 6),
    createdAt: `${addDays(today(), -1)}T08:00:00+07:00`,
    reviewedAt: new Date(`${addDays(today(), -1)}T08:00:05+07:00`),
  });
  await issueInitialInvoice(cSv007, `${addDays(today(), -1)}T08:00:10+07:00`, roomOf('A14', '301'), addDays(today(), 6));

  // ================================================================ 8. Hợp đồng `terminated` (sv003 hoàn cọc xong + 3 SV CHỜ HOÀN CỌC + 1 SV đã hoàn cọc có khấu trừ)
  const startOld = addMonths(today(), -14);

  // sv003: Cựu nội trú đã thanh lý & hoàn đủ cọc 500k năm trước -> đăng nhập lại để test gia hạn tự động 100%
  const sv003 = students[DEMO_MAP.sv003];
  const cSv003Old = await createContract(sv003, roomOf('A14', '302'), periodReturning, {
    term: '12_months',
    status: 'terminated',
    startDate: startOld,
    terminatedAt: addMonths(startOld, 12),
    isDepositRefunded: true,
    depositDeductionAmount: 0,
    depositRefundAmount: 500000,
    depositRefundReason: 'Hoàn đủ 100% tiền cọc sau khi bàn giao tài sản nguyên vẹn',
    depositRefundedAt: new Date(`${addDays(addMonths(startOld, 12), 1)}T15:00:00+07:00`),
    depositRefundedBy: staffUser._id,
    depositRefundedByName: STAFF_NAME,
    createdAt: `${addDays(startOld, -5)}T09:00:00+07:00`,
    reviewedAt: new Date(`${addDays(startOld, -5)}T09:00:05+07:00`),
  });
  await payInvoice(await issueInitialInvoice(cSv003Old, `${startOld}T08:30:00+07:00`, roomOf('A14', '302')), sv003._id, `${addDays(startOld, 1)}T09:00:00+07:00`, 0);
  refSeq += 1;
  await Payment.create({
    paymentCode: `REF-${YEAR_STR}-${pad(refSeq)}`,
    paymentType: 'refund',
    invoiceId: null,
    contractId: cSv003Old._id,
    amount: 500000,
    method: 'cash',
    note: `Hoàn đủ tiền cọc hợp đồng ${cSv003Old.contractCode}`,
    paidAt: new Date(`${addDays(addMonths(startOld, 12), 1)}T15:00:00+07:00`),
    payerStudentId: sv003._id,
    collectedBy: staffUser._id,
    collectedByName: STAFF_NAME,
  });

  // 3 Hợp đồng `terminated` CHỜ HOÀN CỌC (sv006 + 2 SV khác)
  const awaitingRefundSpecs = [
    { st: students[DEMO_MAP.sv006], room: roomOf('A14', '401'), term: '12_months' },
    { st: students[43],             room: roomOf('A15', '401'), term: '12_months' },
    { st: students[44],             room: roomOf('A15', '402'), term: '6_months'  },
  ];
  for (const [riIdx, spec] of awaitingRefundSpecs.entries()) {
    const cWait = await createContract(spec.st, spec.room, periodReturning, {
      term: spec.term,
      status: 'terminated',
      startDate: startOld,
      terminatedAt: addDays(today(), -(riIdx + 1)),
      createdAt: `${addDays(startOld, -5)}T09:00:00+07:00`,
      reviewedAt: new Date(`${addDays(startOld, -5)}T09:00:05+07:00`),
    });
    await payInvoice(await issueInitialInvoice(cWait, `${startOld}T09:05:00+07:00`, spec.room), spec.st._id, `${addDays(startOld, 1)}T10:00:00+07:00`, riIdx);
  }

  // 1 Hợp đồng đã thanh lý & hoàn cọc có khấu trừ 100.000đ -> phiếu chi `refund` tách khỏi doanh thu
  const stRefunded = students[46];
  const cRefunded = await createContract(stRefunded, roomOf('A15', '404'), periodReturning, {
    term: '12_months',
    status: 'terminated',
    startDate: startOld,
    terminatedAt: addMonths(startOld, 12),
    isDepositRefunded: true,
    depositDeductionAmount: 100000,
    depositRefundAmount: 400000,
    depositRefundReason: 'Khấu trừ thay khóa tủ cá nhân bị hỏng',
    depositRefundedAt: new Date(`${addDays(addMonths(startOld, 12), 2)}T14:00:00+07:00`),
    depositRefundedBy: staffUser._id,
    depositRefundedByName: STAFF_NAME,
    createdAt: `${addDays(startOld, -5)}T09:00:00+07:00`,
    reviewedAt: new Date(`${addDays(startOld, -5)}T09:00:05+07:00`),
  });
  await payInvoice(await issueInitialInvoice(cRefunded, `${startOld}T09:05:00+07:00`, roomOf('A15', '404')), stRefunded._id, `${addDays(startOld, 1)}T10:00:00+07:00`, 3);
  refSeq += 1;
  await Payment.create({
    paymentCode: `REF-${YEAR_STR}-${pad(refSeq)}`,
    paymentType: 'refund',
    invoiceId: null,
    contractId: cRefunded._id,
    amount: 400000,
    method: 'cash',
    note: `Hoàn cọc hợp đồng ${cRefunded.contractCode} (khấu trừ 100.000đ: thay khóa tủ)`,
    paidAt: new Date(`${addDays(addMonths(startOld, 12), 2)}T14:00:00+07:00`),
    payerStudentId: stRefunded._id,
    collectedBy: staffUser._id,
    collectedByName: STAFF_NAME,
  });

  // ================================================================ 9. Chỉ số Điện Nước & Hóa đơn Phòng (tháng trước đã chốt cho toàn bộ phòng có người ở)
  const prevMonth = addMonthsToMonth(localMonth(), -1);
  const occupiedRoomMap = new Map();
  for (const rec of activeRecords) {
    const k = String(rec.room._id);
    if (!occupiedRoomMap.has(k)) occupiedRoomMap.set(k, { room: rec.room, members: [] });
    occupiedRoomMap.get(k).members.push(rec.st);
  }
  const sv001RoomId = String(roomOf('A14', '101')._id);
  const sv002RoomId = String(roomOf('A15', '103')._id);

  let ri = 0;
  for (const { room, members } of occupiedRoomMap.values()) {
    ri += 1;
    const eOld = 1000 + ri * 35;
    const eNew = eOld + 75 + (ri % 6) * 8;
    const wOld = 100 + ri * 4;
    const wNew = wOld + 9 + (ri % 5);
    const e = { oldIndex: eOld, newIndex: eNew, usage: eNew - eOld, unitPrice: UNIT.electricity, amount: (eNew - eOld) * UNIT.electricity };
    const w = { oldIndex: wOld, newIndex: wNew, usage: wNew - wOld, unitPrice: UNIT.water, amount: (wNew - wOld) * UNIT.water };
    const total = e.amount + w.amount;
    const reading = await UtilityReading.create({
      roomId: room._id,
      monthYear: prevMonth,
      electricity: e,
      water: w,
      totalAmount: total,
      occupantsCount: members.length,
      perStudentAmount: Math.round(total / members.length),
      isBilled: true,
      recordedBy: staffUser._id,
      recordedByName: STAFF_NAME,
      recordedAt: new Date(`${prevMonth}-28T16:00:00+07:00`),
    });
    const issued = `${localMonth()}-01`;
    const inv = await Invoice.create({
      invoiceCode: utilityInvoiceCode(codeOfRoom(room), room.roomNumber, prevMonth),
      type: 'utility',
      scope: 'room',
      amount: total,
      description: `Tiền điện nước Phòng ${codeOfRoom(room)}-${room.roomNumber} - Tháng ${Number(prevMonth.slice(5))}/${prevMonth.slice(0, 4)} (${members.length} người)`,
      studentId: null,
      roomId: room._id,
      utilityReadingId: reading._id,
      monthYear: prevMonth,
      dueDate: addDays(issued, 7),
      status: 'unpaid',
    });
    // Phòng sv001 (A14-101) giữ chưa trả để test thanh toán điện nước & cảnh báo công nợ; phòng sv002 (A15-101) & đa số đã trả
    if (String(room._id) !== sv001RoomId && (String(room._id) === sv002RoomId || ri % 4 !== 0)) {
      const payDay = addDays(issued, 2);
      await payInvoice(inv, members[0]._id, `${payDay > today() ? today() : payDay}T10:30:00+07:00`, ri);
    }
  }

  // ================================================================ 10. Tài khoản Sinh viên Demo (sv001..sv007)
  const studentUsers = {};
  for (const [alias, idx] of Object.entries(DEMO_MAP)) {
    const st = students[idx];
    if (alias === 'sv007') {
      studentUsers[alias] = await makeUser(`${alias}@dorm.local`, st.studentCode, 'student', null, st, { mustChangePassword: true });
    } else {
      studentUsers[alias] = await makeUser(`${alias}@dorm.local`, 'Student@123', 'student', null, st);
    }
  }

  // ================================================================ 11. Phiếu Yêu cầu SV mẫu (`requests`)
  const sv001Active = activeRecords.find((r) => r.idx === DEMO_MAP.sv001);
  reqSeq += 1;
  await Request.create({
    requestCode: `REQ-${YEAR_STR}-${pad(reqSeq)}`,
    studentId: sv001Active.st._id,
    contractId: sv001Active.c._id,
    roomId: sv001Active.room._id,
    type: 'repair',
    repairCategory: 'ac',
    title: 'Điều hòa phòng A14-101 kêu to và kém lạnh',
    description: 'Từ tối qua điều hòa chạy phát tiếng ồn lớn, nhờ tổ kỹ thuật kiểm tra nạp gas.',
    status: 'pending',
  });

  const checkoutSample = activeRecords.find((r) => r.idx === 18);
  if (checkoutSample) {
    reqSeq += 1;
    await Request.create({
      requestCode: `REQ-${YEAR_STR}-${pad(reqSeq)}`,
      studentId: checkoutSample.st._id,
      contractId: checkoutSample.c._id,
      roomId: checkoutSample.room._id,
      type: 'checkout',
      title: 'Đăng ký trả phòng cuối tuần này',
      description: 'Em xin hẹn lịch kiểm kê tài sản và thanh lý hợp đồng vào sáng thứ Bảy lúc 09:00.',
      status: 'pending',
    });
  }

  // ================================================================ 12. Bảng tin công khai & Thông báo cá nhân (`notifications` — phân loại ưu tiên Khẩn / Quan trọng / Thông thường)
  await Notification.insertMany([
    {
      recipientId: null,
      scope: 'broadcast',
      campus: 'cs1',
      type: 'announcement',
      priority: 'important',
      title: `Thông báo bảng giá và mở cổng đăng ký KTX Cơ sở 1 năm học ${YEAR}–${YEAR + 1}`,
      content: `Trung tâm Hỗ trợ sinh viên HaUI mở cổng đăng ký nội trú tại Nhà A14 & A15 (Ngõ 296 Cầu Diễn, P. Tây Tựu, HN) với 2 hạng phòng Chất lượng cao & Tiêu chuẩn (>30m² khép kín), kỳ hạn Nửa năm (6 tháng) hoặc 1 năm (12 tháng).`,
      createdBy: managerUser._id,
      createdByName: MANAGER_NAME,
    },
    {
      recipientId: null,
      scope: 'broadcast',
      campus: 'cs1',
      type: 'announcement',
      priority: 'normal',
      title: 'Hướng dẫn đóng phí qua VietQR & nhận phòng bằng mã QR Check-in tại nhà A14',
      content: 'Ngay sau khi hoàn tất chuyển khoản VietQR (tự động gạch nợ), sinh viên mở mã QR Check-in trên Cổng Sinh viên và mang theo CCCD đến tầng 1 nhà A14 để nhận chìa khóa phòng.',
      createdBy: staffUser._id,
      createdByName: STAFF_NAME,
    },
    {
      recipientId: null,
      scope: 'broadcast',
      campus: 'cs1',
      type: 'announcement',
      priority: 'urgent',
      title: 'Lịch tạm cắt điện nước bảo trì định kỳ tại nhà A14 & A15',
      content: 'Tổ kỹ thuật sẽ kiểm tra bảo dưỡng hệ thống điện nước và điều hòa các phòng tầng 1–3 vào sáng Chủ nhật tuần này từ 08:00 đến 11:00. Sinh viên lưu ý chủ động tích trữ nước sinh hoạt.',
      createdBy: staffUser._id,
      createdByName: STAFF_NAME,
    },
    {
      recipientId: studentUsers.sv001._id,
      scope: 'personal',
      campus: 'cs1',
      type: 'utility',
      priority: 'urgent',
      title: `Hóa đơn điện nước kỳ ${prevMonth} — Phòng A14-101`,
      content: 'Phòng A14-101 đã có hóa đơn điện nước kỳ trước. Một thành viên đại diện vui lòng mở Cổng Sinh viên quét VietQR thanh toán trước hạn.',
      isRead: false,
    },
    {
      recipientId: studentUsers.sv004._id,
      scope: 'personal',
      campus: 'cs1',
      type: 'application',
      priority: 'important',
      title: `Đã tự động xếp Phòng A14-301 (${cSv004.contractCode})`,
      content: `Vui lòng hoàn tất thanh toán phí phòng & đặt cọc qua VietQR trước ngày ${cSv004.paymentDeadline} để tự động kích hoạt hợp đồng và nhận mã QR Check-in.`,
      refType: 'contract',
      refId: cSv004._id,
      isRead: false,
    },
  ]);

  const counts = await Promise.all([
    User.countDocuments(),
    Student.countDocuments(),
    Building.countDocuments(),
    Room.countDocuments(),
    RegistrationPeriod.countDocuments(),
    Contract.countDocuments(),
    UtilityReading.countDocuments(),
    Invoice.countDocuments(),
    Payment.countDocuments(),
    Request.countDocuments(),
    Notification.countDocuments(),
  ]);

  console.log(
    `[SEED] ✅ HaUI - DMS Cơ sở 1 sẵn sàng: ${counts[0]} users · ${counts[1]} SV · ${counts[2]} tòa (A14, A15) · ${counts[3]} phòng (16 CLC / 24 TC) · ${counts[4]} đợt ĐK · ${counts[5]} hợp đồng · ${counts[6]} điện nước · ${counts[7]} hóa đơn · ${counts[8]} phiếu thu/chi · ${counts[9]} yêu cầu · ${counts[10]} thông báo`
  );
  console.log('[SEED] Tài khoản: admin@dorm.local / Admin@123 | manager@dorm.local / Manager@123 | staff@dorm.local / Staff@123 | sv001..sv006@dorm.local / Student@123');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('[SEED] ❌', err);
  await mongoose.disconnect();
  process.exit(1);
});

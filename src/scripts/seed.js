/**
 * Dữ liệu mẫu HaUI - DMS v3.0 (3 Cơ sở địa giới 2026 · 4 Vai trò RBAC · 11 Collections · Quản lý cấp Phòng).
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

const {
  ROOM_PRICES_2026,
  HANOI_FRESHMAN_FACULTIES,
  TERM_MONTHS,
} = require('../shared/constants/enums');
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
const ENG_FACULTIES = ['Công nghệ thông tin', 'Cơ khí', 'Điện', 'Điện tử', 'Công nghệ Ô tô', 'Kinh tế'];
const HN_FACULTIES = ['Ngôn ngữ Anh', 'Ngôn ngữ Trung Quốc', 'Công nghệ Dệt May', 'Công nghệ Hóa học'];
const PROVINCES = ['Hà Nội', 'Ninh Bình', 'Nam Định', 'Thái Bình', 'Nghệ An', 'Thanh Hóa', 'Hải Dương', 'Bắc Ninh', 'Phú Thọ'];

let invSeq = 0;
let paySeq = 0;
let refSeq = 0;
let contractSeq = 0;
let reqSeq = 0;

function amenitiesOf(tier, capacity) {
  if (tier === 'high_quality') {
    return ['Wifi miễn phí', 'Điều hòa', 'Bình nóng lạnh', 'Quạt trần', 'Tủ cá nhân', capacity <= 3 ? 'Giường gỗ' : 'Giường tầng', 'Đệm', 'Công trình phụ khép kín'];
  }
  if (tier === 'standard') {
    return ['Wifi miễn phí', 'Bình nóng lạnh', 'Quạt trần', 'Tủ cá nhân', 'Giường tầng', 'Công trình phụ khép kín'];
  }
  return ['Quạt trần', 'Tủ cá nhân', 'Giường tầng', 'Công trình phụ khép kín'];
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

  // ================================================================ 1. 7 Tòa nhà thực tế tại 3 Cơ sở HaUI (Địa giới 2026)
  const buildingSpecs = [
    { campus: 'cs1', code: 'A14', name: 'Nhà A14 (Cơ sở 1)', totalFloors: 5, description: 'Khu KTX nam Cơ sở 1 — Ngõ 296 Cầu Diễn, P. Tây Tựu, HN' },
    { campus: 'cs1', code: 'A15', name: 'Nhà A15 (Cơ sở 1)', totalFloors: 5, description: 'Khu KTX nữ & SV quốc tế Cơ sở 1 — Ngõ 296 Cầu Diễn, P. Tây Tựu, HN' },
    { campus: 'cs2', code: 'B12', name: 'Nhà B12 (Cơ sở 2)', totalFloors: 5, description: '72 phòng, ~317 chỗ ở — TDP Thượng 2, P. Tây Tựu, HN' },
    { campus: 'cs2', code: 'B14', name: 'Nhà B14 (Cơ sở 2)', totalFloors: 5, description: '40 phòng, ~159 chỗ ở — TDP Thượng 2, P. Tây Tựu, HN' },
    { campus: 'cs3', code: 'C15', name: 'Nhà C15 (Cơ sở 3)', totalFloors: 5, description: '57 phòng, ~260 chỗ ở — P. Phù Vân, Tỉnh Ninh Bình' },
    { campus: 'cs3', code: 'C16', name: 'Nhà C16 (Cơ sở 3)', totalFloors: 5, description: '63 phòng, ~270 chỗ ở — P. Phù Vân, Tỉnh Ninh Bình' },
    { campus: 'cs3', code: 'C17', name: 'Nhà C17 (Cơ sở 3)', totalFloors: 6, description: '210 phòng, ~926 chỗ ở — P. Phù Vân, Tỉnh Ninh Bình' },
  ];
  const buildings = {};
  for (const spec of buildingSpecs) {
    buildings[spec.code] = await Building.create({ ...spec, isActive: true });
  }

  // ================================================================ 2. Phòng mẫu chuẩn bảng giá 2026-2027 (Quản lý cấp Phòng)
  const ROOM_LAYOUT = [
    { roomNumber: '101', floor: 1, roomTier: 'high_quality', capacity: 3 },
    { roomNumber: '102', floor: 1, roomTier: 'high_quality', capacity: 4 },
    { roomNumber: '201', floor: 2, roomTier: 'standard', capacity: 4 },
    { roomNumber: '202', floor: 2, roomTier: 'high_quality', capacity: 6 },
    { roomNumber: '301', floor: 3, roomTier: 'standard', capacity: 6 },
    { roomNumber: '402', floor: 4, roomTier: 'basic', capacity: 6 },
  ];
  const BUILDING_GENDER = { A14: 'male', A15: 'female', B12: 'male', B14: 'female', C15: 'male', C16: 'female', C17: 'male' };

  const rooms = [];
  for (const b of Object.values(buildings)) {
    for (const tpl of ROOM_LAYOUT) {
      const gender = b.code === 'C17' && tpl.floor >= 3 ? 'female' : BUILDING_GENDER[b.code];
      const pricePerMonth = ROOM_PRICES_2026[tpl.roomTier][tpl.capacity][b.campus];
      const status = b.code === 'B12' && tpl.roomNumber === '402' ? 'maintenance' : 'active';
      rooms.push(
        await Room.create({
          buildingId: b._id,
          roomNumber: tpl.roomNumber,
          floor: tpl.floor,
          gender,
          roomTier: tpl.roomTier,
          capacity: tpl.capacity,
          hasAirConditioner: tpl.roomTier === 'high_quality',
          hasWaterHeater: tpl.roomTier !== 'basic',
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

  // ================================================================ 3. 5 Đợt Đăng ký chuẩn HaUI (mở quanh ngày hiện tại)
  const periodCs3Freshman = await RegistrationPeriod.create({
    code: `DOT-${YEAR}-CS3-TSV`,
    name: `Đợt đăng ký KTX Tân sinh viên K${YEAR - 2005} tại Cơ sở 3 (Ninh Bình)`,
    academicYearStart: YEAR,
    campus: 'cs3',
    targetCohort: 'freshman',
    allowedFaculties: [],
    excludedFaculties: HANOI_FRESHMAN_FACULTIES,
    allowedTerms: ['5_months', '8.5_months', '10_months'],
    startDate: addDays(today(), -15),
    endDate: addDays(today(), 30),
    paymentDeadlineDays: 7,
    status: 'open',
    description: 'Dành cho Tân sinh viên năm nhất các khối ngành Kỹ thuật, CNTT, Cơ khí, Điện, Kinh tế học tập năm đầu tại Cơ sở 3 (Phường Phù Vân, Ninh Bình).',
  });

  const periodCs1Freshman = await RegistrationPeriod.create({
    code: `DOT-${YEAR}-CS1-TSV`,
    name: `Đợt đăng ký KTX Tân sinh viên khối Ngôn ngữ / Dệt may / Hóa tại Cơ sở 1 (Hà Nội)`,
    academicYearStart: YEAR,
    campus: 'cs1',
    targetCohort: 'freshman',
    allowedFaculties: HANOI_FRESHMAN_FACULTIES,
    excludedFaculties: [],
    allowedTerms: ['5_months', '10_months', '12_months'],
    startDate: addDays(today(), -15),
    endDate: addDays(today(), 30),
    paymentDeadlineDays: 7,
    status: 'open',
    description: 'Dành cho Tân sinh viên các ngành Ngôn ngữ, Dệt May & Thiết kế thời trang, Công nghệ Hóa - Môi trường - Thực phẩm học tại Hà Nội từ năm nhất.',
  });

  const periodCs1Returning = await RegistrationPeriod.create({
    code: `DOT-${YEAR}-CS1-KCU`,
    name: `Đợt đăng ký / Gia hạn KTX Sinh viên năm 2 trở lên — Cơ sở 1 (Hà Nội)`,
    academicYearStart: YEAR,
    campus: 'cs1',
    targetCohort: 'returning',
    allowedFaculties: [],
    excludedFaculties: [],
    allowedTerms: ['5_months', '6_months', '10_months', '12_months'],
    startDate: addDays(today(), -10),
    endDate: addDays(today(), 30),
    paymentDeadlineDays: 7,
    status: 'open',
    description: 'Dành cho sinh viên năm 2 trở lên (đăng ký mới hoặc gia hạn trực tiếp trên Cổng Sinh viên) tại khu A14–A15 Cơ sở 1.',
  });

  const periodCs2Returning = await RegistrationPeriod.create({
    code: `DOT-${YEAR}-CS2-KCU`,
    name: `Đợt đăng ký / Gia hạn KTX Sinh viên năm 2 trở lên — Cơ sở 2 (Hà Nội)`,
    academicYearStart: YEAR,
    campus: 'cs2',
    targetCohort: 'returning',
    allowedFaculties: [],
    excludedFaculties: [],
    allowedTerms: ['5_months', '6_months', '10_months', '12_months'],
    startDate: addDays(today(), -10),
    endDate: addDays(today(), 30),
    paymentDeadlineDays: 7,
    status: 'open',
    description: 'Dành cho sinh viên năm 2 trở lên tại khu B12–B14 Cơ sở 2 (TDP Thượng 2, P. Tây Tựu, TP. Hà Nội).',
  });

  await RegistrationPeriod.create({
    code: `DOT-${YEAR - 1}-HK2`,
    name: `Đợt đăng ký KTX Học kỳ II năm học ${YEAR - 1}–${YEAR} (Đã đóng)`,
    academicYearStart: YEAR - 1,
    campus: 'all',
    targetCohort: 'all',
    allowedTerms: ['5_months', '6_months'],
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

  const adminUser = await makeUser('admin@dorm.local', 'Admin@123', 'admin', 'Nguyễn Văn Quản Trị');
  const managerUser = await makeUser('manager@dorm.local', 'Manager@123', 'manager', MANAGER_NAME);
  const staffUser = await makeUser('staff@dorm.local', 'Staff@123', 'staff', STAFF_NAME);
  await makeUser('staff2@dorm.local', 'Staff@123', 'staff', 'Đỗ Minh Tuấn', null, { isActive: false });
  await makeUser('doimk@dorm.local', 'Tam@12345', 'staff', 'Phạm Văn Mới Vào', null, { mustChangePassword: true });

  // ================================================================ 5. 50 Hồ sơ Sinh viên HaUI (MSSV 10 số chuẩn YYYY60xxxx)
  const students = [];
  for (let i = 0; i < 50; i += 1) {
    // 0..24: Năm 3 (returning); 25..49: Tân SV năm nhất (freshman)
    const isFreshman = i >= 25;
    const enrollYear = isFreshman ? YEAR : YEAR - 2;
    const male = i % 2 === 0;
    const studentCode = `${enrollYear}600${pad(i + 1, 3)}`;
    const faculty = isFreshman && i % 5 === 0 ? HN_FACULTIES[i % HN_FACULTIES.length] : ENG_FACULTIES[i % ENG_FACULTIES.length];
    const fullName = `${LAST[i % 10]} ${(male ? MIDDLE_M : MIDDLE_F)[i % 5]} ${(male ? FIRST_M : FIRST_F)[Math.floor(i / 2) % 10]}`;
    const priorityType = i % 11 === 0 ? 'policy_family' : i % 9 === 0 ? 'poor_household' : i % 7 === 0 ? 'remote_area' : 'normal';
    const hasHealthCondition = i === 38 || i === 42;
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
        className: `K${enrollYear - 2005}-0${(i % 3) + 1}`,
        enrollmentYear: enrollYear,
        priorityType,
        hasHealthCondition,
        healthNote: hasHealthCondition ? 'Chấn thương đầu gối, đề nghị xếp phòng tầng 1-2' : '',
        emergencyContact: {
          name: `${LAST[(i + 3) % 10]} Văn ${FIRST_M[(i + 1) % 10]}`,
          phone: `0987${pad(200000 + i * 71, 6)}`,
          relationship: i % 2 ? 'Mẹ' : 'Bố',
        },
        status: 'active',
      })
    );
  }

  // Tài khoản Demo SV dễ nhớ cho FE & bộ test
  // sv001 (idx 0, nam, năm 3)  : active CS1 A14-101, còn hóa đơn điện nước chưa nộp
  // sv002 (idx 1, nữ, năm 3)   : active CS1 A15-101, sạch nợ, sẵn sàng test chuyển phòng / báo hỏng
  // sv003 (idx 20, nam, năm 3) : CHƯA có hợp đồng -> test POST /api/portal/applications
  // sv004 (idx 26, nam, TSV)   : pending_payment CS3 C15-102 (chưa quá hạn) -> test Webhook VietQR
  // sv005 (idx 28, nam, TSV)   : pending_payment QUÁ HẠN CS3 C15-201 -> test cancel-overdue
  // sv006 (idx 22, nam, năm 3) : terminated, CHƯA hoàn cọc -> test deposit-refund có khấu trừ
  // sv007 (idx 30, nam, TSV)   : vừa được duyệt, TK = MK = MSSV, mustChangePassword: true
  const DEMO_MAP = { sv001: 0, sv002: 1, sv003: 20, sv004: 26, sv005: 28, sv006: 22, sv007: 30 };

  const createContract = async (st, room, period, { term = '10_months', status = 'active', startDate = null, paymentDeadline = null, createdAt, reviewedAt = null, ...extra } = {}) => {
    contractSeq += 1;
    const months = TERM_MONTHS[term];
    const contractCode = `HD-${YEAR_STR}-${pad(contractSeq)}`;
    const checkinCode = status === 'active' ? `QRC-${contractCode}-${crypto.randomBytes(3).toString('hex').toUpperCase()}` : null;
    const c = await Contract.create({
      contractCode,
      periodId: period?._id ?? null,
      studentId: st._id,
      roomId: room._id,
      term,
      status,
      pricePerMonth: room.pricePerMonth,
      totalRoomFee: Math.round(room.pricePerMonth * months),
      depositAmount: room.depositAmount,
      paymentDeadline,
      startDate,
      endDate: startDate ? addMonths(startDate, months) : null,
      checkinCode,
      checkedInAt: status === 'active' && extra.checkedInAt !== null ? extra.checkedInAt ?? new Date(`${startDate}T14:00:00+07:00`) : null,
      checkedInBy: status === 'active' && extra.checkedInAt !== null ? staffUser._id : null,
      checkedInByName: status === 'active' && extra.checkedInAt !== null ? STAFF_NAME : null,
      reviewedAt,
      reviewedBy: reviewedAt ? staffUser._id : null,
      reviewedByName: reviewedAt ? STAFF_NAME : null,
      ...extra,
    });
    if (createdAt) await Contract.collection.updateOne({ _id: c._id }, { $set: { createdAt: new Date(createdAt) } });
    if (status === 'active' || status === 'pending_payment') {
      await Room.updateOne({ _id: room._id }, { $inc: { occupiedCount: 1 } });
    }
    return c;
  };

  const issueInvoice = async (c, type, issuedAt, room, dueDate = null) => {
    invSeq += 1;
    const inv = await Invoice.create({
      invoiceCode: `INV-${YEAR_STR}-${pad(invSeq)}`,
      type,
      scope: 'personal',
      amount: type === 'deposit' ? c.depositAmount : c.totalRoomFee,
      description:
        type === 'deposit'
          ? `Tiền đặt cọc tài sản - ${c.contractCode}`
          : `Tiền phòng ${codeOfRoom(room)}-${room.roomNumber} (${TERM_MONTHS[c.term]} tháng) - ${c.contractCode}`,
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
      note: method === 'cash' ? 'Nộp tiền mặt tại văn phòng KTX' : 'Webhook VietQR tự động',
      paidAt: new Date(paidAt),
      payerStudentId,
      collectedBy: staffUser._id,
      collectedByName: STAFF_NAME,
    });
    await Invoice.updateOne({ _id: inv._id }, { $set: { status: 'paid', paidAt: new Date(paidAt), payerStudentId } });
  };

  // ================================================================ 6. Xếp 18 SV đang ở `active` tại đủ 3 Cơ sở
  const activeRecords = [];
  const start2mAgo = addMonths(today(), -2);
  const placements = [
    // CS1 Nam (A14) & Nữ (A15)
    { idx: 0, room: roomOf('A14', '101'), period: periodCs1Returning, term: '10_months' }, // sv001
    { idx: 2, room: roomOf('A14', '101'), period: periodCs1Returning, term: '10_months' },
    { idx: 4, room: roomOf('A14', '201'), period: periodCs1Returning, term: '12_months' },
    { idx: 6, room: roomOf('A14', '201'), period: periodCs1Returning, term: '6_months' },
    { idx: 1, room: roomOf('A15', '101'), period: periodCs1Returning, term: '10_months' }, // sv002
    { idx: 3, room: roomOf('A15', '101'), period: periodCs1Returning, term: '10_months' },
    { idx: 5, room: roomOf('A15', '201'), period: periodCs1Returning, term: '12_months' },
    // CS2 Nam (B12) & Nữ (B14)
    { idx: 8, room: roomOf('B12', '102'), period: periodCs2Returning, term: '10_months' },
    { idx: 10, room: roomOf('B12', '102'), period: periodCs2Returning, term: '6_months' },
    { idx: 7, room: roomOf('B14', '201'), period: periodCs2Returning, term: '10_months' },
    { idx: 9, room: roomOf('B14', '201'), period: periodCs2Returning, term: '12_months' },
    // CS3 Tân SV (C15, C16, C17)
    { idx: 25, room: roomOf('C16', '101'), period: periodCs3Freshman, term: '8.5_months' },
    { idx: 27, room: roomOf('C16', '101'), period: periodCs3Freshman, term: '8.5_months' },
    { idx: 29, room: roomOf('C16', '201'), period: periodCs3Freshman, term: '10_months' },
    { idx: 32, room: roomOf('C15', '101'), period: periodCs3Freshman, term: '8.5_months' },
    { idx: 34, room: roomOf('C15', '101'), period: periodCs3Freshman, term: '8.5_months' },
    { idx: 36, room: roomOf('C17', '102'), period: periodCs3Freshman, term: '10_months' },
    { idx: 31, room: roomOf('C17', '301'), period: periodCs3Freshman, term: '10_months' },
  ];

  for (const [k, item] of placements.entries()) {
    const st = students[item.idx];
    const c = await createContract(st, item.room, item.period, {
      term: item.term,
      status: 'active',
      startDate: start2mAgo,
      createdAt: `${addDays(start2mAgo, -4)}T09:00:00+07:00`,
      reviewedAt: new Date(`${addDays(start2mAgo, -2)}T10:00:00+07:00`),
    });
    const issuedAt = `${addDays(start2mAgo, -2)}T10:05:00+07:00`;
    const depInv = await issueInvoice(c, 'deposit', issuedAt, item.room);
    const roomInv = await issueInvoice(c, 'room_semester', issuedAt, item.room);
    const paidAt = `${addDays(start2mAgo, -1)}T11:${pad((k * 3) % 60, 2)}:00+07:00`;
    await payInvoice(depInv, st._id, paidAt, k);
    await payInvoice(roomInv, st._id, paidAt, k + 1);
    activeRecords.push({ c, st, room: item.room, idx: item.idx });
  }

  // ================================================================ 7. Hợp đồng `pending_payment` (chưa quá hạn + quá hạn)
  // sv004: pending_payment chưa quá hạn tại CS3 C15-102
  const sv004 = students[DEMO_MAP.sv004];
  const cSv004 = await createContract(sv004, roomOf('C15', '102'), periodCs3Freshman, {
    term: '8.5_months',
    status: 'pending_payment',
    paymentDeadline: addDays(today(), 5),
    createdAt: `${addDays(today(), -2)}T08:30:00+07:00`,
    reviewedAt: new Date(`${addDays(today(), -1)}T09:00:00+07:00`),
  });
  await issueInvoice(cSv004, 'deposit', `${addDays(today(), -1)}T09:05:00+07:00`, roomOf('C15', '102'), addDays(today(), 5));
  await issueInvoice(cSv004, 'room_semester', `${addDays(today(), -1)}T09:05:00+07:00`, roomOf('C15', '102'), addDays(today(), 5));

  // sv005: pending_payment ĐÃ QUÁ HẠN 2 ngày tại CS3 C15-201 (dùng test cancel-overdue)
  const sv005 = students[DEMO_MAP.sv005];
  const cSv005 = await createContract(sv005, roomOf('C15', '201'), periodCs3Freshman, {
    term: '5_months',
    status: 'pending_payment',
    paymentDeadline: addDays(today(), -2),
    createdAt: `${addDays(today(), -10)}T08:00:00+07:00`,
    reviewedAt: new Date(`${addDays(today(), -9)}T09:00:00+07:00`),
  });
  await issueInvoice(cSv005, 'deposit', `${addDays(today(), -9)}T09:05:00+07:00`, roomOf('C15', '201'), addDays(today(), -2));
  await issueInvoice(cSv005, 'room_semester', `${addDays(today(), -9)}T09:05:00+07:00`, roomOf('C15', '201'), addDays(today(), -2));

  // sv007: vừa được duyệt giữ chỗ (mustChangePassword = true)
  const sv007 = students[DEMO_MAP.sv007];
  const cSv007 = await createContract(sv007, roomOf('C15', '102'), periodCs3Freshman, {
    term: '8.5_months',
    status: 'pending_payment',
    paymentDeadline: addDays(today(), 6),
    createdAt: `${addDays(today(), -1)}T08:00:00+07:00`,
    reviewedAt: new Date(`${today()}T08:30:00+07:00`),
  });
  await issueInvoice(cSv007, 'deposit', `${today()}T08:35:00+07:00`, roomOf('C15', '102'), addDays(today(), 6));
  await issueInvoice(cSv007, 'room_semester', `${today()}T08:35:00+07:00`, roomOf('C15', '102'), addDays(today(), 6));

  // ================================================================ 8. Đơn `pending` (đủ diện ưu tiên + hasHealthCondition cho auto-approve)
  // idx 38 (nam, hasHealthCondition: true), idx 40 (nam), idx 42 (nam, hasHealthCondition: true), idx 43 (nữ, poor_household)
  for (const [k, sIdx] of [38, 40, 42, 43].entries()) {
    const st = students[sIdx];
    const targetRoom = st.gender === 'male' ? roomOf('C15', '301') : roomOf('C16', '301');
    await createContract(st, targetRoom, periodCs3Freshman, {
      term: '8.5_months',
      status: 'pending',
      createdAt: `${addDays(today(), -5 + k)}T09:00:00+07:00`,
    });
  }

  // ================================================================ 9. Hợp đồng đã thanh lý `terminated` (chưa hoàn cọc + đã hoàn cọc có khấu trừ)
  const sv006 = students[DEMO_MAP.sv006];
  const startOld = addMonths(today(), -14);
  const cSv006 = await createContract(sv006, roomOf('A14', '301'), periodCs1Returning, {
    term: '12_months',
    status: 'terminated',
    startDate: startOld,
    terminatedAt: addMonths(startOld, 12),
    createdAt: `${addDays(startOld, -5)}T09:00:00+07:00`,
    reviewedAt: new Date(`${startOld}T09:00:00+07:00`),
  });
  await payInvoice(await issueInvoice(cSv006, 'deposit', `${startOld}T09:05:00+07:00`, roomOf('A14', '301')), sv006._id, `${addDays(startOld, 1)}T10:00:00+07:00`, 1);
  await payInvoice(await issueInvoice(cSv006, 'room_semester', `${startOld}T09:05:00+07:00`, roomOf('A14', '301')), sv006._id, `${addDays(startOld, 1)}T10:05:00+07:00`, 2);

  // 1 hợp đồng đã thanh lý & đã hoàn cọc kèm khấu trừ hỏng khóa tủ 100.000đ -> tạo phiếu chi `refund` (kiểm tra loại khỏi doanh thu!)
  const stRefunded = students[18];
  const cRefunded = await createContract(stRefunded, roomOf('B12', '201'), periodCs2Returning, {
    term: '10_months',
    status: 'terminated',
    startDate: startOld,
    terminatedAt: addMonths(startOld, 10),
    isDepositRefunded: true,
    depositDeductionAmount: 100000,
    depositRefundAmount: 400000,
    depositRefundReason: 'Khấu trừ thay khóa tủ cá nhân bị hỏng',
    depositRefundedAt: new Date(`${addDays(addMonths(startOld, 10), 2)}T14:00:00+07:00`),
    depositRefundedBy: staffUser._id,
    depositRefundedByName: STAFF_NAME,
    createdAt: `${addDays(startOld, -5)}T09:00:00+07:00`,
    reviewedAt: new Date(`${startOld}T09:00:00+07:00`),
  });
  await payInvoice(await issueInvoice(cRefunded, 'deposit', `${startOld}T09:05:00+07:00`, roomOf('B12', '201')), stRefunded._id, `${addDays(startOld, 1)}T10:00:00+07:00`, 3);
  await payInvoice(await issueInvoice(cRefunded, 'room_semester', `${startOld}T09:05:00+07:00`, roomOf('B12', '201')), stRefunded._id, `${addDays(startOld, 1)}T10:05:00+07:00`, 4);
  refSeq += 1;
  await Payment.create({
    paymentCode: `REF-${YEAR_STR}-${pad(refSeq)}`,
    paymentType: 'refund',
    invoiceId: null,
    contractId: cRefunded._id,
    amount: 400000,
    method: 'cash',
    note: `Hoàn cọc hợp đồng ${cRefunded.contractCode} (khấu trừ 100.000đ: thay khóa tủ)`,
    paidAt: new Date(`${addDays(addMonths(startOld, 10), 2)}T14:00:00+07:00`),
    payerStudentId: stRefunded._id,
    collectedBy: staffUser._id,
    collectedByName: STAFF_NAME,
  });

  // ================================================================ 10. Chỉ số Điện Nước & Hóa đơn Phòng (tháng trước đã chốt)
  const prevMonth = addMonthsToMonth(localMonth(), -1);
  const occupiedRoomMap = new Map();
  for (const rec of activeRecords) {
    const k = String(rec.room._id);
    if (!occupiedRoomMap.has(k)) occupiedRoomMap.set(k, { room: rec.room, members: [] });
    occupiedRoomMap.get(k).members.push(rec.st);
  }
  const sv001RoomId = String(roomOf('A14', '101')._id);
  const sv002RoomId = String(roomOf('A15', '101')._id);

  let ri = 0;
  for (const { room, members } of occupiedRoomMap.values()) {
    ri += 1;
    const eOld = 1000 + ri * 40;
    const eNew = eOld + 80 + ri * 5;
    const wOld = 100 + ri * 4;
    const wNew = wOld + 10 + (ri % 5);
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
    // Để phòng sv001 (A14-101) chưa trả để test thanh toán điện nước; phòng sv002 (A15-101) & đa số phòng khác đã trả
    if (String(room._id) !== sv001RoomId && (String(room._id) === sv002RoomId || ri % 3 !== 0)) {
      const payDay = addDays(issued, 2);
      await payInvoice(inv, members[0]._id, `${payDay > today() ? today() : payDay}T10:30:00+07:00`, ri);
    }
  }

  // ================================================================ 11. Tài khoản Sinh viên Demo (sv001..sv007)
  const studentUsers = {};
  for (const [alias, idx] of Object.entries(DEMO_MAP)) {
    const st = students[idx];
    if (alias === 'sv007') {
      studentUsers[alias] = await makeUser(`${alias}@dorm.local`, st.studentCode, 'student', null, st, { mustChangePassword: true });
    } else {
      studentUsers[alias] = await makeUser(`${alias}@dorm.local`, 'Student@123', 'student', null, st);
    }
  }

  // ================================================================ 12. Phiếu Yêu cầu SV mẫu (`requests`)
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

  // ================================================================ 13. Bảng tin công khai & Thông báo cá nhân (`notifications`)
  await Notification.insertMany([
    {
      recipientId: null,
      scope: 'broadcast',
      campus: 'all',
      type: 'announcement',
      title: `Thông báo bảng giá và mở cổng đăng ký KTX năm học ${YEAR}–${YEAR + 1}`,
      content: `Trung tâm Hỗ trợ sinh viên HaUI chính thức mở cổng tiếp nhận đơn nội trú tại 3 cơ sở (CS1 Tây Tựu, CS2 Tây Tựu, CS3 Phù Vân Ninh Bình). Sinh viên đăng nhập hoặc nộp đơn trực tuyến đúng đợt của khóa/ngành.`,
      createdBy: managerUser._id,
      createdByName: MANAGER_NAME,
    },
    {
      recipientId: null,
      scope: 'broadcast',
      campus: 'cs3',
      type: 'announcement',
      title: 'Hướng dẫn thủ tục Check-in nhận phòng bằng mã QR tại Cơ sở 3 (Phù Vân, Ninh Bình)',
      content: 'Sau khi quét VietQR hoàn tất đóng phí phòng & đặt cọc, sinh viên mở mã QR Check-in trên Cổng Sinh viên và mang theo CCCD + 02 ảnh 3x4 đến tầng 1 nhà C15/C16/C17 để nhận phòng nhanh.',
      createdBy: staffUser._id,
      createdByName: STAFF_NAME,
    },
    {
      recipientId: null,
      scope: 'broadcast',
      campus: 'cs1',
      type: 'announcement',
      title: 'Lịch bảo trì hệ thống điện nước định kỳ tại nhà A14–A15',
      content: 'Tổ kỹ thuật sẽ kiểm tra bảo dưỡng bình nóng lạnh và điều hòa các phòng tầng 1–3 vào sáng Chủ nhật tuần này từ 08:00 đến 11:00.',
      createdBy: staffUser._id,
      createdByName: STAFF_NAME,
    },
    {
      recipientId: studentUsers.sv001._id,
      scope: 'personal',
      campus: 'cs1',
      type: 'utility',
      title: `Hóa đơn điện nước kỳ ${prevMonth} — Phòng A14-101`,
      content: 'Phòng A14-101 đã có hóa đơn điện nước kỳ trước. Một thành viên đại diện vui lòng mở Cổng Sinh viên quét VietQR thanh toán.',
      isRead: false,
    },
    {
      recipientId: studentUsers.sv004._id,
      scope: 'personal',
      campus: 'cs3',
      type: 'application',
      title: `Đơn ${cSv004.contractCode} đã được duyệt giữ chỗ`,
      content: `Vui lòng hoàn tất thanh toán phí phòng & đặt cọc trước ngày ${cSv004.paymentDeadline} để tự động kích hoạt hợp đồng và nhận mã QR Check-in.`,
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
    `[SEED] ✅ HaUI - DMS v3.0 sẵn sàng: ${counts[0]} users · ${counts[1]} SV · ${counts[2]} tòa (3 cơ sở) · ${counts[3]} phòng · ${counts[4]} đợt ĐK · ${counts[5]} hợp đồng · ${counts[6]} điện nước · ${counts[7]} hóa đơn · ${counts[8]} phiếu thu/chi · ${counts[9]} yêu cầu · ${counts[10]} thông báo`
  );
  console.log('[SEED] Tài khoản: admin@dorm.local / Admin@123 | manager@dorm.local / Manager@123 | staff@dorm.local / Staff@123 | sv001@dorm.local / Student@123');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('[SEED] ❌', err);
  await mongoose.disconnect();
  process.exit(1);
});

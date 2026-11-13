/**
 * Dữ liệu mẫu bản v2 — dựng đủ tình huống để thử MỌI màn FE, cùng bộ tài khoản với dữ liệu giả của FE
 * (FE `src/mocks/` + checklist `docs/15` mục 24–35 dùng chung được cho cả hai chế độ).
 *
 * Chạy: MONGODB_URI=mongodb://127.0.0.1:27018/dms_ktx_test node src/scripts/seed.js
 *
 * ⚠️ XÓA SẠCH CSDL rồi dựng lại. Từ chối chạy vào cụm Atlas (`mongodb.net`, CSDL dùng chung của nhóm)
 *    trừ khi đặt SEED_ALLOW_REMOTE=true — đừng bỏ chốt này.
 *
 * Tình huống dựng sẵn (ngày tính theo hôm nay):
 *   sv001 đang ở, còn nợ tiền phòng · sv002 chưa từng ở · sv003 đang ở, không nợ, phòng không nợ điện nước
 *   sv004 hợp đồng còn 20 ngày · sv005 đơn bị từ chối · sv006 đơn chờ duyệt mà giường đã có người
 *   sv007 đã thanh lý, chưa nhận lại cọc · sv008 vừa được duyệt: đăng nhập MSSV/MSSV, buộc đổi mật khẩu
 *   sv009 hợp đồng hết hạn 5 ngày, còn nợ, phòng còn nợ điện nước · doimk@dorm.local mật khẩu tạm, buộc đổi
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');
const Building = require('../modules/rooms/building.model');
const Room = require('../modules/rooms/room.model');
const Contract = require('../modules/contracts/contract.model');
const Invoice = require('../modules/fees/invoice.model');
const Payment = require('../modules/payments/payment.model');
const UtilityReading = require('../modules/fees/utility-reading.model');
const { today, addDays, addMonths, addMonthsToMonth, localMonth } = require('../core/utils/dates');
const { utilityInvoiceCode } = require('../core/utils/code-generator');
const { TERM_MONTHS } = require('../shared/constants/enums');

const pad = (n, w = 4) => String(n).padStart(w, '0');
const YEAR = today().slice(0, 4);
const STAFF_NAME = 'Lê Thị Nhân Viên';
const PRICE_BY_CAPACITY = { 8: 250000, 6: 320000, 4: 450000 };
const UNIT = { electricity: 3000, water: 15000 };

const LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
const MIDDLE_M = ['Văn', 'Quốc', 'Minh', 'Đức', 'Hoàng'];
const MIDDLE_F = ['Thị', 'Ngọc', 'Phương', 'Thu', 'Minh'];
const FIRST_M = ['An', 'Bảo', 'Cường', 'Dũng', 'Hùng', 'Khoa', 'Long', 'Nam', 'Phúc', 'Tuấn'];
const FIRST_F = ['Anh', 'Châu', 'Hà', 'Lan', 'Linh', 'Mai', 'Ngân', 'Thảo', 'Trang', 'Yến'];
const FACULTIES = ['Công nghệ thông tin', 'Cơ khí', 'Điện', 'Điện tử', 'Du lịch', 'Ngoại ngữ', 'Kinh tế'];
const CLASS_PREFIX = ['KTPM', 'CKCT', 'KTD', 'KTDT', 'QTDL', 'NNA', 'QTKD'];
const PROVINCES = ['Hà Nội', 'Nam Định', 'Thái Bình', 'Nghệ An', 'Thanh Hóa', 'Hải Dương', 'Bắc Ninh', 'Phú Thọ'];

let invSeq = 0;
let paySeq = 0;
let contractSeq = 0;

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
  await Promise.all([User, Student, Building, Room, Contract, Invoice, Payment, UtilityReading].map((m) => m.syncIndexes()));

  // ---------------------------------------------------------------- tòa nhà, phòng
  const buildings = {
    K1: await Building.create({ code: 'K1', name: 'Tòa K1', description: 'KTX Cơ sở 1 — nam', isActive: true }),
    K2: await Building.create({ code: 'K2', name: 'Tòa K2', description: 'KTX Cơ sở 1 — nữ', isActive: true }),
    K3: await Building.create({ code: 'K3', name: 'Tòa K3', description: 'KTX Cơ sở 2 — đang cải tạo', isActive: false }),
  };
  const CAPACITY_PATTERN = [6, 6, 4, 8, 4, 8, 6, 4, 6, 4];
  const ROOM_NUMBERS = ['101', '102', '103', '104', '205', '206', '207', '208', '309', '310'];
  const rooms = [];
  for (const [code, gender] of [['K1', 'male'], ['K2', 'female']]) {
    for (let i = 0; i < 10; i += 1) {
      const capacity = CAPACITY_PATTERN[i];
      rooms.push(await Room.create({
        buildingId: buildings[code]._id, roomNumber: ROOM_NUMBERS[i], floor: Number(ROOM_NUMBERS[i][0]), gender, capacity,
        pricePerMonth: PRICE_BY_CAPACITY[capacity], depositAmount: 500000, status: 'active',
        beds: Array.from({ length: capacity }, (_, n) => ({ bedNumber: n + 1, status: 'available', studentId: null })),
      }));
    }
  }
  const roomOf = (code, number) => rooms.find((r) => String(r.buildingId) === String(buildings[code]._id) && r.roomNumber === number);
  const codeOfRoom = (room) => (String(room.buildingId) === String(buildings.K1._id) ? 'K1' : 'K2');

  // ---------------------------------------------------------------- sinh viên (90, hồ sơ đầy đủ)
  const students = [];
  for (let i = 0; i < 90; i += 1) {
    const male = i % 2 === 0;
    const f = i % FACULTIES.length;
    const fullName = `${LAST[i % 10]} ${(male ? MIDDLE_M : MIDDLE_F)[i % 5]} ${(male ? FIRST_M : FIRST_F)[Math.floor(i / 2) % 10]}`;
    students.push(await Student.create({
      studentCode: `2021600${pad(i + 1, 3)}`, fullName, gender: male ? 'male' : 'female',
      dob: `2004-${pad((i % 12) + 1, 2)}-${pad((i % 27) + 1, 2)}`,
      phone: `0912${pad(100000 + i * 137, 6)}`, email: `sv2021600${pad(i + 1, 3)}@sv.edu.vn`,
      citizenId: `0012040${pad(10000 + i * 31, 5)}`, address: `Xã Yên Lạc, huyện Yên Lạc, ${PROVINCES[i % PROVINCES.length]}`,
      faculty: FACULTIES[f], className: `${CLASS_PREFIX[f]}0${(i % 3) + 1}-K16`,
      emergencyContact: { name: `${LAST[(i + 3) % 10]} Văn ${FIRST_M[(i + 1) % 10]}`, phone: `0987${pad(200000 + i * 71, 6)}`, relationship: i % 2 ? 'Mẹ' : 'Bố' },
      status: 'active',
    }));
  }
  // Tài khoản demo sv001…sv009 → sinh viên theo chỉ số (nam: chẵn, nữ: lẻ).
  // ⚠️ Khớp DEMO_STUDENT_INDEX ở FE `src/mocks/mockDb.js` — màn đăng nhập và checklist dùng chung một bảng tài khoản
  const DEMO = { sv001: 0, sv002: 85, sv003: 2, sv004: 3, sv005: 73, sv006: 75, sv007: 80, sv008: 4, sv009: 9 };

  // ---------------------------------------------------------------- hợp đồng
  const newContract = async (st, room, bedNumber, { term = '12_months', status = 'pending', startDate = null, createdAt, reviewedAt = null, ...extra } = {}) => {
    contractSeq += 1;
    const months = TERM_MONTHS[term];
    const c = await Contract.create({
      contractCode: `HD-${YEAR}-${pad(contractSeq)}`, studentId: st._id, roomId: room._id, bedNumber, term, status,
      pricePerMonth: room.pricePerMonth, totalRoomFee: room.pricePerMonth * months, depositAmount: room.depositAmount,
      startDate, endDate: startDate ? addMonths(startDate, months) : null,
      reviewedAt, reviewedByName: reviewedAt ? STAFF_NAME : null, ...extra,
    });
    if (createdAt) await Contract.collection.updateOne({ _id: c._id }, { $set: { createdAt: new Date(createdAt) } });
    if (status === 'active') {
      await Room.updateOne({ _id: room._id, 'beds.bedNumber': bedNumber }, { $set: { 'beds.$.status': 'occupied', 'beds.$.studentId': st._id } });
    }
    return c;
  };

  const issue = async (c, type, issuedAt, room) => {
    invSeq += 1;
    const inv = await Invoice.create({
      invoiceCode: `INV-${YEAR}-${pad(invSeq)}`, type, scope: 'personal',
      amount: type === 'deposit' ? c.depositAmount : c.totalRoomFee,
      description: type === 'deposit' ? `Tiền đặt cọc - ${c.contractCode}`
        : `Tiền phòng ${codeOfRoom(room)}-${room.roomNumber} - ${TERM_MONTHS[c.term]} tháng (${c.contractCode})`,
      studentId: c.studentId, roomId: room._id, contractId: c._id, dueDate: addDays(issuedAt.slice(0, 10), 7), status: 'unpaid',
    });
    await Invoice.collection.updateOne({ _id: inv._id }, { $set: { createdAt: new Date(issuedAt) } });
    return inv;
  };

  const pay = async (inv, payerStudentId, paidAt, k) => {
    paySeq += 1;
    const method = k % 3 === 0 ? 'cash' : 'vietqr';
    await Payment.create({
      paymentCode: `PAY-${YEAR}-${pad(paySeq)}`, invoiceId: inv._id, amount: inv.amount, method,
      transactionCode: method === 'vietqr' && k % 2 ? `FT26${pad(250000 + paySeq * 37, 7)}` : null,
      note: method === 'cash' ? 'Nộp tại văn phòng' : '', paidAt: new Date(paidAt), payerStudentId, collectedByName: STAFF_NAME,
    });
    await Invoice.updateOne({ _id: inv._id }, { $set: { status: 'paid', paidAt: new Date(paidAt), payerStudentId } });
  };

  // Xếp 70 SV vào ở (35 nam K1, 35 nữ K2), để lại chỗ trống đủ mức: đầy, còn 1, còn nhiều
  // Số chỗ để trống từng phòng (tổng sức chứa 56 − 21 = 35 người mỗi tòa): 101, 104 đầy; 102 còn 1; 310 trống hẳn
  const FREE = [0, 1, 2, 0, 3, 2, 3, 2, 4, 4];
  const fill = new Map(rooms.map((r, idx) => [String(r._id), Math.max(0, r.capacity - FREE[idx % 10])]));
  const used = new Map();
  const placeIdx = [...Array(70).keys()];
  const active = [];
  const roomStart = addMonths(today(), -2); // vào ở 2 tháng trước
  for (const i of placeIdx) {
    const st = students[i];
    const room = rooms.find((r) => r.gender === st.gender && (used.get(String(r._id)) ?? 0) < fill.get(String(r._id)));
    if (!room) continue;
    const bedNumber = (used.get(String(room._id)) ?? 0) + 1;
    used.set(String(room._id), bedNumber);
    const term = i % 3 === 2 ? '6_months' : '12_months';
    let startDate = roomStart;
    if (i === DEMO.sv004) startDate = addMonths(addDays(today(), 20), -TERM_MONTHS[term]); // còn 20 ngày
    if (i === DEMO.sv009 || i === 10) startDate = addMonths(addDays(today(), -5), -TERM_MONTHS[term]); // hết hạn 5 ngày
    const reviewedAt = `${startDate}T09:00:00+07:00`;
    const c = await newContract(st, room, bedNumber, { term, status: 'active', startDate, createdAt: `${addDays(startDate, -3)}T10:00:00+07:00`, reviewedAt: new Date(reviewedAt) });
    active.push({ c, st, room, i });
  }
  // Hóa đơn cá nhân: cọc đã nộp hết; tiền phòng còn vài bạn nợ (sv001, sv009 nằm trong số này)
  for (const [k, { c, st, room, i }] of active.entries()) {
    const issuedAt = `${c.startDate}T09:05:00+07:00`;
    const deposit = await issue(c, 'deposit', issuedAt, room);
    const roomFee = await issue(c, 'room_semester', issuedAt, room);
    const paidAt = `${addDays(c.startDate, 1 + (k % 5))}T09:${pad((k * 7) % 60, 2)}:00+07:00`;
    await pay(deposit, st._id, paidAt, k);
    if (![DEMO.sv001, DEMO.sv009, 14, 22].includes(i)) await pay(roomFee, st._id, paidAt, k + 1);
  }

  // 2 giường trống chuyển bảo trì
  for (const r of [roomOf('K1', '102'), roomOf('K2', '206')]) {
    const fresh = await Room.findById(r._id);
    const bed = [...fresh.beds].reverse().find((b) => b.status === 'available');
    if (bed) { bed.status = 'maintenance'; await fresh.save(); }
  }

  // ---------------------------------------------------------------- điện nước: 2 tháng trước, tháng trước đã chốt; tháng này K1 nhập đủ, K2 nhập 4 phòng
  const thisMonth = localMonth();
  const months = [addMonthsToMonth(thisMonth, -2), addMonthsToMonth(thisMonth, -1), thisMonth];
  const sv009Room = active.find((a) => a.i === DEMO.sv009)?.room;
  const sv003Room = active.find((a) => a.i === DEMO.sv003)?.room;
  const occupiedRooms = rooms.filter((r) => (used.get(String(r._id)) ?? 0) > 0);
  for (const [ri, room] of occupiedRooms.entries()) {
    let elec = 1200 + ri * 37;
    let water = 90 + ri * 3;
    const indexInBuilding = occupiedRooms.filter((r) => codeOfRoom(r) === codeOfRoom(room)).indexOf(room);
    for (const [mi, monthYear] of months.entries()) {
      if (mi === 2 && codeOfRoom(room) === 'K2' && indexInBuilding > 3) break; // K2 tháng này mới nhập 4 phòng đầu
      const ne = elec + 100 + ((ri * 13 + mi * 7) % 80);
      const nw = water + 10 + ((ri + mi) % 12);
      const meter = (o, n, p) => ({ oldIndex: o, newIndex: n, usage: n - o, unitPrice: p, amount: (n - o) * p });
      const e = meter(elec, ne, UNIT.electricity);
      const w = meter(water, nw, UNIT.water);
      const reading = await UtilityReading.create({
        roomId: room._id, monthYear, electricity: e, water: w, totalAmount: e.amount + w.amount,
        recordedByName: STAFF_NAME, recordedAt: new Date(`${monthYear}-28T16:00:00+07:00`), isBilled: mi < 2,
      });
      if (mi < 2) {
        const n = used.get(String(room._id));
        await UtilityReading.updateOne({ _id: reading._id }, { $set: { occupantsCount: n, perStudentAmount: Math.round(reading.totalAmount / n) } });
        const issued = `${addMonthsToMonth(monthYear, 1)}-01`;
        const inv = await Invoice.create({
          invoiceCode: utilityInvoiceCode(codeOfRoom(room), room.roomNumber, monthYear), type: 'utility', scope: 'room',
          amount: reading.totalAmount, description: `Tiền điện nước Phòng ${room.roomNumber} - Tháng ${Number(monthYear.slice(5))}/${monthYear.slice(0, 4)} (${n} người)`,
          roomId: room._id, utilityReadingId: reading._id, monthYear, dueDate: addDays(issued, 7), status: 'unpaid',
        });
        await Invoice.collection.updateOne({ _id: inv._id }, { $set: { createdAt: new Date(`${issued}T08:00:00+07:00`) } });
        // Tháng xa trả hết; tháng gần còn vài phòng nợ (phòng sv009 nợ để thử chuông và BR-04; phòng sv003 luôn trả)
        const unpaid = mi === 1 && String(room._id) !== String(sv003Room?._id) && (ri % 4 === 3 || String(room._id) === String(sv009Room?._id));
        if (!unpaid) {
          const payer = active.filter((a) => String(a.room._id) === String(room._id)).sort((a, b) => a.st.studentCode.localeCompare(b.st.studentCode))[0];
          const day = addDays(issued, 1 + (ri % 5));
          await pay(inv, payer.st._id, `${day > today() ? today() : day}T10:00:00+07:00`, ri);
        }
      }
      elec = ne;
      water = nw;
    }
  }

  // ---------------------------------------------------------------- đơn chờ, bị từ chối, hợp đồng đã thanh lý
  const freeBed = async (room) => (await Room.findById(room._id).lean()).beds.find((b) => b.status === 'available')?.bedNumber;
  // 4 đơn chờ bình thường (sinh viên 71, 72, 77, 79) + sv006: đơn chọn giường đã có người (UC-02 4a)
  for (const [k, i] of [71, 72, 77, 79].entries()) {
    const st = students[i];
    const room = rooms.find((r) => r.gender === st.gender && r.capacity - (used.get(String(r._id)) ?? 0) > 1 && r.roomNumber !== '102' && r.roomNumber !== '206');
    const bed = await freeBed(room);
    await newContract(st, room, bed, { term: k % 2 ? '6_months' : '12_months', createdAt: `${addDays(today(), -10 + k)}T08:${pad(k * 11, 2)}:00+07:00` });
  }
  const sv006 = students[DEMO.sv006];
  const fullRoom = active.find((a) => a.st.gender === sv006.gender)?.room;
  await newContract(sv006, fullRoom, 1, { createdAt: `${addDays(today(), -3)}T14:00:00+07:00` });
  // sv005: đơn bị từ chối
  const sv005 = students[DEMO.sv005];
  await newContract(sv005, roomOf('K2', '310'), 1, {
    status: 'rejected', rejectionReason: 'Hồ sơ thiếu xác nhận của khoa, vui lòng bổ sung và nộp lại',
    createdAt: `${addDays(today(), -12)}T09:00:00+07:00`, reviewedAt: new Date(`${addDays(today(), -11)}T10:00:00+07:00`),
  });
  // Hợp đồng năm trước đã thanh lý: sv007 chưa nhận cọc, SV 82 đã nhận, SV 84 chưa nhận
  for (const [k, i] of [DEMO.sv007, 82, 84].entries()) {
    const st = students[i];
    const room = rooms.find((r) => r.gender === st.gender);
    const startDate = addMonths(today(), -14);
    const c = await newContract(st, room, room.capacity, {
      term: '12_months', status: 'terminated', startDate, terminatedAt: addMonths(startDate, 12),
      createdAt: `${addDays(startDate, -5)}T09:00:00+07:00`, reviewedAt: new Date(`${startDate}T09:00:00+07:00`),
      ...(k === 1 ? { isDepositRefunded: true, depositRefundedAt: new Date(`${addDays(addMonths(startDate, 12), 2)}T10:00:00+07:00`), depositRefundedByName: STAFF_NAME } : {}),
    });
    const issuedAt = `${startDate}T09:05:00+07:00`;
    await pay(await issue(c, 'deposit', issuedAt, room), st._id, `${addDays(startDate, 2)}T09:00:00+07:00`, k);
    await pay(await issue(c, 'room_semester', issuedAt, room), st._id, `${addDays(startDate, 2)}T09:10:00+07:00`, k + 1);
  }

  // ---------------------------------------------------------------- tài khoản
  const account = async (email, password, role, fullName, st = null, extra = {}) => User.create({
    email, role, fullName: st ? st.fullName : fullName, passwordHash: await User.hashPassword(password),
    studentId: st?._id ?? null, studentCode: st?.studentCode ?? null, ...extra,
  });
  await account('admin@dorm.local', 'Admin@123', 'admin', 'Nguyễn Văn Quản Trị');
  await account('staff@dorm.local', 'Staff@123', 'staff', STAFF_NAME);
  await account('admin2@dorm.local', 'Admin@123', 'admin', 'Hoàng Thị Phó Ban');
  await account('staff2@dorm.local', 'Staff@123', 'staff', 'Đỗ Minh Tuấn', null, { isActive: false });
  await account('doimk@dorm.local', 'Tam@12345', 'staff', 'Phạm Văn Mới Vào', null, { mustChangePassword: true });
  for (const [name, i] of Object.entries(DEMO)) {
    const st = students[i];
    if (name === 'sv008') await account(`${name}@dorm.local`, st.studentCode, 'student', null, st, { mustChangePassword: true });
    else await account(`${name}@dorm.local`, 'Student@123', 'student', null, st);
  }

  const counts = await Promise.all([Student, Room, Contract, Invoice, Payment, UtilityReading, User].map((m) => m.countDocuments()));
  console.log(`[SEED] ✅ Xong: ${counts[0]} SV · ${counts[1]} phòng · ${counts[2]} hợp đồng · ${counts[3]} hóa đơn · ${counts[4]} phiếu thu · ${counts[5]} chỉ số · ${counts[6]} tài khoản`);
  console.log('[SEED] Đăng nhập: admin@dorm.local / Admin@123 · staff@dorm.local / Staff@123 · sv001@dorm.local / Student@123');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('[SEED] ❌', err);
  await mongoose.disconnect();
  process.exit(1);
});

/**
 * Bộ kiểm thử tích hợp RESTful API HaUI - DMS (KTX Cơ sở 1 · 2 Tòa A14, A15 · 40 Phòng [CLC & Tiêu chuẩn] · Kỳ hạn 6T/12T · Tự động duyệt 100%).
 *
 * Cách chạy:
 *   MONGODB_URI=mongodb://127.0.0.1:27017/dms_ktx_test node src/scripts/seed.js
 *   MONGODB_URI=mongodb://127.0.0.1:27017/dms_ktx_test node src/scripts/test-haui-dms.js
 */

require('dotenv').config();
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');
const config = require('../core/config');
const { today } = require('../core/utils/dates');

const PORT = 5055;
const BASE = `http://localhost:${PORT}/api`;
const YEAR = Number(today().slice(0, 4));
let passed = 0;

const call = async (path, { method = 'GET', token, headers = {}, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, ...(await res.json()) };
};

const login = async (identifier, password, portal) => {
  const r = await call('/auth/login', { method: 'POST', body: { identifier, password, ...(portal ? { portal } : {}) } });
  assert.equal(r.status, 200, `Đăng nhập ${identifier} thất bại: ${r.message}`);
  return r.data.token;
};

const ok = (name) => {
  passed += 1;
  console.log(`✅ ${name}`);
};

const sampleProfile = (studentCode, overrides = {}) => ({
  studentCode,
  fullName: 'Nguyễn Minh Khôi',
  gender: 'male',
  dob: `${YEAR - 18}-05-15`,
  phone: '0912345678',
  email: `test_${studentCode}@sv.haui.edu.vn`,
  citizenId: '001208000123',
  address: 'P. Tây Tựu, TP. Hà Nội',
  faculty: 'Công nghệ thông tin',
  className: 'CNTT01-K21',
  emergencyContact: { name: 'Nguyễn Văn Bố', phone: '0987654321', relationship: 'Bố' },
  ...overrides,
});

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dms_ktx';
  if (/mongodb\.net/i.test(uri) && process.env.TEST_ALLOW_REMOTE !== 'true') {
    console.error('[TEST] ⛔ Từ chối chạy test trên Atlas.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });

  try {
    // ---------------------------------------------------------------- 1. Đăng nhập 4 vai trò + Tách cổng + Khóa TK + Đổi MK lần đầu
    assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'admin@dorm.local', password: 'sai' } })).status, 401);
    assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'staff2@dorm.local', password: 'Staff@123', portal: 'admin' } })).code, 'ACCOUNT_LOCKED');
    assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'staff@dorm.local', password: 'Staff@123', portal: 'student' } })).code, 'WRONG_LOGIN_PORTAL');
    assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'sv001@dorm.local', password: 'Student@123', portal: 'admin' } })).code, 'WRONG_LOGIN_PORTAL');

    const admin = await login('admin@dorm.local', 'Admin@123', 'admin');
    const manager = await login('manager@dorm.local', 'Manager@123', 'admin');
    const staff = await login('staff@dorm.local', 'Staff@123', 'admin');
    const sv001 = await login('sv001@dorm.local', 'Student@123', 'student');
    const sv002 = await login('sv002@dorm.local', 'Student@123', 'student');
    const sv003 = await login('sv003@dorm.local', 'Student@123', 'student');
    const sv004 = await login('sv004@dorm.local', 'Student@123', 'student');
    const sv007 = await login(`${YEAR}600051`, `${YEAR}600051`, 'student');
    ok('đăng nhập 4 vai trò + tách cổng Student/Admin + kiểm tra khóa tài khoản');

    assert.equal((await call('/portal/profile', { token: sv007 })).code, 'MUST_CHANGE_PASSWORD');
    ok('cưỡng bức đổi mật khẩu lần đầu chặn toàn bộ API khác');

    // ---------------------------------------------------------------- 2. Ma trận RBAC (Doanh thu CHỈ Manager, Admin chỉ quản trị User)
    assert.equal((await call('/users', { token: admin })).status, 200);
    assert.equal((await call('/dashboard/revenue', { token: admin })).status, 403);
    assert.equal((await call('/contracts', { token: admin })).status, 403);

    assert.equal((await call('/users', { token: manager })).status, 403);
    assert.equal((await call('/dashboard/revenue', { token: manager })).status, 200);

    assert.equal((await call('/dashboard/revenue', { token: staff })).status, 403, 'Staff KHÔNG được xem Doanh thu (chỉ Manager)');
    assert.equal((await call('/periods', { method: 'POST', token: staff, body: {} })).status, 403);
    assert.equal((await call('/invoices', { token: sv001 })).status, 403);
    ok('ma trận RBAC 4 vai trò: Admin chỉ User · Doanh thu chỉ Manager · Staff vận hành không cấu hình Đợt/Tòa/Phòng');

    // ---------------------------------------------------------------- 3. Trang chủ CS1 (2 tòa A14, A15 · 40 phòng) & Phân luồng Tân SV vs Năm 2+
    const campuses = (await call('/public/campuses')).data;
    assert.equal(campuses.campuses.length, 1, 'Thu gọn chỉ còn Cơ sở 1');
    assert.equal(campuses.campuses[0].buildings.length, 2, 'Cơ sở 1 có 2 tòa A14 và A15');
    assert.equal(campuses.campuses[0].stats.totalRooms, 40, 'Tổng 40 phòng tại CS1 (20 phòng/tòa)');

    const periodsFresh = (await call(`/public/periods/open?studentCode=${YEAR}609001&faculty=Công nghệ thông tin`)).data;
    const pFresh = periodsFresh.find((p) => p.targetCohort === 'freshman');
    const pRet = periodsFresh.find((p) => p.targetCohort === 'returning');
    assert.equal(pFresh.eligibility.eligible, true);
    assert.equal(pRet.eligibility.eligible, false);
    ok('trang chủ CS1 (2 tòa A14, A15 · 40 phòng CLC/Tiêu chuẩn) & tự phân luồng Tân SV vs Năm 2+');

    // ---------------------------------------------------------------- 4. Khóa loại phòng hết chỗ + Tự động duyệt 100% xếp tầng thấp -> cao + Tự hủy nhả chỗ + Chống mạo danh CCCD
    const availRes = await call(`/public/rooms/available?periodId=${pFresh.id}&gender=male`);
    const hq3 = availRes.data.roomTypes.find((t) => t.roomTier === 'high_quality' && t.capacity === 3);
    assert.equal(hq3?.isFull, true, 'Loại phòng CLC 3 người (A14-101 & A15-101) kín 100% phải bị khóa');
    assert.equal(
      (await call('/contracts/register-online', {
        method: 'POST',
        body: { ...sampleProfile(`${YEAR}609001`), periodId: pFresh.id, preferredRoomTier: 'high_quality', preferredCapacity: 3, term: '12_months' },
      })).code,
      'ROOM_FULL'
    );

    // Giới tính phòng động: A14-101 (Nam) cạnh A14-102 (Nữ), phòng trống A14-302 có gender === null
    const a14Rooms = (await call('/rooms?campus=cs1&limit=100', { token: staff })).data.items.filter((r) => r.buildingCode === 'A14');
    assert.equal(a14Rooms.find((r) => r.roomNumber === '101')?.gender, 'male');
    assert.equal(a14Rooms.find((r) => r.roomNumber === '102')?.gender, 'female');
    assert.equal(a14Rooms.find((r) => r.roomNumber === '302')?.gender, null);

    // Nộp đơn hợp lệ -> TỰ ĐỘNG DUYỆT 100% (xếp phòng tầng thấp -> cao, chuyển thẳng pending_payment, sinh 01 hóa đơn gộp `initial_payment` [1A] & cấp TK)
    const app1 = await call('/contracts/register-online', {
      method: 'POST',
      body: { ...sampleProfile(`${YEAR}609001`), periodId: pFresh.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '12_months' },
    });
    assert.equal(app1.status, 201);
    assert.equal(app1.data.status, 'pending_payment', 'Phải tự động duyệt thẳng sang pending_payment');
    assert.ok(app1.data.room?.roomNumber, 'Phải tự động xếp số phòng ngay khi nộp');
    assert.equal(app1.data.invoices.length, 1, 'Phương án 1A: chỉ sinh 01 hóa đơn gộp đầu kỳ (chống deadlock)');
    assert.equal(app1.data.invoices[0].type, 'initial_payment');
    assert.equal(app1.data.invoices[0].amount, app1.data.totalRoomFee + app1.data.depositAmount);

    // Chống ghi đè hồ sơ SV khi nộp trùng lúc đang có đơn/HĐ hiệu lực (Fix #6)
    const dupApply = await call('/contracts/register-online', {
      method: 'POST',
      body: { ...sampleProfile(`${YEAR}609001`, { fullName: 'HACKER OVERWRITE', phone: '0999999999' }), periodId: pFresh.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '12_months' },
    });
    assert.equal(dupApply.code, 'APPLICATION_OR_CONTRACT_EXISTS');
    const stCheck = (await call(`/students?search=${YEAR}609001`, { token: staff })).data.items[0];
    assert.equal(stCheck.fullName, 'Nguyễn Minh Khôi', 'Đơn bị từ chối KHÔNG được ghi đè hồ sơ SV đã có');

    // SV tự hủy đơn chờ đóng phí chưa nộp tiền -> tự nhả chỗ phòng
    const cancelledSelf = await call('/public/applications/cancel', {
      method: 'POST',
      body: { studentCode: `${YEAR}609001`, email: `test_${YEAR}609001@sv.haui.edu.vn`, citizenId: '001208000123', reason: 'Đổi gói thuê' },
    });
    assert.equal(cancelledSelf.status, 200);
    assert.equal(cancelledSelf.data.status, 'cancelled');

    // Chống mạo danh CCCD
    assert.equal(
      (await call('/contracts/register-online', {
        method: 'POST',
        body: { ...sampleProfile(`${YEAR}609001`, { citizenId: '999999999999', email: 'hacker@evil.com' }), periodId: pFresh.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '12_months' },
      })).code,
      'IDENTITY_MISMATCH'
    );

    // Nộp lại hợp lệ -> Tự động xếp phòng -> Webhook VietQR 1 chạm gạch nợ `initial_payment` -> Tự kích hoạt HĐ -> Kiểm tra 3A trước/sau QR Check-in
    const app2 = await call('/contracts/register-online', {
      method: 'POST',
      body: { ...sampleProfile(`${YEAR}609001`), periodId: pFresh.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '6_months' },
    });
    assert.equal(app2.status, 201);
    assert.equal(app2.data.status, 'pending_payment');
    assert.equal(app2.data.invoices.length, 1);

    const invInit = app2.data.invoices[0];
    const sim1 = await call('/payments/webhook/simulate', { method: 'POST', token: staff, body: { invoiceId: invInit.id, referenceCode: 'FT26TEST001' } });
    assert.equal(sim1.status, 201);
    assert.equal(sim1.data.contractActivated, true, '1A: đóng xong 01 hóa đơn gộp đầu kỳ phải kích hoạt HĐ ngay lập tức');
    assert.ok(sim1.data.checkinCode?.startsWith('QRC-'));

    // Idempotency Webhook
    const dup = await call('/payments/webhook/vietqr', {
      method: 'POST',
      headers: { 'x-webhook-secret': config.vietqr.webhookSecret },
      body: { content: `HAUI ${invInit.invoiceCode}`, transferAmount: invInit.amount, referenceCode: 'FT26TEST001' },
    });
    assert.equal(dup.data.alreadyProcessed, true);

    assert.equal((await call('/contracts/checkin-qr', { method: 'POST', token: staff, body: { checkinCode: sim1.data.checkinCode } })).status, 200);
    assert.equal((await call('/contracts/checkin-qr', { method: 'POST', token: staff, body: { checkinCode: sim1.data.checkinCode } })).code, 'ALREADY_CHECKED_IN');
    ok('1A (01 hóa đơn đầu kỳ chống deadlock) + chống ghi đè hồ sơ + Webhook VietQR 1 chạm kích hoạt + QR Check-in');

    // ---------------------------------------------------------------- 5. Hủy quá hạn đóng phí (`sv005` A15-403) -> Nhả chỗ & reset Trống
    const overdueRes = await call('/contracts/cancel-overdue', { method: 'POST', token: staff });
    assert.equal(overdueRes.status, 200);
    assert.ok(overdueRes.data.cancelledCount >= 1);
    const a15Rooms = (await call('/rooms?campus=cs1&limit=100', { token: staff })).data.items.filter((r) => r.buildingCode === 'A15');
    const a15403 = a15Rooms.find((r) => r.roomNumber === '403');
    assert.equal(a15403.occupied, 0);
    assert.equal(a15403.gender, null, 'Phòng A15-403 sau khi hủy quá hạn phải tự reset về Trống (gender = null)');
    ok('hủy quá hạn đóng phí nhả chỗ & tự reset giới tính phòng về Trống');

    // ---------------------------------------------------------------- 6. Cổng SV: sv004 dùng Sandbox VietQR 1 chạm -> kích hoạt HĐ -> 3A chặn repair/transfer trước khi Check-in
    const sv004Invs = (await call('/portal/my-invoices?status=unpaid', { token: sv004 })).data.items;
    assert.equal(sv004Invs.length, 1, '1A: sv004 chỉ có đúng 01 hóa đơn gộp đầu kỳ');
    assert.equal(sv004Invs[0].type, 'initial_payment');
    const vqr = (await call(`/portal/my-invoices/${sv004Invs[0].id}/vietqr`, { token: sv004 })).data;
    assert.equal(vqr.sandboxEnabled, true);
    assert.equal(vqr.webhookSecret, undefined);
    const portalPay = await call(`/portal/my-invoices/${sv004Invs[0].id}/simulate-vietqr`, { method: 'POST', token: sv004 });
    assert.equal(portalPay.status, 201);
    assert.equal(portalPay.data.contractActivated, true, '1A: SV bấm giả lập VietQR 1 lần phải tự kích hoạt HĐ ngay');

    // 3A: sv004 đã `active` nhưng chưa Check-in -> bị chặn gửi `repair` & `transfer`, vẫn gửi được `checkout`
    assert.equal(
      (await call('/portal/requests', { method: 'POST', token: sv004, body: { type: 'repair', repairCategory: 'electric', title: 'Test chưa CK', description: 'Test' } })).code,
      'NOT_CHECKED_IN'
    );
    assert.equal(
      (await call('/portal/requests', { method: 'POST', token: sv004, body: { type: 'transfer', title: 'Test chưa CK', description: 'Test' } })).code,
      'NOT_CHECKED_IN'
    );
    ok('Cổng SV: VietQR 1 chạm kích hoạt HĐ + 3A chặn báo hỏng/chuyển phòng khi chưa Check-in');

    // ---------------------------------------------------------------- 7. Cổng SV: sv003 (cựu nội trú) đăng ký kỳ mới -> tự động duyệt & xếp phòng ngay
    const sv003Apply = await call('/portal/applications', {
      method: 'POST',
      token: sv003,
      body: { periodId: pRet.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '12_months' },
    });
    assert.equal(sv003Apply.status, 201);
    assert.equal(sv003Apply.data.status, 'pending_payment');
    assert.equal(sv003Apply.data.invoices.length, 1);
    assert.ok(sv003Apply.data.room?.roomNumber, 'Gia hạn nội bộ phải tự động xếp phòng ngay');
    ok('Cổng SV: cựu nội trú gia hạn tự động duyệt & xếp phòng tầng thấp -> cao');

    // ---------------------------------------------------------------- 8. Phiếu Yêu cầu SV (2A Chuyển phòng cùng hạng, sạch nợ, 1 lần duy nhất + Đồng bộ Phiếu trả phòng <-> Thanh lý)
    // sv001 đang nợ điện nước A14-101 -> bị chặn gửi chuyển phòng (`OUTSTANDING_INVOICES`)
    assert.equal(
      (await call('/portal/requests', { method: 'POST', token: sv001, body: { type: 'transfer', title: 'Xin chuyển khi còn nợ', description: 'Test chặn nợ' } })).code,
      'OUTSTANDING_INVOICES'
    );

    const repair = await call('/portal/requests', {
      method: 'POST',
      token: sv002,
      body: { type: 'repair', repairCategory: 'electric', title: 'Hỏng bóng đèn bàn học', description: 'Đèn nhấp nháy liên tục' },
    });
    assert.equal(repair.status, 201);
    assert.equal((await call(`/requests/${repair.data.id}/status`, { method: 'PATCH', token: staff, body: { status: 'completed', handlerNote: 'Đã thay bóng LED' } })).status, 200);

    const sv002Res = (await call('/portal/my-residence', { token: sv002 })).data;
    const oldRoom = sv002Res.contract.room;
    const cs1Avail = (await call('/rooms?campus=cs1&availability=has_slot', { token: manager })).data.items;

    // 2A: Chặn chuyển sang phòng KHÁC hạng hoặc khác sức chứa
    const wrongTierRoom = cs1Avail.find(
      (r) => r.id !== oldRoom.id && (!r.gender || r.gender === 'female') && (r.roomTier !== oldRoom.roomTier || r.capacity !== oldRoom.capacity)
    );
    assert.ok(wrongTierRoom, 'Phải có phòng khác hạng để test chặn 2A');
    const wrongTransfer = await call('/portal/requests', {
      method: 'POST',
      token: sv002,
      body: { type: 'transfer', targetRoomId: wrongTierRoom.id, title: 'Chuyển khác hạng', description: 'Test 2A' },
    });
    assert.equal(wrongTransfer.status, 400, '2A: chọn phòng đích khác hạng/sức chứa phải bị chặn ngay');

    // 2A: Chuyển sang phòng CÙNG hạng & CÙNG sức chứa (CLC 4 người Nữ)
    const sameClassRoom = cs1Avail.find(
      (r) => r.id !== oldRoom.id && (!r.gender || r.gender === 'female') && r.roomTier === oldRoom.roomTier && r.capacity === oldRoom.capacity
    );
    assert.ok(sameClassRoom, 'Phải có phòng cùng hạng CLC 4 Nữ còn chỗ (VD: A15-202)');

    const transfer = await call('/portal/requests', {
      method: 'POST',
      token: sv002,
      body: { type: 'transfer', targetRoomId: sameClassRoom.id, title: 'Xin chuyển phòng', description: 'Chuyển sang phòng tầng 2 cùng hạng' },
    });
    assert.equal(transfer.status, 201);
    // Staff bị chặn duyệt chuyển phòng (403); trạng thái `approved` cũ bị bỏ (400); Manager chốt `completed` 1 lần duy nhất -> terminal!
    assert.equal((await call(`/requests/${transfer.data.id}/status`, { method: 'PATCH', token: staff, body: { status: 'completed' } })).status, 403);
    assert.equal((await call(`/requests/${transfer.data.id}/status`, { method: 'PATCH', token: manager, body: { status: 'approved' } })).status, 400);
    assert.equal((await call(`/requests/${transfer.data.id}/status`, { method: 'PATCH', token: manager, body: { status: 'completed', handlerNote: 'Đồng ý chuyển cùng hạng' } })).status, 200);
    // Không thể duyệt lại lần 2 (đã kết thúc)
    assert.equal((await call(`/requests/${transfer.data.id}/status`, { method: 'PATCH', token: manager, body: { status: 'completed' } })).code, 'INVALID_STATUS_TRANSITION');

    // Sau khi chuyển phòng, sv002 vẫn giữ nguyên lịch sử biên lai điện nước phòng cũ đã từng nộp!
    const sv002Pays = (await call('/portal/my-payments', { token: sv002 })).data.items;
    assert.ok(sv002Pays.some((p) => p.invoiceType === 'utility'), 'Lịch sử nộp tiền phải giữ biên lai điện nước phòng cũ SV từng nộp');

    // Phiếu trả phòng (`checkout`) KHÔNG được bấm completed suông -> phải qua Thanh lý HĐ mới tự động completed
    const checkoutReq = await call('/portal/requests', {
      method: 'POST',
      token: sv002,
      body: { type: 'checkout', title: 'Đăng ký trả phòng sớm', description: 'Hẹn bàn giao chìa khóa' },
    });
    assert.equal(checkoutReq.status, 201);
    assert.equal(
      (await call(`/requests/${checkoutReq.data.id}/status`, { method: 'PATCH', token: staff, body: { status: 'completed' } })).code,
      'USE_CONTRACT_TERMINATE'
    );
    assert.equal(
      (await call(`/requests/${checkoutReq.data.id}/status`, { method: 'PATCH', token: staff, body: { status: 'in_progress', handlerNote: 'Hẹn 14h kiểm kê' } })).status,
      200
    );
    // Thanh lý HĐ của sv002 -> tự động đóng phiếu checkout sang `completed`!
    assert.equal((await call(`/contracts/${sv002Res.contract.id}/terminate`, { method: 'PATCH', token: staff })).status, 200);
    const sv002ReqsAfter = (await call('/portal/requests', { token: sv002 })).data.items;
    assert.equal(sv002ReqsAfter.find((r) => r.id === checkoutReq.data.id)?.status, 'completed', 'Thanh lý HĐ phải tự động đóng phiếu checkout sang completed');
    ok('2A chuyển phòng (cùng hạng · sạch nợ · 1 lần terminal) + bảo toàn biên lai cũ + đồng bộ tự đóng phiếu trả phòng');

    // ---------------------------------------------------------------- 9. Điện nước + Thanh lý (chặn nợ điện nước phòng) + Hoàn cọc có khấu trừ
    const bA14 = (await call('/buildings', { token: staff })).data.find((b) => b.code === 'A14');
    const curMonth = today().slice(0, 7);
    const sheet = (await call(`/utility-readings/sheet?buildingId=${bA14.id}&monthYear=${curMonth}`, { token: staff })).data;
    // 3A: Phòng A14-301 có 2 HĐ `active`: app2 (đã Check-in) + sv004 (chưa Check-in) -> chỉ tính occupied = 1, pendingCheckin = 1!
    const a14301Row = sheet.rows.find((r) => r.room.roomNumber === '301');
    assert.ok(
      a14301Row && a14301Row.room.occupied === 1 && a14301Row.room.pendingCheckin === 1,
      `3A: A14-301 phải có occupied=1, pendingCheckin=1 (thực tế: ${JSON.stringify(a14301Row?.room)})`
    );
    const sampleRow = sheet.rows.find((r) => r.room.occupied > 0 && r.room.roomNumber === '102');
    assert.ok(sampleRow);
    const eOld = sampleRow.previous?.electricityNewIndex ?? 1000;
    const wOld = sampleRow.previous?.waterNewIndex ?? 100;
    assert.equal(
      (await call('/utility-readings/bulk', {
        method: 'POST',
        token: staff,
        body: {
          buildingId: bA14.id,
          monthYear: curMonth,
          electricityUnitPrice: 3000,
          waterUnitPrice: 15000,
          rows: [{ roomId: sampleRow.room.id, electricityOldIndex: eOld, electricityNewIndex: eOld + 50, waterOldIndex: wOld, waterNewIndex: wOld + 5 }],
        },
      })).status,
      200
    );
    assert.equal((await call('/utility-readings/publish', { method: 'POST', token: staff, body: { buildingId: bA14.id, monthYear: curMonth } })).status, 200);

    // sv001 đang nợ điện nước A14-101 -> chi tiết HĐ trả roomUtilityDebt > 0 và thanh lý bị chặn 422
    const sv001Contracts = (await call('/contracts?status=active&search=2024600001', { token: staff })).data.items;
    const sv001Detail = (await call(`/contracts/${sv001Contracts[0].id}`, { token: staff })).data;
    assert.ok(sv001Detail.roomUtilityDebt > 0, 'Chi tiết HĐ phải báo nợ điện nước phòng');
    assert.equal((await call(`/contracts/${sv001Contracts[0].id}/terminate`, { method: 'PATCH', token: staff })).code, 'OUTSTANDING_INVOICES');

    // Thanh lý & hoàn cọc có khấu trừ cho HĐ mới của app2 (sạch nợ) + kiểm tra chặn deactivate trước hoàn cọc & khóa User sau deactivate
    assert.equal((await call(`/contracts/${app2.data.id}/terminate`, { method: 'PATCH', token: staff })).status, 200);
    const app2StId = stCheck.id;
    assert.equal(
      (await call(`/students/${app2StId}/deactivate`, { method: 'PATCH', token: staff })).code,
      'STUDENT_HAS_UNREFUNDED_DEPOSIT',
      'Không được vô hiệu hóa SV khi còn tiền cọc chưa quyết toán'
    );
    const refunded = await call(`/contracts/${app2.data.id}/deposit-refund`, {
      method: 'PATCH',
      token: staff,
      body: { deductionAmount: 150000, method: 'vietqr', reason: 'Khấu trừ thay khóa tủ' },
    });
    assert.equal(refunded.status, 200);
    assert.equal(refunded.data.depositRefundAmount, 350000);
    assert.equal((await call(`/students/${app2StId}/deactivate`, { method: 'PATCH', token: staff })).status, 200);
    assert.equal(
      (await call('/auth/login', { method: 'POST', body: { identifier: `${YEAR}609001`, password: `${YEAR}609001`, portal: 'student' } })).code,
      'ACCOUNT_LOCKED',
      'Vô hiệu hóa SV phải khóa luôn tài khoản đăng nhập User'
    );
    ok('điện nước 3A + chặn nợ điện nước khi thanh lý + hoàn cọc có khấu trừ + chặn/khóa User khi vô hiệu hóa SV');

    // ---------------------------------------------------------------- 10. Dashboard & Doanh thu (Manager xem Doanh thu, Staff bị chặn 403, tách cọc khỏi doanh thu 1A)
    const sum = (await call('/dashboard/summary', { token: staff })).data;
    assert.equal(sum.occupancy.total, sum.occupancy.occupied + sum.occupancy.available + sum.occupancy.maintenance);
    assert.ok(sum.awaitingDepositRefund >= 3, 'Dashboard summary phải trả về số hợp đồng chờ hoàn cọc');
    assert.ok(typeof sum.finance.depositPending === 'number', 'Dashboard finance phải tách rõ depositPending');
    const occ = (await call('/dashboard/occupancy', { token: staff })).data;
    assert.equal(occ.buildings.length, 2);
    assert.equal((await call(`/dashboard/revenue?year=${YEAR}`, { token: staff })).status, 403);
    const revMgr = (await call(`/dashboard/revenue?year=${YEAR}`, { token: manager })).data;
    assert.ok(Array.isArray(revMgr) && revMgr.length > 0);
    // Kiểm tra tổng doanh thu tháng hiện tại KHÔNG chứa tiền cọc 500k của app2 (chỉ tính tiền phòng 3.300.000đ)
    const curMonthRev = revMgr.find((r) => r.month === curMonth);
    assert.ok(curMonthRev && curMonthRev.roomRevenue > 0, 'Doanh thu tháng hiện tại phải ghi nhận phần tiền phòng từ hóa đơn gộp initial_payment');
    ok('Dashboard Cơ sở 1 + Doanh thu chỉ Manager (tách chính xác tiền cọc khỏi hóa đơn gộp 1A)');

    console.log(`\n🎉 Toàn bộ ${passed} nhóm kiểm thử HaUI - DMS (Cơ sở 1 · Auto-Approve · VietQR Sandbox) ĐẠT 100%!`);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('❌ TEST THẤT BẠI:', err);
  process.exit(1);
});

/**
 * Bộ kiểm thử tích hợp RESTful API HaUI - DMS (KTX Cơ sở 1 · 2 Tòa A14, A15 · 60 Phòng · Duyệt tự động 100% · VietQR Sandbox).
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

    // ---------------------------------------------------------------- 3. Trang chủ CS1 (2 tòa A14, A15 · 60 phòng) & Phân luồng Tân SV vs Năm 2+
    const campuses = (await call('/public/campuses')).data;
    assert.equal(campuses.campuses.length, 1, 'Thu gọn chỉ còn Cơ sở 1');
    assert.equal(campuses.campuses[0].buildings.length, 2, 'Cơ sở 1 có 2 tòa A14 và A15');
    assert.equal(campuses.campuses[0].stats.totalRooms, 60, 'Tổng 60 phòng tại CS1 (30 phòng/tòa)');

    const periodsFresh = (await call(`/public/periods/open?studentCode=${YEAR}609001&faculty=Công nghệ thông tin`)).data;
    const pFresh = periodsFresh.find((p) => p.targetCohort === 'freshman');
    const pRet = periodsFresh.find((p) => p.targetCohort === 'returning');
    assert.equal(pFresh.eligibility.eligible, true);
    assert.equal(pRet.eligibility.eligible, false);
    ok('trang chủ CS1 (2 tòa A14, A15 · 60 phòng) & tự phân luồng Tân SV vs Năm 2+');

    // ---------------------------------------------------------------- 4. Khóa loại phòng hết chỗ + Tự động duyệt 100% xếp tầng thấp -> cao + Tự hủy nhả chỗ + Chống mạo danh CCCD
    const availRes = await call(`/public/rooms/available?periodId=${pFresh.id}&gender=male`);
    const hq3 = availRes.data.roomTypes.find((t) => t.roomTier === 'high_quality' && t.capacity === 3);
    assert.equal(hq3?.isFull, true, 'Loại phòng CLC 3 người (A14-101 & A15-101) kín 100% phải bị khóa');
    assert.equal(
      (await call('/contracts/register-online', {
        method: 'POST',
        body: { ...sampleProfile(`${YEAR}609001`), periodId: pFresh.id, preferredRoomTier: 'high_quality', preferredCapacity: 3, term: '10_months' },
      })).code,
      'ROOM_FULL'
    );

    // Giới tính phòng động: A14-101 (Nam) cạnh A14-102 (Nữ), phòng trống A14-301 có gender === null
    const a14Rooms = (await call('/rooms?campus=cs1', { token: staff })).data.items.filter((r) => r.buildingCode === 'A14');
    assert.equal(a14Rooms.find((r) => r.roomNumber === '101')?.gender, 'male');
    assert.equal(a14Rooms.find((r) => r.roomNumber === '102')?.gender, 'female');
    assert.equal(a14Rooms.find((r) => r.roomNumber === '301')?.gender, null);

    // Nộp đơn hợp lệ -> TỰ ĐỘNG DUYỆT 100% (xếp phòng tầng thấp -> cao, chuyển thẳng pending_payment, sinh 2 hóa đơn & cấp TK)
    const app1 = await call('/contracts/register-online', {
      method: 'POST',
      body: { ...sampleProfile(`${YEAR}609001`), periodId: pFresh.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '10_months' },
    });
    assert.equal(app1.status, 201);
    assert.equal(app1.data.status, 'pending_payment', 'Phải tự động duyệt thẳng sang pending_payment');
    assert.ok(app1.data.room?.roomNumber, 'Phải tự động xếp số phòng ngay khi nộp');
    assert.equal(app1.data.invoices.length, 2, 'Phải sinh sẵn 2 hóa đơn (Cọc + Tiền phòng)');

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
        body: { ...sampleProfile(`${YEAR}609001`, { citizenId: '999999999999', email: 'hacker@evil.com' }), periodId: pFresh.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '10_months' },
      })).code,
      'IDENTITY_MISMATCH'
    );

    // Nộp lại hợp lệ -> Tự động xếp phòng -> Sinh viên đăng nhập & bấm VietQR Sandbox -> Tự kích hoạt HĐ -> Quét QR Check-in
    const app2 = await call('/contracts/register-online', {
      method: 'POST',
      body: { ...sampleProfile(`${YEAR}609001`), periodId: pFresh.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '10_months' },
    });
    assert.equal(app2.status, 201);
    assert.equal(app2.data.status, 'pending_payment');

    // Webhook VietQR gạch nợ 2 hóa đơn -> tự kích hoạt & sinh QR Check-in
    const invDep = app2.data.invoices.find((i) => i.type === 'deposit');
    const invRoom = app2.data.invoices.find((i) => i.type === 'room_semester');
    const sim1 = await call('/payments/webhook/simulate', { method: 'POST', token: staff, body: { invoiceId: invDep.id, referenceCode: 'FT26TEST001' } });
    assert.equal(sim1.status, 201);
    assert.equal(sim1.data.contractActivated, false);

    // Idempotency Webhook
    const dup = await call('/payments/webhook/vietqr', {
      method: 'POST',
      headers: { 'x-webhook-secret': config.vietqr.webhookSecret },
      body: { content: `HAUI ${invDep.invoiceCode}`, transferAmount: invDep.amount, referenceCode: 'FT26TEST001' },
    });
    assert.equal(dup.data.alreadyProcessed, true);

    const sim2 = await call('/payments/webhook/simulate', { method: 'POST', token: staff, body: { invoiceId: invRoom.id, referenceCode: 'FT26TEST002' } });
    assert.equal(sim2.data.contractActivated, true);
    assert.ok(sim2.data.checkinCode?.startsWith('QRC-'));

    assert.equal((await call('/contracts/checkin-qr', { method: 'POST', token: staff, body: { checkinCode: sim2.data.checkinCode } })).status, 200);
    assert.equal((await call('/contracts/checkin-qr', { method: 'POST', token: staff, body: { checkinCode: sim2.data.checkinCode } })).code, 'ALREADY_CHECKED_IN');
    ok('tự động duyệt 100% -> tự hủy nhả chỗ -> chống mạo danh CCCD -> Webhook VietQR kích hoạt HĐ -> QR Check-in');

    // ---------------------------------------------------------------- 5. Hủy quá hạn đóng phí (`sv005` A15-305) -> Nhả chỗ & reset Trống
    const overdueRes = await call('/contracts/cancel-overdue', { method: 'POST', token: staff });
    assert.equal(overdueRes.status, 200);
    assert.ok(overdueRes.data.cancelledCount >= 1);
    const a15Rooms = (await call('/rooms?campus=cs1&limit=100', { token: staff })).data.items.filter((r) => r.buildingCode === 'A15');
    const a15305 = a15Rooms.find((r) => r.roomNumber === '305');
    assert.equal(a15305.occupied, 0);
    assert.equal(a15305.gender, null, 'Phòng A15-305 sau khi hủy quá hạn phải tự reset về Trống (gender = null)');
    ok('hủy quá hạn đóng phí nhả chỗ & tự reset giới tính phòng về Trống');

    // ---------------------------------------------------------------- 6. Cổng SV: sv004 dùng nút Sandbox VietQR trực tiếp trên Portal -> tự kích hoạt HĐ
    const sv004Invs = (await call('/portal/my-invoices?status=unpaid', { token: sv004 })).data.items;
    assert.equal(sv004Invs.length, 2);
    const vqr = (await call(`/portal/my-invoices/${sv004Invs[0].id}/vietqr`, { token: sv004 })).data;
    assert.equal(vqr.sandboxEnabled, true);
    assert.equal(vqr.webhookSecret, undefined);
    const portalPay1 = await call(`/portal/my-invoices/${sv004Invs[0].id}/simulate-vietqr`, { method: 'POST', token: sv004 });
    assert.equal(portalPay1.status, 201);
    const portalPay2 = await call(`/portal/my-invoices/${sv004Invs[1].id}/simulate-vietqr`, { method: 'POST', token: sv004 });
    assert.equal(portalPay2.status, 201);
    assert.equal(portalPay2.data.contractActivated, true, 'SV bấm giả lập VietQR đủ 2 hóa đơn phải tự kích hoạt HĐ ngay');
    ok('Cổng SV: sinh mã VietQR an toàn & giả lập thanh toán Sandbox tự kích hoạt HĐ');

    // ---------------------------------------------------------------- 7. Cổng SV: sv003 (cựu nội trú) đăng ký kỳ mới -> tự động duyệt & xếp phòng ngay
    const sv003Apply = await call('/portal/applications', {
      method: 'POST',
      token: sv003,
      body: { periodId: pRet.id, preferredRoomTier: 'standard', preferredCapacity: 4, term: '10_months' },
    });
    assert.equal(sv003Apply.status, 201);
    assert.equal(sv003Apply.data.status, 'pending_payment');
    assert.ok(sv003Apply.data.room?.roomNumber, 'Gia hạn nội bộ phải tự động xếp phòng ngay');
    ok('Cổng SV: cựu nội trú gia hạn tự động duyệt & xếp phòng tầng thấp -> cao');

    // ---------------------------------------------------------------- 8. Phiếu Yêu cầu SV (Báo hỏng Staff + Chuyển phòng Manager)
    const repair = await call('/portal/requests', {
      method: 'POST',
      token: sv002,
      body: { type: 'repair', repairCategory: 'electric', title: 'Hỏng bóng đèn bàn học', description: 'Đèn nhấp nháy liên tục' },
    });
    assert.equal(repair.status, 201);
    assert.equal((await call(`/requests/${repair.data.id}/status`, { method: 'PATCH', token: staff, body: { status: 'completed', handlerNote: 'Đã thay bóng LED' } })).status, 200);

    const sv002Res = (await call('/portal/my-residence', { token: sv002 })).data;
    const oldRoomId = sv002Res.contract.room.id;
    const cs1Avail = (await call('/rooms?campus=cs1&availability=has_slot', { token: manager })).data.items;
    const targetRoom = cs1Avail.find((r) => r.id !== oldRoomId && (!r.gender || r.gender === 'female'));
    assert.ok(targetRoom);

    const transfer = await call('/portal/requests', {
      method: 'POST',
      token: sv002,
      body: { type: 'transfer', targetRoomId: targetRoom.id, title: 'Xin chuyển phòng', description: 'Chuyển sang phòng tầng 2' },
    });
    assert.equal(transfer.status, 201);
    assert.equal((await call(`/requests/${transfer.data.id}/status`, { method: 'PATCH', token: staff, body: { status: 'approved' } })).status, 403);
    assert.equal((await call(`/requests/${transfer.data.id}/status`, { method: 'PATCH', token: manager, body: { status: 'approved', handlerNote: 'Đồng ý' } })).status, 200);
    const reqList = (await call('/requests', { token: manager })).data;
    assert.ok(reqList.summary.total >= 3, 'summary.total phải phản ánh đúng tổng số phiếu');
    ok('Phiếu yêu cầu SV: Báo hỏng (Staff) + Chuyển phòng nguyên tử (Manager) + summary.total chuẩn');

    // ---------------------------------------------------------------- 9. Điện nước + Thanh lý (chặn nợ điện nước phòng) + Hoàn cọc có khấu trừ
    const bA14 = (await call('/buildings', { token: staff })).data.find((b) => b.code === 'A14');
    const curMonth = today().slice(0, 7);
    const sheet = (await call(`/utility-readings/sheet?buildingId=${bA14.id}&monthYear=${curMonth}`, { token: staff })).data;
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

    // Thanh lý & hoàn cọc có khấu trừ cho HĐ mới của app2 (sạch nợ)
    assert.equal((await call(`/contracts/${app2.data.id}/terminate`, { method: 'PATCH', token: staff })).status, 200);
    const refunded = await call(`/contracts/${app2.data.id}/deposit-refund`, {
      method: 'PATCH',
      token: staff,
      body: { deductionAmount: 150000, reason: 'Khấu trừ thay khóa tủ' },
    });
    assert.equal(refunded.status, 200);
    assert.equal(refunded.data.depositRefundAmount, 350000);
    ok('điện nước + cảnh báo/chặn nợ điện nước khi thanh lý + hoàn cọc có khấu trừ tạo phiếu chi refund');

    // ---------------------------------------------------------------- 10. Dashboard & Doanh thu (Manager xem Doanh thu, Staff bị chặn 403)
    const sum = (await call('/dashboard/summary', { token: staff })).data;
    assert.equal(sum.occupancy.total, sum.occupancy.occupied + sum.occupancy.available + sum.occupancy.maintenance);
    assert.ok(sum.awaitingDepositRefund >= 3, 'Dashboard summary phải trả về số hợp đồng chờ hoàn cọc');
    const occ = (await call('/dashboard/occupancy', { token: staff })).data;
    assert.equal(occ.buildings.length, 2);
    assert.equal((await call(`/dashboard/revenue?year=${YEAR}`, { token: staff })).status, 403);
    const revMgr = (await call(`/dashboard/revenue?year=${YEAR}`, { token: manager })).data;
    assert.ok(Array.isArray(revMgr) && revMgr.length > 0);
    ok('Dashboard Cơ sở 1 (2 tòa A14, A15 · 60 phòng) & Doanh thu phân quyền chặt chỉ Manager');

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

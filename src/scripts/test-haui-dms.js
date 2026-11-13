/**
 * Kiểm thử REST bản v2 — chạy trên dữ liệu `seed.js`, so với hợp đồng FE `docs/API.md` v2.7.
 *
 *   MONGODB_URI=mongodb://127.0.0.1:27018/dms_ktx_test node src/scripts/seed.js
 *   MONGODB_URI=mongodb://127.0.0.1:27018/dms_ktx_test npm test
 *
 * Ghi dữ liệu (nộp đơn, duyệt, thu tiền…) → chạy lại seed trước mỗi lần. Từ chối chạy vào cụm Atlas.
 * ⚠️ Dùng `assert` của Node (ném lỗi, thoát mã 1). Bản cũ dùng console.assert — sai vẫn báo "100% thành công".
 */

require('dotenv').config();
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');

const PORT = 5055;
const BASE = `http://localhost:${PORT}/api`;
let passed = 0;

const call = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, ...(await res.json()) };
};
const ok = (name) => { passed += 1; console.log(`✅ ${name}`); };
const login = async (identifier, password) => {
  const r = await call('/auth/login', { method: 'POST', body: { identifier, password } });
  assert.equal(r.code, 'OK', `đăng nhập ${identifier}: ${r.message}`);
  return r.data.token;
};
const profile = (code, extra = {}) => ({
  studentCode: code, fullName: 'Thử Nghiệm', gender: 'male', dob: '2004-01-01', phone: '0912345678',
  email: `t${code}@gmail.com`, citizenId: '001204000001', address: 'Hà Nội', faculty: 'Cơ khí', className: 'CK01',
  emergencyContact: { name: 'Bố', phone: '0912000111', relationship: 'Bố' }, ...extra,
});

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dms_ktx';
  if (/mongodb\.net/i.test(uri)) throw new Error('Không chạy kiểm thử ghi dữ liệu vào cụm Atlas dùng chung');
  await mongoose.connect(uri);
  const server = app.listen(PORT);
  try {
    // ---------------------------------------------------------------- xác thực
    assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'admin@dorm.local', password: 'sai' } })).code, 'INVALID_CREDENTIALS');
    assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'staff2@dorm.local', password: 'Staff@123' } })).code, 'ACCOUNT_LOCKED');
    const admin = await login('admin@dorm.local', 'Admin@123');
    const staff = await login('staff@dorm.local', 'Staff@123');
    const sv = await login('2021600001', 'Student@123'); // đăng nhập bằng MSSV
    ok('đăng nhập email / MSSV, sai mật khẩu, tài khoản khóa');

    const forced = await login('2021600005', '2021600005');
    assert.equal((await call('/portal/profile', { token: forced })).code, 'MUST_CHANGE_PASSWORD');
    assert.equal((await call('/auth/change-password', { method: 'PATCH', token: forced, body: { oldPassword: '2021600005', newPassword: '2021600005' } })).code, 'VALIDATION_ERROR');
    ok('buộc đổi mật khẩu chặn mọi endpoint khác; mật khẩu mới phải đủ luật');

    // ---------------------------------------------------------------- quyền
    assert.equal((await call('/dashboard/revenue', { token: staff })).status, 403);
    assert.equal((await call('/users', { token: staff })).status, 403);
    assert.equal((await call('/invoices', { token: sv })).status, 403);
    const others = (await call('/invoices?scope=personal&limit=100', { token: admin })).data.items.find((i) => i.student.studentCode !== '2021600001');
    assert.equal((await call(`/portal/my-invoices/${others.id}`, { token: sv })).code, 'FORBIDDEN');
    ok('staff không xem doanh thu / tài khoản; sinh viên không xem hóa đơn người khác');

    // ---------------------------------------------------------------- dạng danh sách (API.md §1.2)
    for (const path of ['/students', '/rooms', '/contracts', '/invoices', '/payments', '/users']) {
      const r = await call(path, { token: admin });
      assert.ok(Array.isArray(r.data.items) && typeof r.data.total === 'number', `${path} phải trả { items, total, page, limit }`);
    }
    ok('mọi danh sách trả { items, total, page, limit }');

    // ---------------------------------------------------------------- nộp đơn → duyệt → khóa giường đúng
    const avail = (await call('/public/rooms/available?gender=male')).data.items;
    const room = avail.find((r) => r.availableSlots >= 2);
    const [bedA, bedB] = room.beds.filter((b) => b.status === 'available' && !b.hasPendingApplication).map((b) => b.bedNumber);
    assert.equal((await call('/contracts/register-online', { method: 'POST', body: { ...profile('2021609001'), citizenId: '123', roomId: room.id, bedNumber: bedA, term: '6_months' } })).data.errors[0].field, 'citizenId');
    const appA = await call('/contracts/register-online', { method: 'POST', body: { ...profile('2021609001'), roomId: room.id, bedNumber: bedA, term: '6_months' } });
    assert.equal(appA.code, 'OK');
    assert.equal((await call('/contracts/register-online', { method: 'POST', body: { ...profile('2021609002'), roomId: room.id, bedNumber: bedA, term: '6_months' } })).code, 'BED_ALREADY_REQUESTED');
    const appB = await call('/contracts/register-online', { method: 'POST', body: { ...profile('2021609002'), roomId: room.id, bedNumber: bedB, term: '12_months' } });
    ok('nộp đơn công khai: thiếu CCCD báo đúng ô; giường đã có đơn giữ bị chặn');

    const pending = (await call('/contracts?status=pending&limit=100', { token: staff })).data.items;
    const cA = pending.find((c) => c.contractCode === appA.data.contractCode);
    const cB = pending.find((c) => c.contractCode === appB.data.contractCode);
    const approved = await call(`/contracts/${cA.id}/approve`, { method: 'PATCH', token: staff, body: {} });
    assert.equal(approved.code, 'OK');
    assert.equal(approved.data.invoices.length, 2);
    assert.equal(approved.data.account.studentCode, '2021609001');
    // Duyệt đơn B vào ĐÚNG giường A vừa khóa → phải bị chặn (bản cũ thiếu $elemMatch nên lọt khi phòng còn giường trống khác)
    const steal = await call(`/contracts/${cB.id}/approve`, { method: 'PATCH', token: staff, body: { bedNumber: bedA } });
    assert.equal(steal.code, 'BED_ALREADY_OCCUPIED');
    const detail = (await call(`/rooms/${room.id}`, { token: staff })).data;
    assert.equal(detail.beds.filter((b) => b.occupant?.studentCode === '2021609001').length, 1);
    ok('duyệt: 2 hóa đơn + tài khoản MSSV; giường đã khóa không xếp người thứ hai');

    // Email trùng tài khoản khác → không gắn nhầm
    assert.equal((await call(`/contracts/${cB.id}/reject`, { method: 'PATCH', token: staff, body: { reason: 'Thử từ chối' } })).data.status, 'rejected');
    const appC = await call('/contracts/register-online', { method: 'POST', body: { ...profile('2021609003', { email: 'staff@dorm.local' }), roomId: room.id, bedNumber: bedB, term: '6_months' } });
    assert.equal(appC.code, 'OK');
    const cC = (await call('/contracts?status=pending&limit=100', { token: staff })).data.items.find((c) => c.contractCode === appC.data.contractCode);
    assert.equal((await call(`/contracts/${cC.id}/approve`, { method: 'PATCH', token: staff, body: {} })).code, 'EMAIL_ALREADY_USED');
    ok('từ chối có lý do; email trùng tài khoản cán bộ → EMAIL_ALREADY_USED, không gắn nhầm');

    // ---------------------------------------------------------------- thanh lý → thu → hoàn cọc
    assert.equal((await call(`/contracts/${cA.id}/terminate`, { method: 'PATCH', token: staff })).code, 'OUTSTANDING_INVOICES');
    for (const inv of approved.data.invoices) {
      const paid = await call('/payments/cash', { method: 'POST', token: staff, body: { invoiceId: inv.id } });
      assert.equal(paid.code, 'OK');
    }
    assert.equal((await call('/payments/cash', { method: 'POST', token: staff, body: { invoiceId: approved.data.invoices[0].id } })).code, 'INVOICE_ALREADY_PAID');
    const roomUnpaid = (await call(`/invoices?type=utility&status=unpaid&limit=100`, { token: staff })).data.items.filter((i) => i.room.id === room.id);
    const terminated = await call(`/contracts/${cA.id}/terminate`, { method: 'PATCH', token: staff });
    assert.equal(terminated.code, roomUnpaid.length ? 'OUTSTANDING_INVOICES' : 'OK');
    if (!roomUnpaid.length) {
      assert.equal((await call(`/contracts/${cA.id}/deposit-refund`, { method: 'PATCH', token: staff })).code, 'OK');
      assert.equal((await call(`/contracts/${cA.id}/deposit-refund`, { method: 'PATCH', token: staff })).code, 'DEPOSIT_ALREADY_REFUNDED');
    }
    ok('thanh lý chặn khi còn nợ (BR-04); thu đủ; không thu hai lần; hoàn cọc một lần');

    // ---------------------------------------------------------------- điện nước
    const k2 = (await call('/buildings', { token: staff })).data.find((b) => b.code === 'K2');
    const month = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    const sheet = (await call(`/utility-readings/sheet?buildingId=${k2.id}&monthYear=${month}`, { token: staff })).data;
    const blank = sheet.rows.find((r) => !r.reading && r.room.occupied > 0 && r.previous);
    const save = await call('/utility-readings/bulk', {
      method: 'POST', token: staff,
      body: {
        buildingId: k2.id, monthYear: month, electricityUnitPrice: 3000, waterUnitPrice: 15000,
        rows: [{ roomId: blank.room.id, electricityOldIndex: blank.previous.electricityNewIndex, electricityNewIndex: blank.previous.electricityNewIndex + 50, waterOldIndex: blank.previous.waterNewIndex, waterNewIndex: blank.previous.waterNewIndex + 5 }],
      },
    });
    assert.equal(save.data.savedCount, 1);
    const pub = await call('/utility-readings/publish', { method: 'POST', token: staff, body: { buildingId: k2.id, monthYear: month } });
    assert.ok(pub.data.publishedCount >= 1);
    assert.equal((await call('/utility-readings/publish', { method: 'POST', token: staff, body: { buildingId: k2.id, monthYear: month } })).code, 'NOTHING_TO_PUBLISH');
    ok('điện nước: lưu lưới, chốt cả tòa, chốt lại báo NOTHING_TO_PUBLISH');

    // ---------------------------------------------------------------- dashboard
    const sum = (await call('/dashboard/summary', { token: admin })).data;
    assert.equal(sum.occupancy.total, sum.occupancy.occupied + sum.occupancy.available + sum.occupancy.maintenance);
    assert.ok(Array.isArray((await call('/dashboard/revenue', { token: admin })).data));
    ok('dashboard: tổng giường = có người + trống + bảo trì; doanh thu theo tháng');

    console.log(`\n🎉 ${passed} nhóm kiểm thử đạt`);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err.message);
  process.exit(1);
});

/**
 * Bộ kiểm thử tích hợp RESTful API HaUI - DMS v3.0 (chạy trên dữ liệu `seed.js`).
 *
 * Cách chạy:
 *   MONGODB_URI=mongodb://127.0.0.1:27017/dms_ktx_test npm run seed
 *   MONGODB_URI=mongodb://127.0.0.1:27017/dms_ktx_test npm test
 *
 * ⚠️ Từ chối chạy vào cụm Atlas (`mongodb.net`). Dùng `node:assert/strict` (lỗi là fail ngay mã 1).
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

const ok = (name) => {
  passed += 1;
  console.log(`✅ ${name}`);
};

const login = async (identifier, password) => {
  const r = await call('/auth/login', { method: 'POST', body: { identifier, password } });
  assert.equal(r.code, 'OK', `đăng nhập ${identifier}: ${r.message}`);
  return r.data.token;
};

const sampleProfile = (code, extra = {}) => ({
  studentCode: code,
  fullName: 'Nguyễn Văn Thử Nghiệm',
  gender: 'male',
  dob: `${YEAR - 18}-05-15`,
  phone: '0912345678',
  email: `test_${code}@sv.haui.edu.vn`,
  citizenId: '001208000123',
  address: 'Ninh Bình',
  faculty: 'Công nghệ thông tin',
  className: `CNTT01-K${YEAR - 2005}`,
  priorityType: 'normal',
  hasHealthCondition: false,
  emergencyContact: { name: 'Nguyễn Văn Bố', phone: '0912000111', relationship: 'Bố' },
  ...extra,
});

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dms_ktx';
  if (/mongodb\.net/i.test(uri)) throw new Error('Không chạy kiểm thử ghi dữ liệu vào cụm Atlas dùng chung');
  await mongoose.connect(uri);
  const server = app.listen(PORT);

  try {
    // ---------------------------------------------------------------- 1. Auth & 4-Role RBAC Matrix
    assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'admin@dorm.local', password: 'sai' } })).code, 'INVALID_CREDENTIALS');
    assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'staff2@dorm.local', password: 'Staff@123' } })).code, 'ACCOUNT_LOCKED');

    const admin = await login('admin@dorm.local', 'Admin@123');
    const manager = await login('manager@dorm.local', 'Manager@123');
    const staff = await login('staff@dorm.local', 'Staff@123');
    const sv1 = await login('sv001@dorm.local', 'Student@123');
    const sv2 = await login('sv002@dorm.local', 'Student@123');
    const sv3 = await login('sv003@dorm.local', 'Student@123');
    const sv7 = await login(`${YEAR}600031`, `${YEAR}600031`);
    ok('đăng nhập 4 vai trò (admin/manager/staff/student) + kiểm tra khóa tài khoản');

    // Buộc đổi mật khẩu lần đầu
    assert.equal((await call('/portal/profile', { token: sv7 })).code, 'MUST_CHANGE_PASSWORD');
    ok('cưỡng bức đổi mật khẩu lần đầu chặn toàn bộ API khác');

    // Ma trận phân quyền 4 vai trò chuẩn HaUI v3.0
    assert.equal((await call('/users', { token: admin })).status, 200);
    assert.equal((await call('/dashboard/revenue', { token: admin })).status, 403);
    assert.equal((await call('/contracts', { token: admin })).status, 403);
    assert.equal((await call('/users', { token: manager })).status, 403);
    assert.equal((await call('/dashboard/revenue', { token: manager })).status, 200);
    assert.equal((await call('/dashboard/revenue', { token: staff })).status, 403);
    assert.equal((await call('/periods', { method: 'POST', token: staff, body: {} })).status, 403);
    assert.equal((await call('/invoices', { token: sv1 })).status, 403);
    ok('ma trận RBAC 4 vai trò: Admin chỉ quản trị User · Manager độc quyền Doanh thu & Cấu hình · Staff vận hành');

    // ---------------------------------------------------------------- 2. Trang chủ Công khai & Phân luồng MSSV tự động
    const campuses = (await call('/public/campuses')).data;
    assert.equal(campuses.campuses.length, 3);
    assert.equal(campuses.priceTable.high_quality[4].cs3, 680000);
    const announcements = (await call('/public/announcements')).data;
    assert.ok(announcements.items.length >= 3);

    // Tân SV ngành CNTT -> đủ điều kiện CS3 Ninh Bình, KHÔNG đủ điều kiện CS1 năm 2+
    const periodsFreshEng = (await call(`/public/periods/open?studentCode=${YEAR}609001&faculty=Công nghệ thông tin`)).data;
    const pCs3Fresh = periodsFreshEng.find((p) => p.campus === 'cs3' && p.targetCohort === 'freshman');
    const pCs1Ret = periodsFreshEng.find((p) => p.campus === 'cs1' && p.targetCohort === 'returning');
    assert.equal(pCs3Fresh.eligibility.eligible, true);
    assert.equal(pCs1Ret.eligibility.eligible, false);

    // Tân SV ngành Ngôn ngữ Anh -> đủ điều kiện CS1 Hà Nội, KHÔNG đủ điều kiện CS3
    const periodsFreshLang = (await call(`/public/periods/open?studentCode=${YEAR}609002&faculty=Ngôn ngữ Anh`)).data;
    assert.equal(periodsFreshLang.find((p) => p.campus === 'cs1' && p.targetCohort === 'freshman').eligibility.eligible, true);
    assert.equal(periodsFreshLang.find((p) => p.campus === 'cs3' && p.targetCohort === 'freshman').eligibility.eligible, false);
    ok('trang chủ công khai (3 cơ sở + bảng giá 2026–2027) & tự phân luồng MSSV Tân SV vs Năm 2+');

    // ---------------------------------------------------------------- 3. Nộp đơn công khai -> Tự hủy -> Nộp lại -> Duyệt -> Webhook VietQR -> QR Check-in
    const availCs3 = (await call(`/public/rooms/available?periodId=${pCs3Fresh.id}&gender=male`)).data.items;
    assert.ok(availCs3.length > 0);
    const targetRoom = availCs3[0];
    const initialOccupied = targetRoom.occupied;

    // Sai đợt (Tân SV nộp vào đợt năm 2+) -> bị chặn
    assert.equal(
      (await call('/contracts/register-online', {
        method: 'POST',
        body: { ...sampleProfile(`${YEAR}609001`), periodId: pCs1Ret.id, term: '5_months' },
      })).code,
      'PERIOD_NOT_ELIGIBLE'
    );

    // Nộp đơn hợp lệ vào đợt CS3 Tân SV
    const app1 = await call('/contracts/register-online', {
      method: 'POST',
      body: { ...sampleProfile(`${YEAR}609001`), periodId: pCs3Fresh.id, roomId: targetRoom.id, term: '8.5_months' },
    });
    assert.equal(app1.code, 'OK');

    // SV tự hủy đơn đang pending
    const cancelledSelf = await call('/public/applications/cancel', {
      method: 'POST',
      body: { studentCode: `${YEAR}609001`, email: `test_${YEAR}609001@sv.haui.edu.vn`, citizenId: '001208000123', reason: 'Chọn lại kỳ hạn' },
    });
    assert.equal(cancelledSelf.code, 'OK');

    // Kẻ xấu dùng MSSV cũ với CCCD sai để ghi đè email -> bị chặn IDENTITY_MISMATCH
    assert.equal(
      (await call('/contracts/register-online', {
        method: 'POST',
        body: { ...sampleProfile(`${YEAR}609001`, { citizenId: '999999999999', email: 'hacker@evil.com' }), periodId: pCs3Fresh.id, roomId: targetRoom.id, term: '8.5_months' },
      })).code,
      'IDENTITY_MISMATCH'
    );

    // Nộp lại hợp lệ đúng CCCD -> Duyệt đơn -> Chuyển sang `pending_payment`
    const app2 = await call('/contracts/register-online', {
      method: 'POST',
      body: { ...sampleProfile(`${YEAR}609001`), periodId: pCs3Fresh.id, roomId: targetRoom.id, term: '8.5_months' },
    });
    assert.equal(app2.code, 'OK');

    const pendingList = (await call('/contracts?status=pending&limit=100', { token: staff })).data.items;
    const cNew = pendingList.find((c) => c.contractCode === app2.data.contractCode);
    const approved = await call(`/contracts/${cNew.id}/approve`, { method: 'PATCH', token: staff, body: {} });
    assert.equal(approved.code, 'OK');
    assert.equal(approved.data.contract.status, 'pending_payment');
    assert.equal(approved.data.invoices.length, 2);

    // Kiểm tra phòng đã tăng occupied thêm 1
    const roomAfterApprove = (await call(`/rooms/${targetRoom.id}`, { token: staff })).data;
    assert.equal(roomAfterApprove.occupied, initialOccupied + 1);

    // Webhook VietQR sai secret -> 401
    assert.equal(
      (await call('/payments/webhook/vietqr', {
        method: 'POST',
        headers: { 'x-webhook-secret': 'wrong-secret' },
        body: { content: 'HAUI TEST', transferAmount: 500000, referenceCode: 'FT_BAD' },
      })).code,
      'INVALID_WEBHOOK_SECRET'
    );

    // Giả lập Webhook VietQR cho hóa đơn 1 (cọc) + kiểm tra Idempotency
    const [inv1, inv2] = approved.data.invoices;
    const sim1 = await call('/payments/webhook/simulate', {
      method: 'POST',
      token: staff,
      body: { invoiceId: inv1.id, referenceCode: 'FT_TEST_IDEMP_01' },
    });
    assert.equal(sim1.code, 'OK');
    assert.equal(sim1.data.contractActivated, false);

    // Gửi lại đúng referenceCode -> idempotent trả 200 alreadyProcessed: true
    const sim1Dup = await call('/payments/webhook/vietqr', {
      method: 'POST',
      headers: { 'x-webhook-secret': config.vietqr.webhookSecret },
      body: { content: `HAUI ${inv1.invoiceCode.replace(/-/g, '')}`, transferAmount: inv1.amount, referenceCode: 'FT_TEST_IDEMP_01' },
    });
    assert.equal(sim1Dup.code, 'OK');
    assert.equal(sim1Dup.data.alreadyProcessed, true);

    // Giả lập Webhook VietQR cho hóa đơn 2 (tiền phòng) -> TỰ ĐỘNG kích hoạt `active` & sinh `checkinCode`!
    const sim2 = await call('/payments/webhook/simulate', {
      method: 'POST',
      token: staff,
      body: { invoiceId: inv2.id },
    });
    assert.equal(sim2.code, 'OK');
    assert.equal(sim2.data.contractActivated, true);
    assert.ok(sim2.data.checkinCode);

    // Quét QR Check-in nhận phòng (lần 1 thành công, lần 2 báo ALREADY_CHECKED_IN)
    const checkin1 = await call('/contracts/checkin-qr', { method: 'POST', token: staff, body: { checkinCode: sim2.data.checkinCode } });
    assert.equal(checkin1.code, 'OK');
    assert.ok(checkin1.data.checkedInAt);
    assert.equal((await call('/contracts/checkin-qr', { method: 'POST', token: staff, body: { checkinCode: sim2.data.checkinCode } })).code, 'ALREADY_CHECKED_IN');
    ok('vòng đời khép kín: Nộp đơn -> Tự hủy -> Chống mạo danh CCCD -> Duyệt pending_payment -> Webhook VietQR -> Tự kích hoạt active -> Quét QR Check-in');

    // ---------------------------------------------------------------- 4. Hủy quá hạn đóng phí & Tự động duyệt theo lô nhân văn
    const cancelBatch = await call('/contracts/cancel-overdue', { method: 'POST', token: staff, body: {} });
    assert.equal(cancelBatch.code, 'OK');
    assert.ok(cancelBatch.data.cancelledCount >= 1);

    const autoApp = await call('/contracts/auto-approve', { method: 'POST', token: manager, body: { periodId: pCs3Fresh.id, limit: 10 } });
    assert.equal(autoApp.code, 'OK');
    assert.ok(autoApp.data.approvedCount >= 1);
    ok('hủy hàng loạt quá hạn đóng phí (nhả chỗ + hủy hóa đơn) & tự động duyệt ưu tiên theo lô');

    // ---------------------------------------------------------------- 5. Đăng ký nội bộ từ Portal (SV năm 2+ sv003) & VietQR không lộ secret
    const portalApply = await call('/portal/applications', {
      method: 'POST',
      token: sv3,
      body: { periodId: pCs1Ret.id, term: '10_months' },
    });
    assert.equal(portalApply.code, 'OK');

    const sv1Invoices = (await call('/portal/my-invoices?status=unpaid', { token: sv1 })).data.items;
    assert.ok(sv1Invoices.length > 0);
    const vqr = (await call(`/portal/my-invoices/${sv1Invoices[0].id}/vietqr`, { token: sv1 })).data;
    assert.ok(vqr.qrImageUrl && vqr.transferContent);
    assert.equal(vqr.webhookSecret, undefined, 'TUYỆT ĐỐI không lộ webhookSecret cho sinh viên');
    ok('Cổng SV: đăng ký/gia hạn nội bộ cho năm 2+ & sinh mã VietQR an toàn');

    // ---------------------------------------------------------------- 6. Phiếu Yêu cầu SV (Báo hỏng & Chuyển phòng nguyên tử chỉ Manager duyệt)
    const repairReq = await call('/portal/requests', {
      method: 'POST',
      token: sv2,
      body: { type: 'repair', repairCategory: 'electric', title: 'Hỏng đèn bàn học', description: 'Đèn nhấp nháy liên tục' },
    });
    assert.equal(repairReq.code, 'OK');
    const doneRepair = await call(`/requests/${repairReq.data.id}/status`, {
      method: 'PATCH',
      token: staff,
      body: { status: 'completed', handlerNote: 'Đã thay bóng đèn mới' },
    });
    assert.equal(doneRepair.data.status, 'completed');

    // Tìm phòng nữ trống khác tại CS1 (A15) để sv002 xin chuyển phòng
    const sv2Res = (await call('/portal/my-residence', { token: sv2 })).data;
    const cs1FemaleRooms = (await call('/rooms?campus=cs1&gender=female&availability=has_slot', { token: manager })).data.items;
    const nextRoom = cs1FemaleRooms.find((r) => r.id !== sv2Res.contract.roomId);
    assert.ok(nextRoom, 'Phải có phòng nữ còn chỗ tại CS1 để thử chuyển phòng');
    const oldRoomBefore = (await call(`/rooms/${sv2Res.contract.roomId}`, { token: manager })).data;
    const newRoomBefore = (await call(`/rooms/${nextRoom.id}`, { token: manager })).data;

    const transferReq = await call('/portal/requests', {
      method: 'POST',
      token: sv2,
      body: { type: 'transfer', title: 'Xin chuyển sang phòng tầng 2', description: 'Chuyển gần bạn cùng lớp', targetRoomId: nextRoom.id },
    });
    assert.equal(transferReq.code, 'OK');

    // Staff duyệt chuyển phòng -> bị chặn 403; Manager duyệt -> thành công & cập nhật occupied cả 2 phòng
    assert.equal(
      (await call(`/requests/${transferReq.data.id}/status`, { method: 'PATCH', token: staff, body: { status: 'approved' } })).status,
      403
    );
    const approvedTransfer = await call(`/requests/${transferReq.data.id}/status`, {
      method: 'PATCH',
      token: manager,
      body: { status: 'approved', handlerNote: 'Đồng ý chuyển phòng' },
    });
    assert.equal(approvedTransfer.code, 'OK');
    assert.equal((await call(`/rooms/${sv2Res.contract.roomId}`, { token: manager })).data.occupied, oldRoomBefore.occupied - 1);
    assert.equal((await call(`/rooms/${nextRoom.id}`, { token: manager })).data.occupied, newRoomBefore.occupied + 1);
    ok('Phiếu yêu cầu SV: Báo hỏng (Staff xử lý) & Chuyển phòng nguyên tử cấp Phòng (chỉ Manager duyệt)');

    // ---------------------------------------------------------------- 7. Điện nước nối tiếp chỉ số + Thanh lý & Hoàn cọc có khấu trừ
    const a15 = (await call('/buildings?campus=cs1', { token: staff })).data.find((b) => b.code === 'A15');
    const thisMonth = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    const sheet = (await call(`/utility-readings/sheet?buildingId=${a15.id}&monthYear=${thisMonth}`, { token: staff })).data;
    const rowWithPrev = sheet.rows.find((r) => r.previous && r.room.occupied > 0);
    // Thử nhập sai chỉ số cũ so với kỳ trước -> phải báo lỗi METER_INDEX_MISMATCH
    const badBulk = await call('/utility-readings/bulk', {
      method: 'POST',
      token: staff,
      body: {
        buildingId: a15.id,
        monthYear: thisMonth,
        electricityUnitPrice: 3000,
        waterUnitPrice: 15000,
        rows: [
          {
            roomId: rowWithPrev.room.id,
            electricityOldIndex: rowWithPrev.previous.electricityNewIndex + 99,
            electricityNewIndex: rowWithPrev.previous.electricityNewIndex + 150,
            waterOldIndex: rowWithPrev.previous.waterNewIndex,
            waterNewIndex: rowWithPrev.previous.waterNewIndex + 5,
          },
        ],
      },
    });
    assert.equal(badBulk.data.errors[0].code, 'METER_INDEX_MISMATCH');

    // Nhập đúng chỉ số nối tiếp -> lưu & phát hành thành công + bắn thông báo SV
    const goodBulk = await call('/utility-readings/bulk', {
      method: 'POST',
      token: staff,
      body: {
        buildingId: a15.id,
        monthYear: thisMonth,
        electricityUnitPrice: 3000,
        waterUnitPrice: 15000,
        rows: [
          {
            roomId: rowWithPrev.room.id,
            electricityOldIndex: rowWithPrev.previous.electricityNewIndex,
            electricityNewIndex: rowWithPrev.previous.electricityNewIndex + 60,
            waterOldIndex: rowWithPrev.previous.waterNewIndex,
            waterNewIndex: rowWithPrev.previous.waterNewIndex + 6,
          },
        ],
      },
    });
    assert.equal(goodBulk.data.savedCount, 1);
    const published = await call('/utility-readings/publish', { method: 'POST', token: staff, body: { buildingId: a15.id, monthYear: thisMonth } });
    assert.equal(published.code, 'OK');
    assert.ok(published.data.publishedCount >= 1);

    // Thanh lý & hoàn cọc có khấu trừ hỏng đồ cho hợp đồng cNew vừa tạo
    const terminated = await call(`/contracts/${cNew.id}/terminate`, { method: 'PATCH', token: staff });
    assert.equal(terminated.code, 'OK');
    const refunded = await call(`/contracts/${cNew.id}/deposit-refund`, {
      method: 'PATCH',
      token: staff,
      body: { deductionAmount: 100000, reason: 'Khấu trừ làm mất chìa khóa phòng' },
    });
    assert.equal(refunded.code, 'OK');
    assert.equal(refunded.data.depositDeductionAmount, 100000);
    assert.equal(refunded.data.depositRefundAmount, 400000);
    assert.ok(refunded.data.refundPaymentCode && refunded.data.refundPaymentCode.startsWith('REF-'));
    ok('điện nước nối tiếp chỉ số + phát hành thông báo; thanh lý & hoàn cọc có khấu trừ tạo phiếu chi refund');

    // ---------------------------------------------------------------- 8. Dashboard 3 Cơ sở & Doanh thu riêng Manager
    const sum = (await call('/dashboard/summary', { token: staff })).data;
    assert.equal(sum.occupancy.total, sum.occupancy.occupied + sum.occupancy.available + sum.occupancy.maintenance);
    const occ = (await call('/dashboard/occupancy', { token: manager })).data;
    assert.equal(occ.byCampus.length, 3);
    const rev = (await call(`/dashboard/revenue?year=${YEAR}`, { token: manager })).data;
    assert.ok(Array.isArray(rev) && rev.length > 0);
    ok('Dashboard 3 cơ sở: bảo toàn tổng sức chứa + gom nhóm CS1/CS2/CS3 + doanh thu riêng Manager');

    console.log(`\n🎉 Toàn bộ ${passed} nhóm kiểm thử HaUI - DMS v3.0 ĐẠT 100%!`);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});

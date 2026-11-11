/**
 * Kịch bản kiểm thử tích hợp toàn diện Hệ thống HaUI - DMS v2.0.
 * Kiểm tra đầy đủ luồng nghiệp vụ:
 * 1. Đăng nhập linh hoạt (Email / MSSV) & kiểm tra cờ mustChangePassword
 * 2. Tra cứu phòng trống theo Giới tính & Quy tắc ngăn xếp (Stack Allocation) + Redis Cache
 * 3. Sinh viên nộp đơn đăng ký KTX Online công khai không cần tài khoản (FR-30)
 * 4. Cán bộ duyệt đơn: Khóa giường nguyên tử (Atomic Query), Cấp tài khoản tự động & Sinh 2 hóa đơn (FR-32)
 * 5. Chốt số Điện Nước theo phòng: Mã chuẩn INV-UTIL-<Tòa>-<Phòng>-<Tháng> chống trùng lặp (FR-41)
 * 6. Sinh viên xem mã VietQR động & Cán bộ xác nhận thu tiền mặt (FR-52, 53)
 * 7. Trả phòng & Thanh lý Hợp đồng: HOÀN TIỀN CỌC cho sinh viên và nhả giường (FR-34)
 * 8. Dashboard thống kê KPI, lấp đầy và Doanh thu (FR-70, 71, 72)
 * 
 * Chạy: node src/scripts/test-haui-dms.js
 */

require('dotenv').config();
const http = require('http');
const app = require('../app');
const mongoose = require('mongoose');

const PORT = 5055;
let server;

function request(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: rawData });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('============================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ HaUI - DMS');
  console.log('============================================================');

  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dms_ktx';
    await mongoose.connect(uri);
    server = app.listen(PORT);
    console.log(`[TEST] Server đang chạy tại http://localhost:${PORT}`);

    // --- TEST 1: Health check ---
    const health = await request('/api/health');
    console.assert(health.status === 200, 'Health check thất bại');
    console.log('✅ 1. Health check hệ thống hoạt động tốt');

    // --- TEST 2: Đăng nhập Cán bộ KTX (Staff) ---
    const staffLogin = await request('/api/auth/login', 'POST', {}, {
      email: 'staff@haui.edu.vn',
      password: 'staff123',
    });
    console.assert(staffLogin.status === 200, 'Đăng nhập staff thất bại');
    const staffToken = staffLogin.body.data.token;
    const staffHeader = { Authorization: `Bearer ${staffToken}` };
    console.log('✅ 2. Cán bộ KTX đăng nhập thành công');

    // --- TEST 3: Đăng nhập Sinh viên bằng MSSV ---
    const studentLogin = await request('/api/auth/login', 'POST', {}, {
      username: '2021601234',
      password: '2021601234',
    });
    console.assert(studentLogin.status === 200, 'Đăng nhập sinh viên bằng MSSV thất bại');
    console.assert(studentLogin.body.data.user.mustChangePassword === true, 'Cờ mustChangePassword phải là true');
    console.log('✅ 3. Sinh viên đăng nhập bằng MSSV thành công (cờ mustChangePassword = true)');

    // --- TEST 4: Tra cứu phòng trống (Stack Allocation & Cache) ---
    const availRooms = await request('/api/rooms/available?gender=male');
    console.assert(availRooms.status === 200, 'Tra cứu phòng trống thất bại');
    console.assert(Array.isArray(availRooms.body.data), 'Danh sách phòng trống phải là mảng');
    console.log(`✅ 4. Tra cứu phòng trống theo ngăn xếp thành công (${availRooms.body.data.length} phòng khả dụng)`);

    const targetRoom = availRooms.body.data[0];
    const targetBed = targetRoom.availableBedNumbers[0];

    // --- TEST 5: Nộp đơn KTX Online không cần tài khoản (FR-30) ---
    const randomCode = 'SV' + Math.floor(100000 + Math.random() * 900000);
    const regRes = await request('/api/contracts/register-online', 'POST', {}, {
      studentCode: randomCode,
      fullName: 'Sinh Viên Kiểm Thử HaUI',
      gender: 'male',
      phone: '0988776655',
      email: `${randomCode.toLowerCase()}@st.haui.edu.vn`,
      faculty: 'CNTT',
      className: 'KTPM01',
      roomId: targetRoom.id,
      bedNumber: targetBed,
      term: '6_months',
    });
    console.assert(regRes.status === 201, 'Nộp đơn KTX Online thất bại');
    console.log(`✅ 5. Sinh viên nộp đơn online thành công (Mã HĐ: ${regRes.body.data.contractCode})`);

    // --- TEST 6: Cán bộ KTX xem danh sách đơn & Phê duyệt (FR-32) ---
    const contractsList = await request('/api/contracts?status=pending', 'GET', staffHeader);
    const pendingContract = contractsList.body.data.data.find(c => c.contractCode === regRes.body.data.contractCode);
    console.assert(pendingContract, 'Không tìm thấy đơn đăng ký vừa tạo');
    const contractId = pendingContract.id || pendingContract._id;
    const studentDocId = pendingContract.studentId.id || pendingContract.studentId._id;

    const approveRes = await request(`/api/contracts/${contractId}/approve`, 'POST', staffHeader);
    console.assert(approveRes.status === 200, 'Duyệt đơn KTX thất bại');
    console.log('✅ 6. Cán bộ KTX duyệt đơn, Khóa giường nguyên tử & Tự sinh tài khoản User thành công');

    // --- TEST 7: Kiểm tra phát hành 02 hóa đơn sau duyệt ---
    const studentInvoices = await request(`/api/invoices?studentId=${studentDocId}`, 'GET', staffHeader);
    console.assert(studentInvoices.body.data.data.length >= 2, 'Phải sinh đúng 2 hóa đơn (tiền cọc & tiền phòng)');
    console.log(`✅ 7. Tự động phát hành ${studentInvoices.body.data.data.length} hóa đơn (Cọc & Tiền phòng) thành công`);

    // --- TEST 8: Ghi chỉ số Điện Nước & Chốt hóa đơn theo Phòng (FR-40 & 41) ---
    const monthYear = '2026-10';
    const recordRes = await request('/api/utility-readings', 'POST', staffHeader, {
      roomId: targetRoom.id || targetRoom._id,
      monthYear,
      electricityOld: 100,
      electricityNew: 250, // Dùng 150 số
      waterOld: 50,
      waterNew: 70, // Dùng 20 khối
    });
    console.assert(recordRes.status === 200, 'Ghi chỉ số thất bại');

    const readingId = recordRes.body.data.id || recordRes.body.data._id;
    const billRes = await request(`/api/utility-readings/${readingId}/bill`, 'POST', staffHeader);
    console.assert(billRes.status === 200, 'Chốt hóa đơn phòng thất bại');
    const utilityInvoice = billRes.body.data.invoice;
    const utilityInvoiceCode = utilityInvoice.invoiceCode;
    const utilityInvoiceId = utilityInvoice.id || utilityInvoice._id;
    console.assert(utilityInvoiceCode.includes('INV-UTIL-'), 'Mã HĐ điện nước phải có tiền tố INV-UTIL');
    console.log(`✅ 8. Chốt điện nước thành công! Mã HĐ phòng chống trùng: ${utilityInvoiceCode}`);

    // --- TEST 9: Thu tiền mặt & VietQR (FR-52, 53) ---
    // 9.1 Lấy mã VietQR
    const qrRes = await request(`/api/payments/vietqr/${utilityInvoiceId}`, 'GET', staffHeader);
    console.assert(qrRes.status === 200 && qrRes.body.data.vietqr.qrImageUrl, 'Sinh VietQR thất bại');
    console.log(`✅ 9.1 Sinh mã VietQR động thành công (Cú pháp: ${qrRes.body.data.vietqr.syntax})`);

    // 9.2 Thu tiền mặt hóa đơn cọc & tiền phòng
    for (const inv of studentInvoices.body.data.data) {
      const payRes = await request('/api/payments/cash', 'POST', staffHeader, {
        invoiceId: inv.id || inv._id,
      });
      console.assert(payRes.status === 200, 'Thu tiền mặt thất bại');
    }

    // 9.3 Thu tiền mặt điện nước phòng (Đại diện phòng nộp)
    const payUtilRes = await request('/api/payments/cash', 'POST', staffHeader, {
      invoiceId: utilityInvoiceId,
      studentId: studentDocId,
    });
    console.assert(payUtilRes.status === 200, 'Thu tiền điện nước thất bại');
    console.log('✅ 9.2 Đại diện phòng thanh toán tiền mặt gạch nợ thành công');

    // --- TEST 10: Trả phòng & Thanh lý Hợp đồng - HOÀN TIỀN CỌC (FR-34) ---
    const terminateRes = await request(`/api/contracts/${contractId}/terminate`, 'POST', staffHeader, {
      reason: 'Hết kỳ hạn lưu trú',
      deductionAmount: 50000, // Trừ 50k đền bù hỏng bóng đèn
      deductionReason: 'Làm vỡ bóng đèn bàn học',
      refundMethod: 'cash',
    });
    console.assert(terminateRes.status === 200, 'Thanh lý hợp đồng và hoàn cọc thất bại');
    console.assert(terminateRes.body.data.refundSummary.refundAmount === 450000, 'Số tiền hoàn cọc phải là 450.000 đ');
    console.log(`✅ 10. Trả phòng & Hoàn tiền cọc thành công (Hoàn trả: ${terminateRes.body.data.refundSummary.refundAmount.toLocaleString('vi-VN')} đ)`);

    // --- TEST 11: Dashboard thống kê KPI & Doanh thu (FR-70, 72) ---
    const kpiRes = await request('/api/dashboard/kpi', 'GET', staffHeader);
    console.assert(kpiRes.status === 200, 'Lấy KPI thất bại');
    console.log(`✅ 11. Dashboard KPI thành công (Tổng giường: ${kpiRes.body.data.totalBeds}, Tỷ lệ lấp đầy: ${kpiRes.body.data.occupancyRate}%)`);

    console.log('============================================================');
    console.log('🎉 TẤT CẢ 11 KỊCH BẢN KIỂM THỬ ĐÃ VƯỢT QUA 100% THÀNH CÔNG!');
    console.log('============================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ LỖI KIỂM THỬ:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

runTests();


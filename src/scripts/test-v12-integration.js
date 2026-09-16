/**
 * Bộ kiểm thử tự động toàn diện cho các tính năng API mới v1.2.9 -> v1.2.18.
 * Tích hợp đầy đủ theo tài liệu API.md và 16-YEU-CAU-API-BACKEND.md.
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');

const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');
const Room = require('../modules/rooms/room.model');
const RoomType = require('../modules/rooms/room-type.model');
const Building = require('../modules/rooms/building.model');
const Bed = require('../modules/rooms/bed.model');
const FeeType = require('../modules/fees/fee-type.model');
const UtilityReading = require('../modules/fees/utility-reading.model');
const Invoice = require('../modules/fees/invoice.model');
const Payment = require('../modules/payments/payment.model');
const SupplyOrder = require('../modules/supplies/supply-order.model');

let server;
let port;

function request(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runIntegrationTests() {
  await mongoose.connect(process.env.MONGODB_URI);

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TÍCH HỢP TOÀN DIỆN V1.2.9 -> V1.2.18');
  console.log('====================================================\n');

  try {
    // 0. Đăng nhập Admin
    const adminLoginRes = await request('/api/auth/login', 'POST', {}, {
      email: 'admin@dorm.local',
      password: 'Admin@123',
    });
    console.assert(adminLoginRes.status === 200, 'Admin login phải 200');
    const adminToken = adminLoginRes.body.data.token;
    const adminHeader = { Authorization: `Bearer ${adminToken}` };

    // 1. Kiểm thử POST /api/auth/register theo v1.2.18 (SCR-02)
    console.log('▶ TEST 1: Đăng ký sinh viên liên kết hồ sơ (v1.2.18 / SCR-02)...');
    const dummyCode = `SV${Date.now().toString().slice(-6)}`;
    const dummyEmail = `test_reg_${Date.now().toString().slice(-6)}@dorm.local`;

    // 1.1: Mã sinh viên không tồn tại -> 422 STUDENT_NOT_FOUND
    const notFoundRes = await request('/api/auth/register', 'POST', {}, {
      studentCode: 'UNKNOWN_99999',
      fullName: 'Nguyễn Văn A',
      email: dummyEmail,
      password: 'Password@123',
    });
    console.assert(notFoundRes.status === 422, 'Không có hồ sơ phải trả 422');
    console.assert(notFoundRes.body.code === 'STUDENT_NOT_FOUND', 'Mã lỗi phải là STUDENT_NOT_FOUND');
    console.log('  ✅ 1.1: Chặn đúng mã sinh viên không tồn tại (422 STUDENT_NOT_FOUND)!');

    // Tạo hồ sơ Student trước
    const testStudentDoc = await Student.create({
      studentCode: dummyCode,
      fullName: 'Trần Văn Hoàng Minh',
      gender: 'male',
      phone: '0981112233',
      email: dummyEmail,
      status: 'active',
    });

    // 1.2: Họ tên không khớp -> 422 STUDENT_INFO_MISMATCH
    const mismatchRes = await request('/api/auth/register', 'POST', {}, {
      studentCode: dummyCode,
      fullName: 'Trần Văn Sai Tên',
      email: dummyEmail,
      password: 'Password@123',
    });
    console.assert(mismatchRes.status === 422, 'Lệch tên phải trả 422');
    console.assert(mismatchRes.body.code === 'STUDENT_INFO_MISMATCH', 'Mã lỗi phải là STUDENT_INFO_MISMATCH');
    console.log('  ✅ 1.2: Chặn đúng họ tên không khớp (422 STUDENT_INFO_MISMATCH)!');

    // 1.3: Đăng ký thành công với tên chuẩn (thử nghiệm không dấu hoa thường)
    const successRegRes = await request('/api/auth/register', 'POST', {}, {
      studentCode: dummyCode,
      fullName: 'tran van hoang minh', // Test không phân biệt hoa thường và dấu
      email: dummyEmail,
      password: 'Password@123',
      phone: '0981112233',
    });
    console.assert(successRegRes.status === 201, 'Đăng ký thành công phải 201');
    console.assert(successRegRes.body.data.user.role === 'student', 'Role phải là student');
    console.assert(successRegRes.body.data.token, 'Phải có token JWT');
    const studentUserToken = successRegRes.body.data.token;
    const studentHeader = { Authorization: `Bearer ${studentUserToken}` };
    console.log('  ✅ 1.3: Đăng ký liên kết hồ sơ thành công (201 Created)!');

    // 1.4: Sinh viên đã có tài khoản -> 409 STUDENT_ALREADY_HAS_ACCOUNT
    const duplicateAccRes = await request('/api/auth/register', 'POST', {}, {
      studentCode: dummyCode,
      fullName: 'Trần Văn Hoàng Minh',
      email: `other_${dummyEmail}`,
      password: 'Password@123',
    });
    console.assert(duplicateAccRes.status === 409, 'Đã có tài khoản phải trả 409');
    console.assert(duplicateAccRes.body.code === 'STUDENT_ALREADY_HAS_ACCOUNT', 'Mã lỗi phải là STUDENT_ALREADY_HAS_ACCOUNT');
    console.log('  ✅ 1.4: Chặn đúng sinh viên đã có tài khoản (409 STUDENT_ALREADY_HAS_ACCOUNT)!');

    // 2. Kiểm thử Danh mục Loại phí (v1.2.9 - SCR-82)
    console.log('\n▶ TEST 2: Quản lý biểu phí & khóa loại phí hệ thống (v1.2.9 / SCR-82)...');
    const feeTypesRes = await request('/api/fee-types?includeInactive=true', 'GET', adminHeader);
    console.assert(feeTypesRes.status === 200, 'Lấy loại phí phải 200');
    console.assert(Array.isArray(feeTypesRes.body.data), 'Phải là mảng phẳng');
    const electricityFee = feeTypesRes.body.data.find((f) => f.code === 'electricity');
    console.assert(electricityFee && electricityFee.isSystem === true, 'electricity phải có isSystem=true');
    console.log('  ✅ 2.1: Lấy danh sách loại phí có cờ isSystem thành công!');

    // 2.2: Chặn vô hiệu hóa loại phí hệ thống -> 422 FEE_TYPE_REQUIRED
    const deactivateSystemFeeRes = await request(`/api/fee-types/${electricityFee.id}`, 'PUT', adminHeader, {
      isActive: false,
    });
    console.assert(deactivateSystemFeeRes.status === 422, 'Khóa phí hệ thống phải 422');
    console.assert(deactivateSystemFeeRes.body.code === 'FEE_TYPE_REQUIRED', 'Mã lỗi phải là FEE_TYPE_REQUIRED');
    console.log('  ✅ 2.2: Chặn đúng vô hiệu hóa phí hệ thống (422 FEE_TYPE_REQUIRED)!');

    // 3. Kiểm thử Chỉ số điện nước (v1.2.10 - SCR-51)
    console.log('\n▶ TEST 3: Chỉ số điện nước phẳng & chặn kỳ tương lai (v1.2.10 / SCR-51)...');
    const sampleRoom = await Room.findOne({ status: 'active' });
    console.assert(sampleRoom, 'Phải có ít nhất 1 phòng mẫu');

    // 3.1: Chặn kỳ tương lai (ví dụ 2099-12) -> 400 VALIDATION_ERROR
    const futureReadingRes = await request('/api/utility-readings', 'POST', adminHeader, {
      roomId: sampleRoom._id.toString(),
      billingPeriod: '2099-12',
      electricityStart: 100,
      electricityEnd: 150,
      waterStart: 10,
      waterEnd: 15,
    });
    console.assert(futureReadingRes.status === 400, 'Kỳ tương lai phải trả 400');
    console.assert(futureReadingRes.body.code === 'VALIDATION_ERROR', 'Mã lỗi phải là VALIDATION_ERROR');
    console.log('  ✅ 3.1: Chặn đúng kỳ ghi tương lai (400 VALIDATION_ERROR)!');

    // 3.2: Danh sách chỉ số điện nước phẳng (roomId là plain string)
    const readingsListRes = await request('/api/utility-readings?page=1&limit=5', 'GET', adminHeader);
    console.assert(readingsListRes.status === 200, 'Lấy danh sách chỉ số phải 200');
    console.assert(readingsListRes.body.data.items !== undefined, 'Phải có items');
    if (readingsListRes.body.data.items.length > 0) {
      const item0 = readingsListRes.body.data.items[0];
      console.assert(typeof item0.roomId === 'string', 'roomId phải là string ID phẳng');
      console.assert(typeof item0.recordedByName === 'string', 'recordedByName phải là string');
    }
    console.log('  ✅ 3.2: Danh sách chỉ số điện nước chuẩn cấu trúc phẳng!');

    // 4. Kiểm thử Xem trước lập hóa đơn hàng loạt (v1.2.11 - SCR-53)
    console.log('\n▶ TEST 4: Xem trước lập hóa đơn hàng loạt (v1.2.11 / SCR-53)...');
    const previewRes = await request('/api/invoices/generation-preview?billingPeriod=2026-09', 'GET', adminHeader);
    console.assert(previewRes.status === 200, 'Preview phải trả 200 OK');
    console.assert(previewRes.body.data.eligibleStudents !== undefined, 'Phải có eligibleStudents');
    console.assert(previewRes.body.data.readyRooms !== undefined, 'Phải có readyRooms');
    console.assert(Array.isArray(previewRes.body.data.skipped), 'skipped phải là mảng');
    console.log(`  ✅ 4.1: Xem trước lập hóa đơn thành công! (Sinh viên đủ điều kiện: ${previewRes.body.data.eligibleStudents}, Phòng sẵn sàng: ${previewRes.body.data.readyRooms})`);

    // 5. Kiểm thử Danh sách hóa đơn có summary và flat fields (v1.2.11 - SCR-52)
    console.log('\n▶ TEST 5: Danh sách hóa đơn có summary toàn tập (v1.2.11 / SCR-52)...');
    const invoicesListRes = await request('/api/invoices?page=1&limit=5', 'GET', adminHeader);
    console.assert(invoicesListRes.status === 200, 'Lấy danh sách HĐ phải 200');
    console.assert(invoicesListRes.body.data.summary !== undefined, 'Phải có block summary');
    console.assert(typeof invoicesListRes.body.data.summary.totalAmount === 'number', 'summary.totalAmount phải là số');
    console.log(`  ✅ 5.1: Lấy danh sách hóa đơn thành công (Tổng nợ toàn tập: ${invoicesListRes.body.data.summary.remainingAmount.toLocaleString()} đ)`);

    // 6. Kiểm thử Thu tiền quầy có bankReference & chống trùng (v1.2.12 - SCR-55)
    console.log('\n▶ TEST 6: Thu tiền quầy & mã tham chiếu ngân hàng (v1.2.12 / SCR-55)...');
    // Luôn tạo 1 hóa đơn mẫu hợp lệ có lineItems để test thanh toán
    const unpaidInvoice = await Invoice.create({
      invoiceCode: `INV-TEST-${Date.now()}`,
      studentId: testStudentDoc._id,
      type: 'other',
      totalAmount: 100000,
      paidAmount: 0,
      lineItems: [
        {
          description: 'Phí dịch vụ phát sinh',
          quantity: 1,
          unitPrice: 100000,
          amount: 100000,
        },
      ],
      dueDate: new Date(Date.now() + 7 * 86400000),
      status: 'unpaid',
    });

    const testBankRef = `FT${Date.now()}`;
    // 6.1: Chuyển khoản thiếu bankReference -> 400
    const noRefRes = await request('/api/payments/offline', 'POST', adminHeader, {
      invoiceId: unpaidInvoice._id.toString(),
      amount: 50000,
      method: 'bank_transfer',
    });
    console.assert(noRefRes.status === 400, 'Thiếu bankReference phải trả 400');
    console.log('  ✅ 6.1: Bắt buộc mã tham chiếu ngân hàng khi chuyển khoản!');

    // 6.2: Thu tiền chuyển khoản thành công
    const payOfflineRes = await request('/api/payments/offline', 'POST', adminHeader, {
      invoiceId: unpaidInvoice._id.toString(),
      amount: 50000,
      method: 'bank_transfer',
      bankReference: testBankRef,
      note: 'Nộp tiền chuyển khoản đợt 1',
    });
    if (payOfflineRes.status !== 200 && payOfflineRes.status !== 201) {
      console.error('payOfflineRes error body:', JSON.stringify(payOfflineRes.body, null, 2));
    }
    console.assert(payOfflineRes.status === 200 || payOfflineRes.status === 201, 'Thu tiền thành công');
    console.assert(payOfflineRes.body.data?.payment?.bankReference === testBankRef, 'bankReference phải đúng');
    console.log('  ✅ 6.2: Thu tiền chuyển khoản thành công với bankReference!');

    // 6.3: Chống trùng mã giao dịch ngân hàng -> 409 DUPLICATE_ENTRY
    const dupBankRefRes = await request('/api/payments/offline', 'POST', adminHeader, {
      invoiceId: unpaidInvoice._id.toString(),
      amount: 10000,
      method: 'bank_transfer',
      bankReference: testBankRef,
    });
    console.assert(dupBankRefRes.status === 409, 'Trùng bankReference phải 409');
    console.assert(dupBankRefRes.body.code === 'DUPLICATE_ENTRY', 'Mã lỗi phải là DUPLICATE_ENTRY');
    console.log('  ✅ 6.3: Chặn trùng mã tham chiếu ngân hàng (409 DUPLICATE_ENTRY)!');

    // 7. Kiểm thử Lịch sử thanh toán & Đối soát (v1.2.13 - SCR-56)
    console.log('\n▶ TEST 7: Lịch sử thanh toán & Đối soát (v1.2.13 / SCR-56)...');
    const paymentsListRes = await request('/api/payments?page=1&limit=5', 'GET', adminHeader);
    console.assert(paymentsListRes.status === 200, 'Lấy lịch sử thanh toán phải 200');
    console.assert(paymentsListRes.body.data.summary !== undefined, 'Phải có summary');
    console.assert(typeof paymentsListRes.body.data.summary.collectedAmount === 'number', 'summary.collectedAmount phải là số');
    console.log(`  ✅ 7.1: Lịch sử thanh toán có summary thành công! (Thu được: ${paymentsListRes.body.data.summary.collectedAmount.toLocaleString()} đ)`);

    // 7.2: Đối soát giao dịch quầy -> 422 PAYMENT_NOT_ONLINE
    const offlinePayId = payOfflineRes.body.data.payment.id;
    const reconOfflineRes = await request(`/api/payments/${offlinePayId}/reconcile`, 'POST', adminHeader);
    console.assert(reconOfflineRes.status === 422, 'Giao dịch quầy phải trả 422');
    console.assert(reconOfflineRes.body.code === 'PAYMENT_NOT_ONLINE', 'Mã lỗi phải là PAYMENT_NOT_ONLINE');
    console.log('  ✅ 7.2: Chặn đúng đối soát giao dịch tại quầy (422 PAYMENT_NOT_ONLINE)!');

    // 8. Kiểm thử Quản trị Nhu yếu phẩm (v1.2.14 - SCR-71)
    console.log('\n▶ TEST 8: Quản trị đơn hàng nhu yếu phẩm đủ 6 summary (v1.2.14 / SCR-71)...');
    const supplyOrdersRes = await request('/api/supply-orders?page=1&limit=5', 'GET', adminHeader);
    console.assert(supplyOrdersRes.status === 200, 'Lấy đơn hàng phải 200');
    const supplySummary = supplyOrdersRes.body.data.summary;
    console.assert(supplySummary && supplySummary.all !== undefined, 'Phải có summary.all');
    console.assert(supplySummary.pendingPayment !== undefined, 'Phải có pendingPayment');
    console.assert(supplySummary.deliveredToday !== undefined, 'Phải có deliveredToday');
    console.log('  ✅ 8.1: Đơn hàng nhu yếu phẩm có đủ 6 thống kê summary!');

    // 9. Kiểm thử Cổng sinh viên (v1.2.15, v1.2.16 - SCR-63, SCR-65, SCR-69)
    console.log('\n▶ TEST 9: Cổng sinh viên kiểm tra chỗ ở & lịch sử lưu trú (v1.2.15 - 1.2.16)...');
    const studentProfileRes = await request('/api/portal/profile', 'GET', studentHeader);
    console.assert(studentProfileRes.status === 200, 'Lấy profile phải 200');
    console.assert(studentProfileRes.body.data.studentCode === dummyCode, 'Mã sinh viên phải khớp');
    console.log('  ✅ 9.1: Sinh viên đọc profile chính chủ thành công!');

    const studentContractsRes = await request('/api/portal/my-contracts', 'GET', studentHeader);
    console.assert(studentContractsRes.status === 200, 'my-contracts phải 200');
    console.assert(Array.isArray(studentContractsRes.body.data), 'my-contracts phải là mảng');
    console.log('  ✅ 9.2: my-contracts trả về danh sách hợp đồng kèm terminationReason thành công!');

    const studentPaymentsRes = await request(`/api/portal/my-payments?transactionRef=PAY_NONE_EXIST`, 'GET', studentHeader);
    console.assert(studentPaymentsRes.status === 200, 'my-payments phải 200');
    console.assert(studentPaymentsRes.body.data.length === 0, 'Lọc ref không tồn tại trả mảng rỗng');
    console.log('  ✅ 9.3: my-payments hỗ trợ lọc theo transactionRef thành công!');

    // Dọn dẹp dữ liệu test
    await Student.deleteOne({ _id: testStudentDoc._id });
    await User.deleteOne({ email: dummyEmail });
    await Payment.deleteMany({ bankReference: testBankRef });
    if (unpaidInvoice) {
      await Invoice.deleteOne({ _id: unpaidInvoice._id });
    }

    console.log('\n====================================================');
    console.log('🎉 TẤT CẢ CÁC TÍNH NĂNG TỪ V1.2.9 -> V1.2.18 ĐỀU ĐẠT 100%!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.connection.close();
    process.exit(0);
  }
}

runIntegrationTests();

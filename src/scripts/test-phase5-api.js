/**
 * Kịch bản kiểm thử tự động Giai đoạn 5: Payments (Thanh toán & VNPay Sandbox).
 * Sử dụng native fetch (Node 22), không cần thư viện ngoài.
 *
 * Kiểm tra:
 * 1. Thu tiền mặt/chuyển khoản quầy: partial payment, full payment, chống thu quá số nợ (422), chống thu hóa đơn đã trả đủ (422).
 * 2. Tái tính toán paidAmount của hóa đơn từ tổng payments (BR-43).
 * 3. Tạo link thanh toán VNPay Sandbox với chữ ký HMAC-SHA512.
 * 4. Kiểm tra bảo mật chữ ký sai: trả về 400 INVALID_SIGNATURE (BR-61, TC-103).
 * 5. Xác thực thành công từ Return URL: cập nhật payment status completed, cập nhật hóa đơn.
 * 6. Chống ghi nhận trùng (Idempotent - TC-104, BR-62): gửi lại cùng tham số không được cộng dồn tiền.
 * 7. Lệch số tiền (TC-105, BR-63): phát hiện số tiền cổng thanh toán lệch với DB.
 * 8. Đối soát giao dịch (reconcile) và truy vấn lịch sử thanh toán.
 */

const crypto = require('crypto');
const http = require('http');
require('dotenv').config();

const app = require('../app');
const { connectDB } = require('../core/config/database');
const Student = require('../modules/students/student.model');
const Invoice = require('../modules/fees/invoice.model');
const Payment = require('../modules/payments/payment.model');
const vnpayHelper = require('../modules/payments/vnpay.helper');

let server;
let baseURL;

const runTests = async () => {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 5: PAYMENTS & VNPAY');
  console.log('====================================================\n');

  await connectDB();

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseURL = `http://127.0.0.1:${port}/api`;
      console.log(`[Test Server] Đang chạy tại ${baseURL}\n`);
      resolve();
    });
  });

  const request = async (path, { method = 'GET', body = null, token = null } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseURL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json();
    return { status: res.status, data };
  };

  let staffToken;
  let testStudent;
  let testInvoice1;
  let testInvoice2;

  try {
    // 1. Đăng nhập Staff và lấy thông tin sinh viên mẫu
    console.log('--- 1. Khởi tạo tài khoản & Dữ liệu hóa đơn mẫu ---');
    const staffRes = await request('/auth/login', {
      method: 'POST',
      body: {
        email: 'staff1@dorm.local',
        password: 'Staff@123',
      },
    });
    if (staffRes.status !== 200 || !staffRes.data.data?.token) {
      throw new Error(`Đăng nhập Staff thất bại: ${JSON.stringify(staffRes.data)}`);
    }
    staffToken = staffRes.data.data.token;
    console.log('✅ Đăng nhập Nhân viên (Staff) thành công');

    testStudent = await Student.findOne({ status: 'active' });
    if (!testStudent) {
      throw new Error('Cần ít nhất 1 sinh viên active trong DB để test');
    }

    // Tạo hóa đơn test 1 cho thanh toán tiền mặt
    testInvoice1 = await Invoice.create({
      invoiceCode: `HD-TEST-CASH-${Date.now()}`,
      studentId: testStudent._id,
      month: 10,
      year: 2026,
      type: 'monthly',
      items: [
        { feeTypeCode: 'rent', name: 'Tiền phòng', quantity: 1, unitPrice: 800000, amount: 800000 },
        { feeTypeCode: 'electricity', name: 'Tiền điện', quantity: 1, unitPrice: 200000, amount: 200000 },
      ],
      totalAmount: 1000000,
      paidAmount: 0,
      status: 'unpaid',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    console.log(`✅ Đã tạo Hóa đơn Test 1 (Tiền mặt): ${testInvoice1.invoiceCode} - Tổng tiền: 1.000.000 đ`);

    // Tạo hóa đơn test 2 cho VNPay
    testInvoice2 = await Invoice.create({
      invoiceCode: `HD-TEST-VNP-${Date.now()}`,
      studentId: testStudent._id,
      month: 10,
      year: 2026,
      type: 'monthly',
      items: [
        { feeTypeCode: 'rent', name: 'Tiền phòng tháng 10', quantity: 1, unitPrice: 500000, amount: 500000 },
      ],
      totalAmount: 500000,
      paidAmount: 0,
      status: 'unpaid',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    console.log(`✅ Đã tạo Hóa đơn Test 2 (VNPay): ${testInvoice2.invoiceCode} - Tổng tiền: 500.000 đ\n`);

    // 2. Kiểm thử thu tiền mặt một phần (Partial Payment)
    console.log('--- 2. Kiểm thử thu tiền mặt một phần (Partial: 400.000 đ / 1.000.000 đ) ---');
    const cashPartialRes = await request('/payments/offline', {
      method: 'POST',
      token: staffToken,
      body: {
        invoiceId: testInvoice1._id.toString(),
        amount: 400000,
        paymentMethod: 'cash',
        note: 'Thu một phần tiền mặt đợt 1',
      },
    });

    if (
      cashPartialRes.status === 201 &&
      cashPartialRes.data.code === 'OK' &&
      cashPartialRes.data.data.invoice.status === 'partial' &&
      cashPartialRes.data.data.invoice.paidAmount === 400000
    ) {
      console.log('✅ Thu tiền mặt một phần thành công: status = partial, paidAmount = 400.000 đ');
    } else {
      throw new Error(`Thu tiền một phần không khớp trạng thái: ${JSON.stringify(cashPartialRes.data)}`);
    }

    // 3. Chống thu vượt quá số nợ còn lại (nợ 600.000 đ, thử thu 700.000 đ)
    console.log('\n--- 3. Kiểm thử chặn thanh toán vượt số nợ còn lại (Nợ 600k, thu 700k) ---');
    const overpayRes = await request('/payments/offline', {
      method: 'POST',
      token: staffToken,
      body: {
        invoiceId: testInvoice1._id.toString(),
        amount: 700000,
        paymentMethod: 'cash',
      },
    });

    if (overpayRes.status === 422 && overpayRes.data.code === 'AMOUNT_EXCEEDS_DEBT') {
      console.log(`✅ Chặn thành công lỗi 422 AMOUNT_EXCEEDS_DEBT: ${overpayRes.data.message}`);
    } else {
      throw new Error(`Lẽ ra phải chặn khi thu vượt số nợ, nhận: ${JSON.stringify(overpayRes)}`);
    }

    // 4. Thu nốt số tiền còn lại (600.000 đ) -> Hóa đơn chuyển sang 'paid'
    console.log('\n--- 4. Thu nốt số tiền còn lại (600.000 đ) -> Chuyển sang "paid" ---');
    const cashFullRes = await request('/payments/offline', {
      method: 'POST',
      token: staffToken,
      body: {
        invoiceId: testInvoice1._id.toString(),
        amount: 600000,
        paymentMethod: 'cash',
        note: 'Thu nốt phần còn lại tại quầy',
      },
    });

    if (
      cashFullRes.status === 201 &&
      cashFullRes.data.code === 'OK' &&
      cashFullRes.data.data.invoice.status === 'paid' &&
      cashFullRes.data.data.invoice.paidAmount === 1000000
    ) {
      console.log('✅ Hóa đơn Test 1 đã thanh toán đủ 1.000.000 đ: status = paid');
    } else {
      throw new Error(`Hóa đơn không chuyển sang trạng thái paid: ${JSON.stringify(cashFullRes.data)}`);
    }

    // 5. Chặn thu tiền khi hóa đơn đã trả đủ
    console.log('\n--- 5. Chặn thu tiền hóa đơn đã hoàn thành (INVOICE_ALREADY_PAID) ---');
    const alreadyPaidRes = await request('/payments/offline', {
      method: 'POST',
      token: staffToken,
      body: {
        invoiceId: testInvoice1._id.toString(),
        amount: 50000,
      },
    });

    if (alreadyPaidRes.status === 422 && alreadyPaidRes.data.code === 'INVOICE_ALREADY_PAID') {
      console.log(`✅ Chặn thành công lỗi 422 INVOICE_ALREADY_PAID: ${alreadyPaidRes.data.message}`);
    } else {
      throw new Error(`Lẽ ra phải chặn khi hóa đơn đã đủ tiền, nhận: ${JSON.stringify(alreadyPaidRes)}`);
    }

    // 6. Kiểm thử tạo URL thanh toán VNPay Sandbox
    console.log('\n--- 6. Kiểm thử tạo URL thanh toán VNPay Sandbox ---');
    const vnpCheckoutRes = await request('/payments/online/checkout', {
      method: 'POST',
      token: staffToken,
      body: {
        invoiceId: testInvoice2._id.toString(),
      },
    });

    if (vnpCheckoutRes.status !== 200 || !vnpCheckoutRes.data.data?.paymentUrl) {
      throw new Error(`Tạo URL VNPay thất bại: ${JSON.stringify(vnpCheckoutRes.data)}`);
    }

    const { paymentUrl, transactionRef, amount } = vnpCheckoutRes.data.data;
    console.log(`✅ URL thanh toán sinh thành công: ${paymentUrl.substring(0, 75)}...`);
    console.log(`✅ transactionRef: ${transactionRef}, amount: ${amount} đ`);

    // Kiểm tra Payment pending trong DB
    const pendingPayment = await Payment.findOne({ transactionRef });
    if (!pendingPayment || pendingPayment.status !== 'pending') {
      throw new Error('Bản ghi Payment không ở trạng thái pending');
    }
    console.log('✅ Bản ghi Payment được lưu trong DB với status = pending');

    // 7. Kiểm thử bảo mật: Chữ ký VNPay bị sai (TC-103, BR-61)
    console.log('\n--- 7. Kiểm thử bảo mật: Chữ ký HMAC sai (TC-103, BR-61) ---');
    const invalidSigRes = await request('/payments/vnpay/verify', {
      method: 'POST',
      body: {
        vnp_Amount: `${amount * 100}`,
        vnp_ResponseCode: '00',
        vnp_TxnRef: transactionRef,
        vnp_SecureHash: 'c0deba0matgiam40khonghopledauday1234567890abcdef',
      },
    });

    if (invalidSigRes.status === 400 && invalidSigRes.data.code === 'INVALID_SIGNATURE') {
      console.log(`✅ Chặn thành công chữ ký giả mạo 400 INVALID_SIGNATURE: ${invalidSigRes.data.message}`);
    } else {
      throw new Error(`Lẽ ra phải từ chối chữ ký sai, nhận: ${JSON.stringify(invalidSigRes)}`);
    }

    // 8. Tạo tham số Return URL hợp lệ với chữ ký thật từ helper
    console.log('\n--- 8. Kiểm thử xác thực Return URL VNPay hợp lệ (Mã 00 - Thành công) ---');
    const validReturnParams = {
      vnp_Amount: `${amount * 100}`,
      vnp_BankCode: 'NCB',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: `Thanh toan hoa don ${testInvoice2.invoiceCode}`,
      vnp_PayDate: '20261012100000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: process.env.VNP_TMN_CODE || 'DEMOKTX1',
      vnp_TransactionNo: `VNP${Date.now()}`,
      vnp_TxnRef: transactionRef,
    };

    // Ký chữ ký HMAC-SHA512 chuẩn bằng chính helper của hệ thống
    validReturnParams.vnp_SecureHash = vnpayHelper.signParams(validReturnParams);

    const verifySuccessRes = await request('/payments/vnpay/verify', {
      method: 'POST',
      body: validReturnParams,
    });

    if (
      verifySuccessRes.status === 200 &&
      verifySuccessRes.data.code === 'OK' &&
      verifySuccessRes.data.data.payment.status === 'completed' &&
      verifySuccessRes.data.data.invoice.status === 'paid' &&
      verifySuccessRes.data.data.invoice.paidAmount === amount
    ) {
      console.log('✅ Xác thực thanh toán VNPay thành công:');
      console.log(`   - Payment status: ${verifySuccessRes.data.data.payment.status}`);
      console.log(`   - Invoice status: ${verifySuccessRes.data.data.invoice.status} (paidAmount: ${verifySuccessRes.data.data.invoice.paidAmount} đ)`);
    } else {
      throw new Error(`Xác thực VNPay hợp lệ không cập nhật đúng: ${JSON.stringify(verifySuccessRes.data)}`);
    }

    // 9. Kiểm thử Idempotency (TC-104, BR-62): Gửi lại đúng giao dịch đã thành công
    console.log('\n--- 9. Kiểm thử chống cộng dồn lần hai (Idempotent - TC-104, BR-62) ---');
    const duplicateVerifyRes = await request('/payments/vnpay/verify', {
      method: 'POST',
      body: validReturnParams,
    });

    if (
      duplicateVerifyRes.status === 200 &&
      duplicateVerifyRes.data.code === 'OK' &&
      duplicateVerifyRes.data.data.alreadyConfirmed === true &&
      duplicateVerifyRes.data.data.invoice.paidAmount === amount
    ) {
      console.log('✅ Idempotent hoạt động hoàn hảo: alreadyConfirmed = true, không cộng dồn tiền');
    } else {
      throw new Error(`Bị xử lý trùng lặp giao dịch thanh toán: ${JSON.stringify(duplicateVerifyRes.data)}`);
    }

    // 10. Kiểm thử lệch số tiền (TC-105, BR-63)
    console.log('\n--- 10. Kiểm thử kiểm soát lệch số tiền (TC-105, BR-63) ---');
    // Tạo 1 giao dịch pending khác
    const testInvoice3 = await Invoice.create({
      invoiceCode: `HD-TEST-MISMATCH-${Date.now()}`,
      studentId: testStudent._id,
      month: 10,
      year: 2026,
      type: 'monthly',
      items: [{ feeTypeCode: 'rent', name: 'Phòng test', quantity: 1, unitPrice: 300000, amount: 300000 }],
      totalAmount: 300000,
      paidAmount: 0,
      status: 'unpaid',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const mismatchCheckout = await request('/payments/online/checkout', {
      method: 'POST',
      token: staffToken,
      body: { invoiceId: testInvoice3._id.toString() },
    });
    const mismatchRef = mismatchCheckout.data.data.transactionRef;

    // Cổng trả về với số tiền khác (ví dụ cố tình gửi vnp_Amount là 100.000 đ thay vì 300.000 đ)
    const mismatchParams = {
      vnp_Amount: '10000000', // 100.000 đ * 100
      vnp_BankCode: 'NCB',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: `Thanh toan hoa don test`,
      vnp_PayDate: '20261012100000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: process.env.VNP_TMN_CODE || 'DEMOKTX1',
      vnp_TransactionNo: `VNP${Date.now()}`,
      vnp_TxnRef: mismatchRef,
    };
    mismatchParams.vnp_SecureHash = vnpayHelper.signParams(mismatchParams);

    const mismatchRes = await request('/payments/vnpay/verify', {
      method: 'POST',
      body: mismatchParams,
    });

    if (mismatchRes.status === 422 && mismatchRes.data.code === 'AMOUNT_MISMATCH') {
      console.log(`✅ Phát hiện lệch số tiền thành công 422 AMOUNT_MISMATCH: ${mismatchRes.data.message}`);
    } else {
      throw new Error(`Lẽ ra phải chặn khi lệch số tiền, nhận: ${JSON.stringify(mismatchRes)}`);
    }

    // 11. Đối soát giao dịch (reconcile)
    console.log('\n--- 11. Kiểm thử đối soát giao dịch (POST /api/payments/:id/reconcile) ---');
    const paymentToReconcile = await Payment.findOne({ transactionRef });
    const reconcileRes = await request(`/payments/${paymentToReconcile._id}/reconcile`, {
      method: 'POST',
      token: staffToken,
    });

    if (reconcileRes.status === 200 && reconcileRes.data.code === 'OK') {
      console.log(`✅ Đối soát hoàn tất: ${reconcileRes.data.message}`);
    } else {
      throw new Error(`Đối soát thất bại: ${JSON.stringify(reconcileRes.data)}`);
    }

    // 12. Danh sách lịch sử thanh toán & Chi tiết thanh toán
    console.log('\n--- 12. Kiểm thử lấy danh sách & chi tiết thanh toán ---');
    const paymentsListRes = await request('/payments?limit=5', {
      token: staffToken,
    });
    if (paymentsListRes.status === 200 && paymentsListRes.data.code === 'OK' && paymentsListRes.data.data.items.length > 0) {
      console.log(`✅ Lấy danh sách thanh toán thành công: ${paymentsListRes.data.data.items.length} giao dịch`);
    } else {
      throw new Error(`Không lấy được danh sách thanh toán: ${JSON.stringify(paymentsListRes.data)}`);
    }

    const singlePaymentRes = await request(`/payments/${paymentToReconcile._id}`, {
      token: staffToken,
    });
    if (singlePaymentRes.status === 200 && singlePaymentRes.data.code === 'OK' && singlePaymentRes.data.data.id) {
      console.log(`✅ Lấy chi tiết thanh toán thành công: Mã giao dịch ${singlePaymentRes.data.data.transactionId}`);
    } else {
      throw new Error(`Không lấy được chi tiết thanh toán: ${JSON.stringify(singlePaymentRes.data)}`);
    }

    // Dọn dẹp dữ liệu test
    await Invoice.deleteMany({
      _id: { $in: [testInvoice1._id, testInvoice2._id, testInvoice3._id] },
    });
    await Payment.deleteMany({
      invoiceId: { $in: [testInvoice1._id, testInvoice2._id, testInvoice3._id] },
    });
    console.log('\n✅ Đã dọn dẹp các bản ghi mẫu thử nghiệm sạch sẽ.');

    console.log('\n====================================================');
    console.log('🎉 TẤT CẢ 12 TEST CASES GIAI ĐOẠN 5 ĐÃ VƯỢT QUA 100%!');
    console.log('====================================================');
  } catch (error) {
    console.error('❌ LỖI KIỂM THỬ:', error.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    process.exit(process.exitCode || 0);
  }
};

runTests();

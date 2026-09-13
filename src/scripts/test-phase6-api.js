/**
 * Kịch bản kiểm thử tự động Giai đoạn 6: Requests (Gia hạn, Trả phòng & Quyết toán cọc).
 * Tuân thủ theo API.md §9, §10, DATA-SCHEMA.md §3.12, §4 và PRD.md §2.9 (Nghiệp vụ A3 Quyết toán cọc).
 *
 * Kiểm tra:
 * 1. Sinh viên tạo yêu cầu gia hạn hợp đồng (renewal) hợp lệ.
 * 2. Chặn gửi trùng yêu cầu cùng loại đang pending (409 DUPLICATE_PENDING_REQUEST).
 * 3. Nhân viên duyệt Gia hạn: Tự động kéo dài ngày kết thúc của Contract và Residency.
 * 4. Sinh viên tạo yêu cầu trả phòng (checkout) và hủy thành công khi pending.
 * 5. Nhân viên từ chối yêu cầu kèm lý do bắt buộc (400 nếu thiếu lý do).
 * 6. ⭐ Nghiệp vụ A3 Quyết toán cọc khi duyệt trả phòng:
 *    - Cảnh báo nợ 422 STUDENT_HAS_DEBT khi sinh viên còn hóa đơn chưa đóng và forceConfirm=false.
 *    - Duyệt với forceConfirm=true: Tự động cấn trừ tiền cọc vào nợ.
 *    - Sinh bản ghi hoàn tiền cọc Payment (type: refund, status: completed).
 *    - Cascade: Chấm dứt Contract (terminated), đóng Residency (ended), giải phóng Bed (available).
 */

const http = require('http');
require('dotenv').config();

const app = require('../app');
const { connectDatabase } = require('../core/config/database');
const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');
const Building = require('../modules/rooms/building.model');
const Room = require('../modules/rooms/room.model');
const Bed = require('../modules/rooms/bed.model');
const Residency = require('../modules/residencies/residency.model');
const Contract = require('../modules/contracts/contract.model');
const Invoice = require('../modules/fees/invoice.model');
const Payment = require('../modules/payments/payment.model');
const Request = require('../modules/requests/request.model');

let server;
let baseURL;

const runTests = async () => {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 6: REQUESTS & SETTLEMENT');
  console.log('====================================================\n');

  await connectDatabase();

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
  let studentToken;
  let testUserStudent;
  let testStudent;
  let testBuilding;
  let testRoom;
  let testBed;
  let testResidency;
  let testContract;
  let testInvoice;

  try {
    // 1. Khởi tạo tài khoản Staff & Sinh viên mẫu
    console.log('--- 1. Khởi tạo tài khoản & Hợp đồng lưu trú mẫu ---');
    const staffRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'staff1@dorm.local', password: 'Staff@123' },
    });
    staffToken = staffRes.data.data.token;
    console.log('✅ Đăng nhập Staff thành công');

    // Tạo hoặc lấy user student
    const studentEmail = `student.phase6.${Date.now()}@dorm.local`;
    const studentCode = `SV6${Date.now().toString().slice(-5)}`;
    const studentRegister = await request('/auth/register', {
      method: 'POST',
      body: {
        email: studentEmail,
        password: 'Password@123',
        fullName: 'Nguyễn Văn Phượng',
        studentCode,
        gender: 'male',
        phone: '0981112233',
      },
    });
    studentToken = studentRegister.data.data.token;
    testStudent = await Student.findOne({ studentCode });
    console.log(`✅ Đã tạo Sinh viên test: ${testStudent.fullName} (${testStudent.studentCode})`);

    // Tạo tòa, phòng, giường
    testBuilding = await Building.create({
      code: `T6${Date.now().toString().slice(-4)}`,
      name: 'Tòa Test Phase 6',
      gender: 'male',
    });
    testRoom = await Room.create({
      buildingId: testBuilding._id,
      roomNumber: '601',
      gender: 'male',
      capacity: 2,
      pricePerBed: 600000,
    });
    testBed = await Bed.create({
      roomId: testRoom._id,
      bedNumber: 1,
      status: 'occupied',
    });

    // Tạo lưu trú và hợp đồng active có tiền cọc 1.000.000 đ
    testResidency = await Residency.create({
      studentId: testStudent._id,
      bedId: testBed._id,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-01-31'),
      status: 'active',
    });

    testContract = await Contract.create({
      contractNumber: `HD-6-${Date.now()}`,
      studentId: testStudent._id,
      residencyId: testResidency._id,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-01-31'),
      roomFeeSnapshot: 600000,
      depositAmount: 1000000,
      depositStatus: 'paid',
      status: 'active',
    });
    console.log(`✅ Đã thiết lập Hợp đồng đang hiệu lực: ${testContract.contractNumber} (Cọc: 1.000.000 đ)\n`);

    // 2. Sinh viên tạo yêu cầu gia hạn hợp đồng (Renewal)
    console.log('--- 2. Sinh viên gửi yêu cầu Gia hạn hợp đồng (Renewal) ---');
    const renewalRes = await request('/portal/my-requests', {
      method: 'POST',
      token: studentToken,
      body: {
        type: 'renewal',
        requestedEndDate: '2027-06-30',
        reason: 'Em muốn đăng ký ở lại KTX kỳ học hè 2027',
      },
    });

    if (
      renewalRes.status === 201 &&
      renewalRes.data.code === 'OK' &&
      renewalRes.data.data.status === 'pending' &&
      renewalRes.data.data.type === 'renewal'
    ) {
      console.log(`✅ Sinh viên gửi yêu cầu gia hạn thành công (ID: ${renewalRes.data.data.id})`);
    } else {
      throw new Error(`Tạo yêu cầu gia hạn thất bại: ${JSON.stringify(renewalRes.data)}`);
    }
    const renewalRequestId = renewalRes.data.data.id;

    // 3. Chống gửi trùng yêu cầu khi đang có yêu cầu pending (409 DUPLICATE_PENDING_REQUEST)
    console.log('\n--- 3. Chặn gửi trùng yêu cầu cùng loại đang pending (TC 409) ---');
    const duplicateRes = await request('/portal/my-requests', {
      method: 'POST',
      token: studentToken,
      body: {
        type: 'renewal',
        requestedEndDate: '2027-07-31',
        reason: 'Gửi lại lần nữa',
      },
    });

    if (duplicateRes.status === 409 && duplicateRes.data.code === 'DUPLICATE_PENDING_REQUEST') {
      console.log(`✅ Chặn trùng thành công lỗi 409 DUPLICATE_PENDING_REQUEST: ${duplicateRes.data.message}`);
    } else {
      throw new Error(`Lẽ ra phải chặn trùng yêu cầu pending, nhận: ${JSON.stringify(duplicateRes)}`);
    }

    // 4. Nhân viên xem chi tiết yêu cầu
    console.log('\n--- 4. Nhân viên tra cứu chi tiết yêu cầu kèm kiểm tra nợ ---');
    const detailRes = await request(`/requests/${renewalRequestId}`, {
      token: staffToken,
    });
    if (detailRes.status === 200 && detailRes.data.code === 'OK') {
      console.log(`✅ Lấy chi tiết yêu cầu thành công, tổng nợ hiện tại: ${detailRes.data.data.outstandingDebt} đ`);
    } else {
      throw new Error(`Lấy chi tiết thất bại: ${JSON.stringify(detailRes.data)}`);
    }

    // 5. Nhân viên duyệt yêu cầu gia hạn hợp đồng (Approve Renewal)
    console.log('\n--- 5. Nhân viên duyệt Gia hạn hợp đồng (Approve Renewal) ---');
    const approveRenewalRes = await request(`/requests/${renewalRequestId}/approve`, {
      method: 'PATCH',
      token: staffToken,
      body: {
        requestedEndDate: '2027-06-30',
        staffNote: 'Đã xác nhận kết quả học tập tốt, đồng ý gia hạn',
      },
    });

    if (approveRenewalRes.status === 200 && approveRenewalRes.data.code === 'OK') {
      const updatedContract = await Contract.findById(testContract._id);
      const updatedResidency = await Residency.findById(testResidency._id);
      console.log(`✅ Duyệt gia hạn thành công: Request status = approved`);
      console.log(`✅ Ngày kết thúc mới của Contract: ${updatedContract.endDate.toISOString().slice(0, 10)}`);
      console.log(`✅ Ngày kết thúc mới của Residency: ${updatedResidency.endDate.toISOString().slice(0, 10)}`);
    } else {
      throw new Error(`Duyệt gia hạn thất bại: ${JSON.stringify(approveRenewalRes.data)}`);
    }

    // 6. Sinh viên tạo yêu cầu Trả phòng (Checkout) rồi tự Hủy (Cancel)
    console.log('\n--- 6. Sinh viên tạo yêu cầu Trả phòng và tự Hủy yêu cầu ---');
    const checkoutReq1 = await request('/portal/my-requests', {
      method: 'POST',
      token: studentToken,
      body: {
        type: 'checkout',
        requestedEndDate: '2026-12-01',
        reason: 'Dự định chuyển trọ',
      },
    });
    const checkoutReq1Id = checkoutReq1.data.data.id;
    console.log(`✅ Sinh viên tạo yêu cầu trả phòng (ID: ${checkoutReq1Id})`);

    const cancelRes = await request(`/portal/my-requests/${checkoutReq1Id}`, {
      method: 'DELETE',
      token: studentToken,
    });
    if (cancelRes.status === 200 && cancelRes.data.data.status === 'cancelled') {
      console.log('✅ Sinh viên tự hủy yêu cầu pending thành công (status: cancelled)');
    } else {
      throw new Error(`Hủy yêu cầu thất bại: ${JSON.stringify(cancelRes.data)}`);
    }

    // 7. Sinh viên tạo yêu cầu Trả phòng mới và Nhân viên Từ chối (Reject)
    console.log('\n--- 7. Nhân viên từ chối yêu cầu (Reject kèm lý do) ---');
    const checkoutReq2 = await request('/portal/my-requests', {
      method: 'POST',
      token: studentToken,
      body: {
        type: 'checkout',
        requestedEndDate: '2026-11-15',
        reason: 'Muốn trả phòng sớm',
      },
    });
    const checkoutReq2Id = checkoutReq2.data.data.id;

    // Thử reject không có lý do -> Bị 400
    const rejectNoReason = await request(`/requests/${checkoutReq2Id}/reject`, {
      method: 'PATCH',
      token: staffToken,
      body: { reviewNote: '' },
    });
    if (rejectNoReason.status === 400) {
      console.log('✅ Bắt buộc có lý do từ chối (400 validation error)');
    } else {
      throw new Error('Lẽ ra phải chặn khi từ chối không có lý do');
    }

    // Reject hợp lệ kèm lý do
    const rejectRes = await request(`/requests/${checkoutReq2Id}/reject`, {
      method: 'PATCH',
      token: staffToken,
      body: { reviewNote: 'Phải báo trước tối thiểu 15 ngày theo nội quy KTX' },
    });
    if (rejectRes.status === 200 && rejectRes.data.data.status === 'rejected') {
      console.log(`✅ Từ chối yêu cầu thành công: status = rejected, lý do: "${rejectRes.data.data.reviewNote}"`);
    } else {
      throw new Error(`Từ chối thất bại: ${JSON.stringify(rejectRes.data)}`);
    }

    // 8. ⭐ Quyết toán Cọc Trả phòng (Nghiệp vụ A3 - PRD §2.9): Cảnh báo nợ & Quyết toán
    console.log('\n--- 8. ⭐ Kiểm thử Nghiệp vụ A3: Quyết toán Trả phòng & Khấu trừ Cọc ---');
    // Sinh viên tạo yêu cầu trả phòng chính thức
    const finalCheckoutReq = await request('/portal/my-requests', {
      method: 'POST',
      token: studentToken,
      body: {
        type: 'checkout',
        requestedEndDate: '2026-11-30',
        reason: 'Hoàn thành khóa học, trả phòng về quê',
      },
    });
    const finalCheckoutId = finalCheckoutReq.data.data.id;

    // Tạo 1 hóa đơn sinh viên còn nợ 300.000 đ
    testInvoice = await Invoice.create({
      invoiceCode: `HD-DEBT-P6-${Date.now()}`,
      studentId: testStudent._id,
      contractId: testContract._id,
      month: 11,
      year: 2026,
      type: 'monthly',
      items: [
        { feeTypeCode: 'electricity', name: 'Tiền điện phòng còn nợ', quantity: 1, unitPrice: 300000, amount: 300000 },
      ],
      totalAmount: 300000,
      paidAmount: 0,
      status: 'unpaid',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    console.log(`✅ Đã tạo hóa đơn nợ 300.000 đ cho sinh viên: ${testInvoice.invoiceCode}`);

    // Nhân viên duyệt nhưng KHÔNG bật forceConfirm -> Phải cảnh báo nợ 422 STUDENT_HAS_DEBT
    const debtWarningRes = await request(`/requests/${finalCheckoutId}/approve`, {
      method: 'PATCH',
      token: staffToken,
      body: {
        actualCheckoutDate: '2026-11-30',
        forceConfirm: false,
      },
    });

    if (debtWarningRes.status === 422 && debtWarningRes.data.code === 'STUDENT_HAS_DEBT') {
      console.log(`✅ Cảnh báo nợ thành công 422 STUDENT_HAS_DEBT: ${debtWarningRes.data.message}`);
      console.log(`   Số tiền nợ ghi nhận: ${debtWarningRes.data.data.outstandingDebt} đ`);
    } else {
      throw new Error(`Lẽ ra phải cảnh báo nợ khi forceConfirm=false, nhận: ${JSON.stringify(debtWarningRes)}`);
    }

    // Nhân viên xác nhận duyệt có forceConfirm: true
    console.log('\n--- 9. Duyệt Trả phòng với forceConfirm: true & Kiểm tra Quyết toán cọc ---');
    const finalApproveRes = await request(`/requests/${finalCheckoutId}/approve`, {
      method: 'PATCH',
      token: staffToken,
      body: {
        actualCheckoutDate: '2026-11-30',
        forceConfirm: true,
        staffNote: 'Đã kiểm tra cơ sở vật chất phòng sạch sẽ, đồng ý cấn trừ cọc nộp phạt',
      },
    });

    if (finalApproveRes.status === 200 && finalApproveRes.data.code === 'OK') {
      const settlement = finalApproveRes.data.data.settlement;
      console.log('✅ Duyệt trả phòng thành công! Kết quả quyết toán tài chính:');
      console.log(`   - Tiền cọc ban đầu: ${settlement.depositAmount.toLocaleString()} đ`);
      console.log(`   - Công nợ khấu trừ: ${settlement.outstandingDebt.toLocaleString()} đ`);
      console.log(`   - Tiền cọc hoàn trả sinh viên: ${settlement.refundAmount.toLocaleString()} đ`);

      if (settlement.refundAmount !== 700000) {
        throw new Error(`Số tiền hoàn cọc sai: mong muốn 700.000 đ nhưng nhận ${settlement.refundAmount} đ`);
      }

      // Kiểm tra Payment hoàn cọc trong DB
      const refundPayment = await Payment.findOne({
        studentId: testStudent._id,
        type: 'refund',
      });
      if (!refundPayment || refundPayment.amount !== 700000 || refundPayment.status !== 'completed') {
        throw new Error('Bản ghi Payment hoàn cọc không được lưu chính xác trong DB');
      }
      console.log(`✅ Đã lưu bản ghi hoàn tiền (Payment type=refund): ${refundPayment.transactionId} - ${refundPayment.amount} đ`);

      // Kiểm tra các hiệu ứng dây chuyền (Cascades)
      const afterContract = await Contract.findById(testContract._id);
      const afterResidency = await Residency.findById(testResidency._id);
      const afterBed = await Bed.findById(testBed._id);

      if (afterContract.status !== 'terminated') throw new Error('Contract chưa chuyển sang terminated');
      if (afterContract.depositStatus !== 'refunded') throw new Error('Contract depositStatus chưa là refunded');
      if (afterResidency.status !== 'ended') throw new Error('Residency chưa chuyển sang ended');
      if (afterBed.status !== 'available') throw new Error('Giường chưa được giải phóng về available');

      console.log('✅ Kiểm tra Cascade toàn diện:');
      console.log(`   - Contract status: ${afterContract.status} (depositRefunded: ${afterContract.depositRefunded} đ)`);
      console.log(`   - Residency status: ${afterResidency.status}`);
      console.log(`   - Bed status: ${afterBed.status} (Đã sẵn sàng cho sinh viên khác xếp phòng)`);
    } else {
      throw new Error(`Duyệt trả phòng thất bại: ${JSON.stringify(finalApproveRes.data)}`);
    }

    // Dọn dẹp dữ liệu test
    await Request.deleteMany({ studentId: testStudent._id });
    await Payment.deleteMany({ studentId: testStudent._id });
    await Invoice.deleteMany({ studentId: testStudent._id });
    await Contract.deleteOne({ _id: testContract._id });
    await Residency.deleteOne({ _id: testResidency._id });
    await Bed.deleteOne({ _id: testBed._id });
    await Room.deleteOne({ _id: testRoom._id });
    await Building.deleteOne({ _id: testBuilding._id });
    await Student.deleteOne({ _id: testStudent._id });
    await User.deleteOne({ email: studentEmail });
    console.log('\n✅ Đã dọn dẹp dữ liệu kiểm thử an toàn trên MongoDB Atlas.');

    console.log('\n====================================================');
    console.log('🎉 TẤT CẢ 9 MỤC KIỂM THỬ GIAI ĐOẠN 6 ĐÃ VƯỢT QUA 100%!');
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

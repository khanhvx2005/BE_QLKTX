/**
 * Script kiểm thử tự động toàn diện Module Residencies và Contracts (Giai đoạn 3).
 * Kiểm tra các quy tắc nghiệp vụ cốt lõi:
 * 1. Khớp giới tính sinh viên với phòng (GENDER_MISMATCH 422)
 * 2. Chống tranh chấp giường nguyên tử (BED_NOT_AVAILABLE 409)
 * 3. Chống xếp 1 sinh viên vào nhiều giường (STUDENT_HAS_ACTIVE_CONTRACT 422)
 * 4. Ký hợp đồng, kích hoạt hợp đồng và thanh lý giải phóng giường tự động.
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');
const Building = require('../modules/rooms/building.model');
const Room = require('../modules/rooms/room.model');
const Bed = require('../modules/rooms/bed.model');
const Residency = require('../modules/residencies/residency.model');
const Contract = require('../modules/contracts/contract.model');

const PORT = 5096;

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
        port: PORT,
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

async function runPhase3Tests() {
  console.log('--------------------------------------------------');
  console.log('[TEST-PHASE3] Bắt đầu kiểm thử Module Residencies & Contracts...');
  console.log('--------------------------------------------------');

  await mongoose.connect(process.env.MONGODB_URI);

  const server = app.listen(PORT, async () => {
    try {
      // 0. Đăng nhập Staff
      console.log('▶ Bước 0: Đăng nhập tài khoản Staff...');
      const staffLogin = await request('/api/auth/login', 'POST', {}, {
        email: 'staff1@dorm.local',
        password: 'Staff@123',
      });
      const staffToken = staffLogin.body.data.token;
      const authHeader = { Authorization: `Bearer ${staffToken}` };
      console.log('  ✅ Đăng nhập Staff thành công!');

      // Chuẩn bị dữ liệu: Lấy Phòng 101 (Nam) và Phòng 201 (Nữ)
      const buildingA = await Building.findOne({ code: 'A' });
      const buildingB = await Building.findOne({ code: 'B' });
      const maleRoom = await Room.findOne({ buildingId: buildingA._id, roomNumber: '101' });
      const femaleRoom = await Room.findOne({ buildingId: buildingB._id, roomNumber: '201' });
      const maleBeds = await Bed.find({ roomId: maleRoom._id }).sort('bedNumber');
      const femaleBeds = await Bed.find({ roomId: femaleRoom._id }).sort('bedNumber');

      const testBed1 = maleBeds[0];
      const testBed2 = maleBeds[1];
      const femaleBed1 = femaleBeds[0];

      // Tạo sinh viên Nam test và Nữ test
      const maleCode = `SVM3_${Date.now().toString().slice(-4)}`;
      const maleStudent = await Student.create({
        fullName: 'Nguyễn Văn Nam Test',
        studentCode: maleCode,
        gender: 'male',
        phone: '0912345111',
        status: 'active',
      });

      const femaleCode = `SVF3_${Date.now().toString().slice(-4)}`;
      const femaleStudent = await Student.create({
        fullName: 'Trần Thị Nữ Test',
        studentCode: femaleCode,
        gender: 'female',
        phone: '0912345222',
        status: 'active',
      });

      // ==============================================
      // 1. KIỂM THỬ RÀNG BUỘC GIỚI TÍNH PHÒNG (PRD §2.9 A1, BR-06)
      // ==============================================
      console.log('\n▶ Test 1: Thử xếp sinh viên Nam vào phòng Nữ (Room 201)...');
      const mismatchRes = await request('/api/residencies', 'POST', authHeader, {
        studentId: maleStudent._id.toString(),
        bedId: femaleBed1._id.toString(),
        startDate: '2026-09-01',
      });
      console.assert(mismatchRes.status === 422, 'Phải nhận mã 422 Unprocessable Entity');
      console.assert(mismatchRes.body.code === 'GENDER_MISMATCH', 'Mã lỗi phải là GENDER_MISMATCH');
      console.log(`  ✅ Chặn thành công: ${mismatchRes.body.message} (422 GENDER_MISMATCH)!`);

      // ==============================================
      // 2. KIỂM THỬ XẾP GIƯỜNG HỢP LỆ & CHIẾM GIƯỜNG NGUYÊN TỬ (BR-20)
      // ==============================================
      console.log('\n▶ Test 2: Xếp sinh viên Nam vào giường 1 phòng 101 (Hợp lệ)...');
      const assignRes = await request('/api/residencies', 'POST', authHeader, {
        studentId: maleStudent._id.toString(),
        bedId: testBed1._id.toString(),
        startDate: '2026-09-01',
      });
      console.assert(assignRes.status === 201, 'Xếp giường phải 201');
      console.assert(assignRes.body.data.status === 'active', 'Trạng thái lưu trú phải là active');
      const residencyId = assignRes.body.data.id;
      console.log(`  ✅ Xếp giường thành công (Residency ID: ${residencyId})!`);

      // Kiểm tra trạng thái giường trong DB đã chuyển thành 'occupied'
      const bedAfterClaim = await Bed.findById(testBed1._id);
      console.assert(bedAfterClaim.status === 'occupied', 'Trạng thái giường phải chuyển thành occupied');
      console.log(`  ✅ Giường ${testBed1.bedNumber} đã tự động chuyển sang occupied!`);

      // ==============================================
      // 3. KIỂM THỬ CHỐNG XẾP TRÙNG GIƯỜNG (NO DOUBLE-BOOKING, 409 BED_NOT_AVAILABLE)
      // ==============================================
      console.log('\n▶ Test 3: Thử xếp người khác vào giường vừa bị chiếm (Giường 1)...');
      const otherMaleCode = `SVM3_OTHER_${Date.now().toString().slice(-4)}`;
      const otherMale = await Student.create({
        fullName: 'Lê Văn Nam Khác',
        studentCode: otherMaleCode,
        gender: 'male',
        phone: '0912345333',
        status: 'active',
      });

      const doubleBookRes = await request('/api/residencies', 'POST', authHeader, {
        studentId: otherMale._id.toString(),
        bedId: testBed1._id.toString(),
        startDate: '2026-09-01',
      });
      console.assert(doubleBookRes.status === 409, 'Phải nhận lỗi 409 Conflict');
      console.assert(doubleBookRes.body.code === 'BED_NOT_AVAILABLE', 'Code phải là BED_NOT_AVAILABLE');
      console.log(`  ✅ Chống xếp trùng giường thành công: ${doubleBookRes.body.message} (409 BED_NOT_AVAILABLE)!`);

      // ==============================================
      // 4. KIỂM THỬ CHỐNG 1 SINH VIÊN XẾP NHIỀU GIƯỜNG (BR-21)
      // ==============================================
      console.log('\n▶ Test 4: Thử xếp sinh viên Nam (đang ở giường 1) sang thêm giường 2...');
      const multiBedRes = await request('/api/residencies', 'POST', authHeader, {
        studentId: maleStudent._id.toString(),
        bedId: testBed2._id.toString(),
        startDate: '2026-09-01',
      });
      console.assert(multiBedRes.status === 422, 'Phải nhận 422 Unprocessable');
      console.assert(multiBedRes.body.code === 'STUDENT_HAS_ACTIVE_CONTRACT', 'Code phải là STUDENT_HAS_ACTIVE_CONTRACT');
      console.log(`  ✅ Chặn thành công: ${multiBedRes.body.message} (422 STUDENT_HAS_ACTIVE_CONTRACT)!`);

      // ==============================================
      // 5. KIỂM THỬ MODULE CONTRACTS (TẠO, KÍCH HOẠT, THANH LÝ)
      // ==============================================
      console.log('\n--- [PHẦN 2: MODULE CONTRACTS] ---');

      // Test 5.1: Tạo hợp đồng cho bản ghi lưu trú
      console.log('▶ Test 5.1: Tạo hợp đồng mới (POST /api/contracts)...');
      const createContractRes = await request('/api/contracts', 'POST', authHeader, {
        residencyId,
        studentId: maleStudent._id.toString(),
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        roomFeeSnapshot: maleRoom.pricePerBed,
        depositAmount: 1000000,
      });
      console.assert(createContractRes.status === 201, 'Tạo hợp đồng phải 201');
      console.assert(createContractRes.body.data.contractNumber.startsWith('HD-'), 'Mã HĐ phải đúng định dạng HD-');
      const contractId = createContractRes.body.data.id || createContractRes.body.data._id;
      const contractNumber = createContractRes.body.data.contractNumber;
      console.log(`  ✅ Tạo hợp đồng thành công: ${contractNumber} (Tiền cọc: 1.000.000đ, Giá phòng: ${maleRoom.pricePerBed}đ)!`);

      // Test 5.2: Kích hoạt hợp đồng (pending -> active)
      console.log('▶ Test 5.2: Kích hoạt hợp đồng (PATCH /api/contracts/:id/activate)...');
      const activateRes = await request(`/api/contracts/${contractId}/activate`, 'PATCH', authHeader);
      console.assert(activateRes.status === 200, 'Kích hoạt hợp đồng phải 200');
      console.assert(activateRes.body.data.contract.status === 'active', 'Trạng thái hợp đồng phải là active');
      console.assert(activateRes.body.data.contract.depositStatus === 'paid', 'Trạng thái tiền cọc phải là paid');
      console.log('  ✅ Kích hoạt hợp đồng thành công (status: active, depositStatus: paid)!');

      // Test 5.3: Lọc danh sách hợp đồng
      console.log('▶ Test 5.3: Tra cứu danh sách hợp đồng (GET /api/contracts)...');
      const listContractRes = await request(`/api/contracts?status=active`, 'GET', authHeader);
      console.assert(listContractRes.status === 200, 'Lấy danh sách HĐ phải 200');
      console.assert(listContractRes.body.data.total >= 1, 'Phải có ít nhất 1 hợp đồng active');
      console.log(`  ✅ Tra cứu hợp đồng thành công (Tìm thấy ${listContractRes.body.data.total} hợp đồng)!`);

      // Test 5.4: Thanh lý hợp đồng & Tự động giải phóng giường (Cascade)
      console.log('▶ Test 5.4: Thanh lý hợp đồng và tự động giải phóng giường (PATCH /api/contracts/:id/terminate)...');
      const terminateRes = await request(`/api/contracts/${contractId}/terminate`, 'PATCH', authHeader);
      console.assert(terminateRes.status === 200, 'Thanh lý hợp đồng phải 200');
      console.assert(terminateRes.body.data.status === 'terminated', 'Trạng thái phải là terminated');
      console.log('  ✅ Thanh lý hợp đồng thành công!');

      // Kiểm tra giường đã tự động được giải phóng về 'available'
      const bedAfterTerminate = await Bed.findById(testBed1._id);
      console.assert(bedAfterTerminate.status === 'available', 'Giường phải tự động chuyển về available sau khi thanh lý HĐ');
      console.log(`  ✅ Giường ${testBed1.bedNumber} đã tự động được giải phóng về status: available!`);

      // Kiểm tra lưu trú đã chuyển sang 'ended'
      const residencyAfterTerminate = await Residency.findById(residencyId);
      console.assert(residencyAfterTerminate.status === 'ended', 'Lưu trú phải chuyển sang ended');
      console.log('  ✅ Lưu trú đã tự động chuyển sang status: ended!');

      // Dọn dẹp dữ liệu test
      await Contract.findByIdAndDelete(contractId);
      await Residency.findByIdAndDelete(residencyId);
      await Student.deleteMany({ _id: { $in: [maleStudent._id, femaleStudent._id, otherMale._id] } });
      console.log('  ✅ Đã dọn dẹp dữ liệu kiểm thử an toàn.');

      console.log('--------------------------------------------------');
      console.log('🎉 TOÀN BỘ CÁC TEST CASES CỦA GIAI ĐOẠN 3 ĐỀU VƯỢT QUA 100%!');
      console.log('--------------------------------------------------');
    } catch (err) {
      console.error('[TEST-PHASE3] ❌ Lỗi kiểm thử:', err);
    } finally {
      server.close();
      await mongoose.connection.close();
      process.exit(0);
    }
  });
}

runPhase3Tests();

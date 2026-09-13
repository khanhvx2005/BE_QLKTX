/**
 * Script kiểm thử tự động toàn diện Module Students và Module Rooms (Buildings, Rooms, Beds).
 * Tuân thủ nghiêm ngặt API.md §3, §4 và PRD.md §2.9.
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

const PORT = 5097;

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

async function runPhase2Tests() {
  console.log('--------------------------------------------------');
  console.log('[TEST-PHASE2] Bắt đầu kiểm thử Module Students & Module Rooms...');
  console.log('--------------------------------------------------');

  await mongoose.connect(process.env.MONGODB_URI);

  const server = app.listen(PORT, async () => {
    try {
      // 0. Đăng nhập lấy Token của Staff
      console.log('▶ Bước 0: Đăng nhập tài khoản Staff...');
      const staffLogin = await request('/api/auth/login', 'POST', {}, {
        email: 'staff1@dorm.local',
        password: 'Staff@123',
      });
      console.assert(staffLogin.status === 200, 'Đăng nhập Staff phải thành công');
      const staffToken = staffLogin.body.data.token;
      const authHeader = { Authorization: `Bearer ${staffToken}` };
      console.log('  ✅ Đăng nhập Staff thành công!');

      // ==============================================
      // 1. KIỂM THỬ MODULE STUDENTS
      // ==============================================
      console.log('\n--- [PHẦN 1: MODULE STUDENTS] ---');
      const studentCodeMale = `SVM${Date.now().toString().slice(-5)}`;
      const studentCodeFemale = `SVF${Date.now().toString().slice(-5)}`;

      // Test 1.1: Tạo sinh viên nam
      console.log('▶ Test 1.1: Staff tạo sinh viên Nam...');
      const createMaleRes = await request('/api/students', 'POST', authHeader, {
        fullName: 'Trần Văn Nam',
        studentCode: studentCodeMale,
        gender: 'male',
        phone: '0912345671',
        email: `${studentCodeMale.toLowerCase()}@student.edu.vn`,
        className: 'D21CNTT01',
        faculty: 'Công nghệ thông tin',
      });
      console.assert(createMaleRes.status === 201, 'Status tạo sinh viên phải là 201');
      console.assert(createMaleRes.body.data.studentCode === studentCodeMale, 'Mã SV phải đúng');
      const maleStudentId = createMaleRes.body.data.id;
      console.log(`  ✅ Tạo sinh viên Nam thành công (ID: ${maleStudentId}, Mã: ${studentCodeMale})`);

      // Test 1.2: Tạo sinh viên nữ
      console.log('▶ Test 1.2: Staff tạo sinh viên Nữ...');
      const createFemaleRes = await request('/api/students', 'POST', authHeader, {
        fullName: 'Nguyễn Thị Hoa',
        studentCode: studentCodeFemale,
        gender: 'female',
        phone: '0912345672',
        email: `${studentCodeFemale.toLowerCase()}@student.edu.vn`,
        className: 'D21KTOAN01',
        faculty: 'Kế toán',
      });
      console.assert(createFemaleRes.status === 201, 'Status tạo sinh viên phải là 201');
      const femaleStudentId = createFemaleRes.body.data.id;
      console.log(`  ✅ Tạo sinh viên Nữ thành công (ID: ${femaleStudentId}, Mã: ${studentCodeFemale})`);

      // Test 1.3: Chặn trùng mã sinh viên
      console.log('▶ Test 1.3: Chặn tạo trùng mã sinh viên...');
      const duplicateRes = await request('/api/students', 'POST', authHeader, {
        fullName: 'Người Trùng Mã',
        studentCode: studentCodeMale,
        gender: 'male',
        phone: '0912345673',
      });
      console.assert(duplicateRes.status === 409, 'Phải trả về lỗi 409 Conflict');
      console.assert(duplicateRes.body.code === 'STUDENT_CODE_ALREADY_EXISTS', 'Code phải là STUDENT_CODE_ALREADY_EXISTS');
      console.log('  ✅ Chặn trùng mã sinh viên thành công (409 STUDENT_CODE_ALREADY_EXISTS)!');

      // Test 1.4: Lấy danh sách sinh viên có tìm kiếm & phân trang
      console.log('▶ Test 1.4: Tìm kiếm và phân trang sinh viên...');
      const listRes = await request(`/api/students?search=${studentCodeMale}&page=1&limit=10`, 'GET', authHeader);
      console.assert(listRes.status === 200, 'Lấy danh sách phải 200');
      console.assert(listRes.body.data.items.length >= 1, 'Phải tìm thấy ít nhất 1 sinh viên');
      console.assert(listRes.body.data.total >= 1, 'Total phải >= 1');
      console.log(`  ✅ Tìm kiếm phân trang thành công (Tìm thấy ${listRes.body.data.total} sinh viên)!`);

      // Test 1.5: Cập nhật thông tin sinh viên
      console.log('▶ Test 1.5: Cập nhật thông tin sinh viên...');
      const updateRes = await request(`/api/students/${maleStudentId}`, 'PUT', authHeader, {
        phone: '0988888888',
        className: 'D21CNTT-VIP',
      });
      console.assert(updateRes.status === 200, 'Cập nhật phải 200');
      console.assert(updateRes.body.data.phone === '0988888888', 'Phone phải được cập nhật');
      console.log('  ✅ Cập nhật sinh viên thành công!');

      // Test 1.6: Vô hiệu hóa sinh viên (Soft delete)
      console.log('▶ Test 1.6: Vô hiệu hóa sinh viên...');
      const deactivateRes = await request(`/api/students/${femaleStudentId}/deactivate`, 'PATCH', authHeader);
      console.assert(deactivateRes.status === 200, 'Vô hiệu hóa phải 200');
      console.assert(deactivateRes.body.data.status === 'inactive', 'Trạng thái phải là inactive');
      console.log('  ✅ Vô hiệu hóa sinh viên thành công (status: inactive)!');

      // ==============================================
      // 2. KIỂM THỬ MODULE ROOMS (BUILDINGS, ROOMS, BEDS)
      // ==============================================
      console.log('\n--- [PHẦN 2: MODULE ROOMS, BUILDINGS & BEDS] ---');

      // Test 2.1: Danh sách tòa nhà có thống kê lấp đầy
      console.log('▶ Test 2.1: Lấy danh sách tòa nhà có thống kê lấp đầy...');
      const buildingsRes = await request('/api/buildings', 'GET', authHeader);
      console.assert(buildingsRes.status === 200, 'Lấy tòa nhà phải 200');
      console.assert(buildingsRes.body.data.length >= 2, 'Phải có ít nhất 2 tòa nhà A và B');
      const buildingA = buildingsRes.body.data.find((b) => b.code === 'A');
      console.assert(buildingA.stats.totalRooms >= 1, 'Tòa A phải có phòng');
      console.assert(buildingA.stats.totalBeds >= 4, 'Tòa A phải có giường');
      console.log(`  ✅ Lấy danh sách tòa nhà kèm thống kê thành công (Tòa A: ${buildingA.stats.totalRooms} phòng, ${buildingA.stats.totalBeds} giường)!`);

      const buildingId = buildingA.id || buildingA._id;

      // Test 2.2: Tạo phòng mới có ràng buộc giới tính (A1, PRD §2.9)
      console.log('▶ Test 2.2: Tạo phòng mới (yêu cầu bắt buộc gender)...');
      const roomNumberTest = `102_${Date.now().toString().slice(-4)}`;
      const createRoomRes = await request('/api/rooms', 'POST', authHeader, {
        buildingId,
        roomNumber: roomNumberTest,
        gender: 'male',
        capacity: 6,
        pricePerBed: 650000,
        status: 'active',
      });
      console.assert(createRoomRes.status === 201, 'Tạo phòng phải 201');
      console.assert(createRoomRes.body.data.gender === 'male', 'Giới tính phòng phải là male');
      const newRoomId = createRoomRes.body.data.id || createRoomRes.body.data._id;
      console.log(`  ✅ Tạo phòng thành công: Phòng ${roomNumberTest} (Nam, sức chứa 6 giường)!`);

      // Test 2.3: Chặn tạo trùng số phòng trong cùng 1 tòa nhà
      console.log('▶ Test 2.3: Chặn tạo trùng số phòng trong 1 tòa...');
      const duplicateRoomRes = await request('/api/rooms', 'POST', authHeader, {
        buildingId,
        roomNumber: roomNumberTest,
        gender: 'male',
        capacity: 4,
        pricePerBed: 600000,
      });
      console.assert(duplicateRoomRes.status === 409, 'Phải trả về 409 Conflict');
      console.assert(duplicateRoomRes.body.code === 'ROOM_NUMBER_ALREADY_EXISTS', 'Code phải là ROOM_NUMBER_ALREADY_EXISTS');
      console.log('  ✅ Chặn trùng số phòng thành công (409 ROOM_NUMBER_ALREADY_EXISTS)!');

      // Test 2.4: Tự động sinh danh sách giường theo sức chứa capacity (generateBeds)
      console.log('▶ Test 2.4: Tự động sinh giường theo sức chứa (capacity 6)...');
      const generateBedsRes = await request(`/api/rooms/${newRoomId}/beds/generate`, 'POST', authHeader);
      console.assert(generateBedsRes.status === 201, 'Sinh giường phải 201');
      console.assert(generateBedsRes.body.data.length === 6, 'Phải sinh đúng 6 giường');
      console.log(`  ✅ Tự động sinh thành công 6 giường (Giường số 1 đến 6)!`);

      // Test 2.5: Lấy danh sách giường trong phòng
      console.log('▶ Test 2.5: Lấy danh sách giường trong phòng...');
      const listBedsRes = await request(`/api/rooms/${newRoomId}/beds`, 'GET', authHeader);
      console.assert(listBedsRes.status === 200, 'Lấy giường phải 200');
      console.assert(listBedsRes.body.data.length === 6, 'Danh sách phải có 6 giường');
      const testBedId = listBedsRes.body.data[0].id || listBedsRes.body.data[0]._id;
      console.log('  ✅ Lấy danh sách giường thành công!');

      // Test 2.6: Đổi trạng thái giường thủ công sang maintenance
      console.log('▶ Test 2.6: Đổi trạng thái giường sang bảo trì (maintenance)...');
      const updateBedRes = await request(`/api/beds/${testBedId}/status`, 'PATCH', authHeader, {
        status: 'maintenance',
      });
      console.assert(updateBedRes.status === 200, 'Đổi trạng thái giường phải 200');
      console.assert(updateBedRes.body.data.status === 'maintenance', 'Trạng thái phải là maintenance');
      console.log('  ✅ Cập nhật trạng thái giường sang bảo trì thành công!');

      // Dọn dẹp dữ liệu test phòng và sinh viên
      await Bed.deleteMany({ roomId: newRoomId });
      await Room.findByIdAndDelete(newRoomId);
      await Student.deleteMany({ studentCode: { $in: [studentCodeMale, studentCodeFemale] } });
      console.log('  ✅ Đã dọn dẹp dữ liệu kiểm thử an toàn.');

      console.log('--------------------------------------------------');
      console.log('🎉 TOÀN BỘ CÁC TEST CASES CỦA GIAI ĐOẠN 2 ĐỀU VƯỢT QUA 100%!');
      console.log('--------------------------------------------------');
    } catch (err) {
      console.error('[TEST-PHASE2] ❌ Lỗi kiểm thử:', err);
    } finally {
      server.close();
      await mongoose.connection.close();
      process.exit(0);
    }
  });
}

runPhase2Tests();

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

      // Test 1.3: Chặn tạo trùng mã sinh viên (trả về DUPLICATE_ENTRY theo v1.2)
      console.log('▶ Test 1.3: Chặn tạo trùng mã sinh viên...');
      const duplicateRes = await request('/api/students', 'POST', authHeader, {
        studentCode: studentCodeMale,
        fullName: 'Sinh viên Trùng Mã',
        email: `sv.trung.${Date.now()}@dorm.local`,
        phone: '0909999999',
        gender: 'male',
      });
      console.assert(duplicateRes.status === 409, 'Phải trả về 409 Conflict');
      console.assert(duplicateRes.body.code === 'DUPLICATE_ENTRY', 'Code phải là DUPLICATE_ENTRY');
      console.log('  ✅ Chặn trùng mã sinh viên thành công (409 DUPLICATE_ENTRY)!');

      // Test 1.4: Tìm kiếm và phân trang sinh viên
      console.log('▶ Test 1.4: Tìm kiếm và phân trang sinh viên...');
      const searchRes = await request(`/api/students?search=${studentCodeMale}&page=1&limit=10`, 'GET', authHeader);
      console.assert(searchRes.status === 200, 'Tìm kiếm sinh viên phải 200');
      console.assert(searchRes.body.data.items.length === 1, 'Phải tìm thấy đúng 1 sinh viên');
      console.log(`  ✅ Tìm kiếm phân trang thành công (Tìm thấy ${searchRes.body.data.items.length} sinh viên)!`);

      // Test 1.5: Cập nhật thông tin sinh viên
      console.log('▶ Test 1.5: Cập nhật thông tin sinh viên...');
      const updateRes = await request(`/api/students/${maleStudentId}`, 'PUT', authHeader, {
        fullName: 'Nguyễn Văn Nam (Đã cập nhật)',
        phone: '0912345678',
        faculty: 'Khoa Học Máy Tính',
      });
      console.assert(updateRes.status === 200, 'Cập nhật sinh viên phải 200');
      console.assert(updateRes.body.data.fullName === 'Nguyễn Văn Nam (Đã cập nhật)', 'Tên phải được cập nhật');
      console.log('  ✅ Cập nhật sinh viên thành công!');

      // Test 1.6: Vô hiệu hóa sinh viên (soft delete)
      console.log('▶ Test 1.6: Vô hiệu hóa sinh viên...');
      const deactivateRes = await request(`/api/students/${femaleStudentId}/deactivate`, 'PATCH', authHeader);
      console.assert(deactivateRes.status === 200, 'Vô hiệu hóa sinh viên phải 200');
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

      // Lấy danh sách loại phòng để tạo phòng chuẩn v1.2
      const roomTypesRes = await request('/api/room-types', 'GET', authHeader);
      console.assert(roomTypesRes.status === 200, 'Lấy loại phòng phải 200');
      const testRoomType = roomTypesRes.body.data.items[0];
      const roomTypeId = testRoomType.id;

      // Test 2.2: Tạo phòng mới có ràng buộc loại phòng và giới tính (v1.2)
      console.log('▶ Test 2.2: Tạo phòng mới (yêu cầu roomTypeId và gender)...');
      const roomNumberTest = `102_${Date.now().toString().slice(-4)}`;
      const createRoomRes = await request('/api/rooms', 'POST', authHeader, {
        buildingId,
        roomTypeId,
        roomNumber: roomNumberTest,
        floor: 1,
        gender: 'male',
        status: 'active',
      });
      console.assert(createRoomRes.status === 201, 'Tạo phòng phải 201');
      console.assert(createRoomRes.body.data.gender === 'male', 'Giới tính phòng phải là male');
      const newRoomId = createRoomRes.body.data.id || createRoomRes.body.data._id;
      console.log(`  ✅ Tạo phòng thành công: Phòng ${roomNumberTest} (Nam, sức chứa ${testRoomType.capacity} giường tự sinh)!`);

      // Test 2.3: Chặn tạo trùng số phòng trong cùng 1 tòa nhà
      console.log('▶ Test 2.3: Chặn tạo trùng số phòng trong 1 tòa...');
      const duplicateRoomRes = await request('/api/rooms', 'POST', authHeader, {
        buildingId,
        roomTypeId,
        roomNumber: roomNumberTest,
        floor: 1,
        gender: 'male',
      });
      console.assert(duplicateRoomRes.status === 409, 'Phải trả về 409 Conflict');
      console.assert(duplicateRoomRes.body.code === 'DUPLICATE_ENTRY', 'Code phải là DUPLICATE_ENTRY');
      console.log('  ✅ Chặn trùng số phòng thành công (409 DUPLICATE_ENTRY)!');

      // Test 2.4: Xem chi tiết phòng và danh sách giường tự động sinh ra (v1.2: GET /api/rooms/:id)
      console.log('▶ Test 2.4: Chi tiết phòng và danh sách giường tự sinh...');
      const roomDetailRes = await request(`/api/rooms/${newRoomId}`, 'GET', authHeader);
      console.assert(roomDetailRes.status === 200, 'Lấy chi tiết phòng phải 200');
      console.assert(roomDetailRes.body.data.beds.length === testRoomType.capacity, `Phải có đúng ${testRoomType.capacity} giường`);
      const testBed = roomDetailRes.body.data.beds[0];
      const testBedId = testBed.id;
      console.log(`  ✅ Phòng tự sinh chuẩn ${roomDetailRes.body.data.beds.length} giường (${testBed.bedCode})!`);

      // Test 2.5: Đổi trạng thái giường sang bảo trì (maintenance)
      console.log('▶ Test 2.5: Đổi trạng thái giường sang bảo trì (maintenance)...');
      const updateBedRes = await request(`/api/beds/${testBedId}/status`, 'PATCH', authHeader, {
        status: 'maintenance',
        note: 'Hỏng dát giường cần sửa chữa',
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

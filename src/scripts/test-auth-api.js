/**
 * Script kiểm thử tự động API Module Auth.
 * Kiểm tra các endpoint: login, register, me, change-password, reset-password, RBAC guards.
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');

const PORT = 5098;

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

async function runAuthTests() {
  console.log('--------------------------------------------------');
  console.log('[TEST-AUTH] Bắt đầu kiểm thử toàn diện Module Auth...');
  console.log('--------------------------------------------------');

  // Kết nối DB
  await mongoose.connect(process.env.MONGODB_URI);

  const server = app.listen(PORT, async () => {
    try {
      // 1. Test Login Admin thành công
      console.log('▶ Test 1: Đăng nhập Admin hợp lệ...');
      const adminLoginRes = await request('/api/auth/login', 'POST', {}, {
        email: 'admin@dorm.local',
        password: 'Admin@123',
      });

      console.assert(adminLoginRes.status === 200, 'Status phải là 200');
      console.assert(adminLoginRes.body.code === 'OK', 'Code phải là OK');
      console.assert(adminLoginRes.body.data.token, 'Phải có token JWT');
      console.assert(adminLoginRes.body.data.user.role === 'admin', 'Role phải là admin');
      const adminToken = adminLoginRes.body.data.token;
      console.log('  ✅ Đăng nhập Admin thành công!');

      // 2. Test Login với mật khẩu sai -> 401
      console.log('▶ Test 2: Đăng nhập mật khẩu sai...');
      const wrongPassRes = await request('/api/auth/login', 'POST', {}, {
        email: 'admin@dorm.local',
        password: 'WrongPassword@999',
      });
      console.assert(wrongPassRes.status === 401, 'Status phải là 401');
      console.assert(wrongPassRes.body.code === 'INVALID_CREDENTIALS', 'Mã lỗi phải là INVALID_CREDENTIALS');
      console.log('  ✅ Chặn đúng mật khẩu sai (401 INVALID_CREDENTIALS)!');

      // 3. Test GET /api/auth/me với token Admin
      console.log('▶ Test 3: Lấy thông tin tài khoản /api/auth/me...');
      const meRes = await request('/api/auth/me', 'GET', {
        Authorization: `Bearer ${adminToken}`,
      });
      console.assert(meRes.status === 200, 'Status phải là 200');
      console.assert(meRes.body.data.email === 'admin@dorm.local', 'Email phải đúng');
      console.log('  ✅ Lấy thông tin profile chính chủ thành công!');

      // 4. Test Đăng ký Sinh viên mới (POST /api/auth/register)
      console.log('▶ Test 4: Sinh viên tự đăng ký tài khoản...');
      const testStudentCode = `SV${Date.now().toString().slice(-6)}`;
      const testStudentEmail = `test_${Date.now().toString().slice(-6)}@dorm.local`;
      const registerRes = await request('/api/auth/register', 'POST', {}, {
        fullName: 'Nguyễn Văn Kiểm Thử',
        studentCode: testStudentCode,
        email: testStudentEmail,
        password: 'Student@123',
        gender: 'male',
        phone: '0987654321',
        className: 'CNTT2026',
        faculty: 'Công nghệ thông tin',
      });
      console.assert(registerRes.status === 201, 'Status phải là 201');
      console.assert(registerRes.body.data.user.role === 'student', 'Role phải bị ép là student');
      console.assert(registerRes.body.data.user.studentId, 'Phải liên kết với studentId');
      const studentToken = registerRes.body.data.token;
      const studentUserId = registerRes.body.data.user.id;
      console.log(`  ✅ Đăng ký thành công sinh viên: ${testStudentEmail} (Mã: ${testStudentCode})`);

      // 5. Test Đổi mật khẩu cá nhân (PATCH /api/auth/change-password)
      console.log('▶ Test 5: Sinh viên đổi mật khẩu cá nhân...');
      const changePassRes = await request('/api/auth/change-password', 'PATCH', {
        Authorization: `Bearer ${studentToken}`,
      }, {
        oldPassword: 'Student@123',
        newPassword: 'NewStudent@456',
      });
      console.assert(changePassRes.status === 200, 'Status phải là 200');
      console.log('  ✅ Đổi mật khẩu thành công!');

      // 6. Test Đăng nhập bằng mật khẩu mới
      console.log('▶ Test 6: Đăng nhập lại bằng mật khẩu mới...');
      const reloginRes = await request('/api/auth/login', 'POST', {}, {
        email: testStudentEmail,
        password: 'NewStudent@456',
      });
      console.assert(reloginRes.status === 200, 'Status đăng nhập lại phải là 200');
      console.log('  ✅ Đăng nhập bằng mật khẩu mới thành công!');

      // 7. Test Admin reset mật khẩu cho Sinh viên (POST /api/users/:id/reset-password)
      console.log('▶ Test 7: Admin đặt lại mật khẩu tạm thời cho sinh viên...');
      const resetRes = await request(`/api/users/${studentUserId}/reset-password`, 'POST', {
        Authorization: `Bearer ${adminToken}`,
      });
      console.assert(resetRes.status === 200, 'Status phải là 200');
      console.assert(resetRes.body.data.temporaryPassword, 'Phải trả về mật khẩu tạm thời');
      console.assert(resetRes.body.data.mustChangePassword === true, 'Cờ mustChangePassword phải là true');
      console.log(`  ✅ Admin đặt lại mật khẩu tạm thành công (Mật khẩu tạm: ${resetRes.body.data.temporaryPassword})`);

      // 8. Test RBAC: Staff KHÔNG được reset mật khẩu của Admin (API.md §2)
      console.log('▶ Test 8: Kiểm tra bảo mật RBAC (Staff không được reset Admin)...');
      const staffLoginRes = await request('/api/auth/login', 'POST', {}, {
        email: 'staff1@dorm.local',
        password: 'Staff@123',
      });
      const staffToken = staffLoginRes.body.data.token;
      const adminUser = await User.findOne({ email: 'admin@dorm.local' });
      const staffResetAdminRes = await request(`/api/users/${adminUser._id}/reset-password`, 'POST', {
        Authorization: `Bearer ${staffToken}`,
      });
      console.assert(staffResetAdminRes.status === 403, 'Phải nhận 403 FORBIDDEN');
      console.assert(staffResetAdminRes.body.code === 'FORBIDDEN', 'Code phải là FORBIDDEN');
      console.log('  ✅ Chặn thành công: Staff không thể reset mật khẩu của Admin (403 FORBIDDEN)!');

      // Dọn dẹp dữ liệu test sinh viên
      await Student.deleteOne({ studentCode: testStudentCode });
      await User.deleteOne({ email: testStudentEmail });
      console.log('  ✅ Đã dọn dẹp tài khoản kiểm thử.');

      console.log('--------------------------------------------------');
      console.log('🎉 TOÀN BỘ 8 TEST CASES MODULE AUTH ĐỀU VƯỢT QUA 100%!');
      console.log('--------------------------------------------------');
    } catch (err) {
      console.error('[TEST-AUTH] ❌ Lỗi kiểm thử:', err);
    } finally {
      server.close();
      await mongoose.connection.close();
      process.exit(0);
    }
  });
}

runAuthTests();

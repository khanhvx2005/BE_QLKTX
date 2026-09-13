/**
 * Kịch bản kiểm thử tự động Giai đoạn 7: Dashboard & Analytics.
 * Tuân thủ theo API.md §11.
 *
 * Kiểm tra:
 * 1. Phân quyền RBAC: Sinh viên truy cập Dashboard bị chặn 403 FORBIDDEN.
 * 2. Nhân viên và Viewer truy cập thành công HTTP 200.
 * 3. GET /api/dashboard/occupancy:
 *    - Toàn hệ thống (overall) và từng tòa nhà (byBuilding).
 *    - Ràng buộc: total = occupied + available + maintenance.
 * 4. GET /api/dashboard/summary:
 *    - Số liệu lấp đầy (occupancy).
 *    - Tài chính: Tổng doanh thu (totalRevenue), Tổng nợ (totalOutstandingDebt), Hóa đơn quá hạn (overdueInvoiceCount).
 *    - Hàng đợi vận hành của Staff: Yêu cầu chờ duyệt (pendingRequests), Hợp đồng sắp hết hạn 30 ngày (expiringContracts).
 * 5. GET /api/dashboard/revenue: Dữ liệu vẽ biểu đồ doanh thu theo tháng.
 */

const http = require('http');
require('dotenv').config();

const app = require('../app');
const { connectDatabase } = require('../core/config/database');
const Student = require('../modules/students/student.model');

let server;
let baseURL;

const runTests = async () => {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 7: DASHBOARD & STATS');
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
  let viewerToken;
  let studentToken;

  try {
    // 1. Đăng nhập các role
    console.log('--- 1. Đăng nhập các vai trò & Kiểm tra phân quyền RBAC ---');
    const staffLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'staff1@dorm.local', password: 'Staff@123' },
    });
    staffToken = staffLogin.data.data.token;
    console.log('✅ Đăng nhập Staff thành công');

    const viewerLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'viewer@dorm.local', password: 'Viewer@123' },
    });
    viewerToken = viewerLogin.data.data.token;
    console.log('✅ Đăng nhập Viewer thành công');

    // Tạo hoặc đăng nhập tài khoản sinh viên
    const studentLogin = await request('/auth/register', {
      method: 'POST',
      body: {
        email: `student.dash.${Date.now()}@dorm.local`,
        password: 'Password@123',
        fullName: 'Trần Thị Thu',
        studentCode: `SVD${Date.now().toString().slice(-5)}`,
        gender: 'female',
        phone: '0912345678',
      },
    });
    studentToken = studentLogin.data.data.token;
    console.log('✅ Đăng nhập Sinh viên thành công');

    // 2. Kiểm tra Sinh viên bị chặn 403 khi vào Dashboard
    console.log('\n--- 2. Kiểm tra chặn Sinh viên truy cập Dashboard (403 FORBIDDEN) ---');
    const forbiddenRes = await request('/dashboard/summary', { token: studentToken });
    if (forbiddenRes.status === 403 && forbiddenRes.data.code === 'FORBIDDEN') {
      console.log(`✅ Chặn thành công sinh viên truy cập Dashboard (403 FORBIDDEN): ${forbiddenRes.data.message}`);
    } else {
      throw new Error(`Lẽ ra phải chặn sinh viên truy cập Dashboard, nhận: ${JSON.stringify(forbiddenRes)}`);
    }

    // 3. Kiểm tra GET /api/dashboard/occupancy
    console.log('\n--- 3. Kiểm thử Thống kê Lập đầy (GET /api/dashboard/occupancy) ---');
    const occupancyRes = await request('/dashboard/occupancy', { token: staffToken });
    if (occupancyRes.status === 200 && occupancyRes.data.code === 'OK') {
      const { overall, byBuilding } = occupancyRes.data.data;
      console.log('✅ Lấy thống kê tỷ lệ lấp đầy thành công:');
      console.log(`   - Tổng số giường: ${overall.total}`);
      console.log(`   - Giường đang ở (occupied): ${overall.occupied}`);
      console.log(`   - Giường còn trống (available): ${overall.available}`);
      console.log(`   - Giường bảo trì (maintenance): ${overall.maintenance}`);
      console.log(`   - Tỷ lệ lấp đầy (rate): ${(overall.rate * 100).toFixed(0)}%`);

      // Kiểm tra bất biến: total = occupied + available + maintenance
      if (overall.total !== overall.occupied + overall.available + overall.maintenance) {
        throw new Error('Ràng buộc total = occupied + available + maintenance bị vi phạm!');
      }
      console.log('✅ Bất biến tổng số giường thỏa mãn 100% (total = occupied + available + maintenance)');

      console.log(`   - Số lượng tòa nhà thống kê: ${byBuilding.length} tòa`);
      byBuilding.forEach((b) => {
        if (b.total !== b.occupied + b.available + b.maintenance) {
          throw new Error(`Tòa ${b.buildingCode} vi phạm tổng giường!`);
        }
        console.log(`     + ${b.buildingName} (${b.gender === 'male' ? 'Nam' : 'Nữ'}): ${b.occupied}/${b.total} giường (${(b.rate * 100).toFixed(0)}%)`);
      });
    } else {
      throw new Error(`Lấy occupancy thất bại: ${JSON.stringify(occupancyRes.data)}`);
    }

    // 4. Kiểm tra GET /api/dashboard/summary (Viewer cũng xem được)
    console.log('\n--- 4. Kiểm thử Báo cáo Vận hành Tổng quan (GET /api/dashboard/summary) ---');
    const summaryRes = await request('/dashboard/summary', { token: viewerToken });
    if (summaryRes.status === 200 && summaryRes.data.code === 'OK') {
      const { occupancy, finance, queue } = summaryRes.data.data;
      console.log('✅ Lấy dữ liệu tổng quan Dashboard thành công (Viewer quyền đọc):');
      console.log('   [Lấp đầy]:');
      console.log(`     - Tổng số giường: ${occupancy.totalBeds}, Đang ở: ${occupancy.occupiedBeds}, Trống: ${occupancy.availableBeds}`);
      console.log(`     - Tỷ lệ lấp đầy: ${(occupancy.occupancyRate * 100).toFixed(0)}%`);
      console.log('   [Tài chính & Công nợ]:');
      console.log(`     - Tổng doanh thu thực tế đã thu: ${finance.totalRevenue.toLocaleString('vi-VN')} đ`);
      console.log(`     - Tổng nợ chưa thanh toán: ${finance.totalOutstandingDebt.toLocaleString('vi-VN')} đ`);
      console.log(`     - Số hóa đơn quá hạn: ${finance.overdueInvoiceCount}`);
      console.log('   [Hàng đợi xử lý của Staff]:');
      console.log(`     - Yêu cầu SV chờ duyệt (Requests): ${queue.pendingRequests}`);
      console.log(`     - Hợp đồng sắp hết hạn trong 30 ngày: ${queue.expiringContracts}`);
    } else {
      throw new Error(`Lấy summary thất bại: ${JSON.stringify(summaryRes.data)}`);
    }

    // 5. Kiểm tra GET /api/dashboard/revenue
    console.log('\n--- 5. Kiểm thử Dữ liệu Biểu đồ Doanh thu (GET /api/dashboard/revenue) ---');
    const revenueRes = await request('/dashboard/revenue?months=6', { token: staffToken });
    if (revenueRes.status === 200 && revenueRes.data.code === 'OK' && Array.isArray(revenueRes.data.data)) {
      console.log(`✅ Lấy dữ liệu biểu đồ doanh thu thành công: ${revenueRes.data.data.length} mốc thời gian`);
      revenueRes.data.data.forEach((p) => {
        console.log(`   - Kỳ ${p.period}: ${p.revenue.toLocaleString('vi-VN')} đ (${p.transactionCount} giao dịch)`);
      });
    } else {
      throw new Error(`Lấy revenue thất bại: ${JSON.stringify(revenueRes.data)}`);
    }

    // Dọn dẹp sinh viên test
    await Student.deleteOne({ studentCode: studentLogin.data.data.user.studentCode });

    console.log('\n====================================================');
    console.log('🎉 TẤT CẢ 5 MỤC KIỂM THỬ GIAI ĐOẠN 7 ĐÃ VƯỢT QUA 100%!');
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

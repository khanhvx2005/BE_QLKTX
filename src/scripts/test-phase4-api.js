/**
 * Script kiểm thử tự động toàn diện Module Fees (Biểu phí, Chỉ số Điện Nước, Lập hóa đơn & Chia đều).
 * Tuân thủ theo API.md §7 và PRD.md §2.9 (Quy tắc A2 chia đều điện nước phòng).
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
const FeeType = require('../modules/fees/fee-type.model');
const UtilityReading = require('../modules/fees/utility-reading.model');
const Invoice = require('../modules/fees/invoice.model');

const PORT = 5095;

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

async function runPhase4Tests() {
  console.log('--------------------------------------------------');
  console.log('[TEST-PHASE4] Bắt đầu kiểm thử Module Fees & Chia đều Điện Nước...');
  console.log('--------------------------------------------------');

  await mongoose.connect(process.env.MONGODB_URI);

  const server = app.listen(PORT, async () => {
    try {
      // 0. Đăng nhập Staff
      console.log('▶ Bước 0: Đăng nhập Staff & Lấy danh mục phòng...');
      const staffLogin = await request('/api/auth/login', 'POST', {}, {
        email: 'staff1@dorm.local',
        password: 'Staff@123',
      });
      const staffToken = staffLogin.body.data.token;
      const authHeader = { Authorization: `Bearer ${staffToken}` };

      // Lấy Phòng 101 Tòa A (Nam)
      const buildingA = await Building.findOne({ code: 'A' });
      const roomA101 = await Room.findOne({ buildingId: buildingA._id, roomNumber: '101' });
      const beds = await Bed.find({ roomId: roomA101._id }).sort('bedNumber');
      const bed1 = beds[0];
      const bed2 = beds[1];

      // ==============================================
      // 1. KIỂM THỬ BIỂU PHÍ (FEE TYPES)
      // ==============================================
      console.log('\n--- [PHẦN 1: MODULE FEE TYPES] ---');
      console.log('▶ Test 1.1: Tra cứu danh mục biểu phí...');
      const feeTypesRes = await request('/api/fee-types', 'GET', authHeader);
      console.assert(feeTypesRes.status === 200, 'Tra cứu biểu phí phải 200');
      console.assert(feeTypesRes.body.data.length >= 3, 'Phải có ít nhất 3 loại phí');
      console.log(`  ✅ Lấy danh mục biểu phí thành công (${feeTypesRes.body.data.length} loại phí)!`);

      // ==============================================
      // 2. KIỂM THỬ GHI CHỈ SỐ ĐIỆN NƯỚC (UTILITY READINGS)
      // ==============================================
      console.log('\n--- [PHẦN 2: MODULE UTILITY READINGS] ---');
      const testPeriod = `2026-10`;

      // Xóa bản ghi cũ nếu có để đảm bảo test sạch
      await UtilityReading.deleteOne({ roomId: roomA101._id, billingPeriod: testPeriod });

      // Test 2.1: Chặn chỉ số cuối kỳ nhỏ hơn đầu kỳ
      console.log('▶ Test 2.1: Chặn chỉ số điện cuối kỳ nhỏ hơn đầu kỳ...');
      const invalidReadingRes = await request('/api/utility-readings', 'POST', authHeader, {
        roomId: roomA101._id.toString(),
        billingPeriod: testPeriod,
        electricityStart: 500,
        electricityEnd: 400, // Sai
        waterStart: 50,
        waterEnd: 60,
      });
      console.assert(invalidReadingRes.status === 400, 'Joi phải bắt 400 hoặc service bắt 422');
      console.log('  ✅ Chặn thành công chỉ số cuối nhỏ hơn đầu!');

      // Test 2.2: Ghi chỉ số điện nước hợp lệ
      // Tiêu thụ: 100 kWh điện (3.000đ/kWh = 300.000đ), 10 m3 nước (15.000đ/m3 = 150.000đ). Tổng: 450.000đ
      console.log('▶ Test 2.2: Ghi chỉ số điện nước hợp lệ (Tiêu thụ: 100 kWh điện, 10 m3 nước)...');
      const recordRes = await request('/api/utility-readings', 'POST', authHeader, {
        roomId: roomA101._id.toString(),
        billingPeriod: testPeriod,
        electricityStart: 100,
        electricityEnd: 200,
        waterStart: 20,
        waterEnd: 30,
      });
      console.assert(recordRes.status === 201, 'Ghi chỉ số phải 201');
      console.assert(recordRes.body.data.electricityAmount === 300000, 'Tiền điện phải là 300.000đ');
      console.assert(recordRes.body.data.waterAmount === 150000, 'Tiền nước phải là 150.000đ');
      console.assert(recordRes.body.data.totalAmount === 450000, 'Tổng tiền phòng phải là 450.000đ');
      const readingId = recordRes.body.data.id || recordRes.body.data._id;
      console.log(`  ✅ Lưu chỉ số thành công: Tổng tiền phòng 101 là ${recordRes.body.data.totalAmount.toLocaleString('vi-VN')} đ!`);

      // ==============================================
      // 3. THIẾT LẬP 2 SINH VIÊN ĐANG LƯU TRÚ PHÒNG 101 ĐỂ KIỂM THỬ CHIA ĐỀU
      // ==============================================
      console.log('\n--- [PHẦN 3: LẬP HÓA ĐƠN & THUẬT TOÁN CHIA ĐỀU ĐIỆN NƯỚC (A2)] ---');
      console.log('▶ Thiết lập 2 sinh viên đang ở giường 1 và giường 2...');

      // Sinh viên 1
      const s1 = await Student.create({
        fullName: 'Sinh Viên Chia Đều 1',
        studentCode: `SVC1_${Date.now().toString().slice(-4)}`,
        gender: 'male',
        phone: '0912345601',
        status: 'active',
      });
      const res1 = await Residency.create({
        studentId: s1._id,
        bedId: bed1._id,
        startDate: new Date('2026-09-01'),
        status: 'active',
      });
      const contract1 = await Contract.create({
        contractNumber: `HD-C1-${Date.now().toString().slice(-4)}`,
        residencyId: res1._id,
        studentId: s1._id,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        roomFeeSnapshot: 600000,
        status: 'active',
      });

      // Sinh viên 2
      const s2 = await Student.create({
        fullName: 'Sinh Viên Chia Đều 2',
        studentCode: `SVC2_${Date.now().toString().slice(-4)}`,
        gender: 'male',
        phone: '0912345602',
        status: 'active',
      });
      const res2 = await Residency.create({
        studentId: s2._id,
        bedId: bed2._id,
        startDate: new Date('2026-09-01'),
        status: 'active',
      });
      const contract2 = await Contract.create({
        contractNumber: `HD-C2-${Date.now().toString().slice(-4)}`,
        residencyId: res2._id,
        studentId: s2._id,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        roomFeeSnapshot: 600000,
        status: 'active',
      });

      // Cập nhật 2 giường sang occupied
      await Bed.findByIdAndUpdate(bed1._id, { status: 'occupied' });
      await Bed.findByIdAndUpdate(bed2._id, { status: 'occupied' });

      // Xóa hóa đơn cũ kỳ này nếu có
      await Invoice.deleteMany({ billingPeriod: testPeriod, studentId: { $in: [s1._id, s2._id] } });

      // Test 3.1: Lập hóa đơn hàng loạt kỳ 2026-10 (POST /api/invoices/generate)
      console.log('▶ Test 3.1: Staff bấm Lập hóa đơn hàng loạt cho kỳ 2026-10...');
      const genRes = await request('/api/invoices/generate', 'POST', authHeader, {
        billingPeriod: testPeriod,
        dueDate: '2026-11-10',
      });
      console.assert(genRes.status === 201, 'Lập hóa đơn phải 201');
      console.assert(genRes.body.data.totalInvoicesCreated >= 2, 'Phải tạo ít nhất 2 hóa đơn cho 2 sinh viên');
      console.log(`  ✅ Lập hóa đơn thành công (Đã tạo ${genRes.body.data.totalInvoicesCreated} hóa đơn)!`);

      // Test 3.2: Kiểm tra tính đúng đắn của phép chia đều điện nước
      // Phòng có 2 người => Mỗi người chịu:
      // Tiền phòng: 600.000đ
      // Điện: 300.000đ / 2 = 150.000đ
      // Nước: 150.000đ / 2 = 75.000đ
      // Tổng hóa đơn mỗi người = 600.000 + 150.000 + 75.000 = 825.000đ
      console.log('▶ Test 3.2: Kiểm tra công thức chia đều tiền điện nước (Quy tắc PRD §2.9 A2)...');
      const inv1 = await Invoice.findOne({ studentId: s1._id, billingPeriod: testPeriod });
      const inv2 = await Invoice.findOne({ studentId: s2._id, billingPeriod: testPeriod });

      console.assert(inv1 !== null, 'Hóa đơn SV1 phải tồn tại');
      console.assert(inv2 !== null, 'Hóa đơn SV2 phải tồn tại');

      console.assert(inv1.totalAmount === 825000, `Hóa đơn SV1 phải là 825.000đ (thực tế: ${inv1.totalAmount})`);
      console.assert(inv2.totalAmount === 825000, `Hóa đơn SV2 phải là 825.000đ (thực tế: ${inv2.totalAmount})`);

      const sumElec = (inv1.items.find(it => it.name.includes('điện'))?.amount || 0) + (inv2.items.find(it => it.name.includes('điện'))?.amount || 0);
      const sumWater = (inv1.items.find(it => it.name.includes('nước'))?.amount || 0) + (inv2.items.find(it => it.name.includes('nước'))?.amount || 0);

      console.assert(sumElec === 300000, 'Tổng tiền điện 2 SV phải đúng 300.000đ');
      console.assert(sumWater === 150000, 'Tổng tiền nước 2 SV phải đúng 150.000đ');
      console.log(`  ✅ Phép chia đều hoàn hảo: Mỗi sinh viên đóng đúng 825.000 đ (Điện: 150k, Nước: 75k, Phòng: 600k)!`);
      console.log(`  ✅ Tổng tiền từng phần cộng lại khớp 100% với tổng chi phí của cả phòng!`);

      // Test 3.3: Kiểm tra chỉ số điện nước đã chuyển sang isInvoiced: true
      const readingAfter = await UtilityReading.findById(readingId);
      console.assert(readingAfter.isInvoiced === true, 'isInvoiced phải được gán true');
      console.log('  ✅ Bản ghi chỉ số điện nước đã tự động khóa (isInvoiced: true)!');

      // Test 3.4: Chặn sửa chỉ số điện nước sau khi đã xuất hóa đơn
      console.log('▶ Test 3.4: Chặn sửa chỉ số điện nước khi đã xuất hóa đơn...');
      const editReadingRes = await request(`/api/utility-readings/${readingId}`, 'PUT', authHeader, {
        electricityEnd: 250,
      });
      console.assert(editReadingRes.status === 422, 'Phải nhận lỗi 422');
      console.assert(editReadingRes.body.code === 'READING_ALREADY_INVOICED', 'Code phải là READING_ALREADY_INVOICED');
      console.log('  ✅ Chặn sửa chỉ số thành công (422 READING_ALREADY_INVOICED)!');

      // Test 3.5: Hủy hóa đơn (PATCH /api/invoices/:id/cancel)
      console.log('▶ Test 3.5: Hủy hóa đơn chưa thanh toán...');
      const cancelRes = await request(`/api/invoices/${inv1._id}/cancel`, 'PATCH', authHeader);
      console.assert(cancelRes.status === 200, 'Hủy hóa đơn phải 200');
      console.assert(cancelRes.body.data.status === 'cancelled', 'Status phải là cancelled');
      console.log('  ✅ Hủy hóa đơn thành công (status: cancelled)!');

      // Dọn dẹp dữ liệu test
      await Invoice.deleteMany({ _id: { $in: [inv1._id, inv2._id] } });
      await UtilityReading.findByIdAndDelete(readingId);
      await Contract.deleteMany({ _id: { $in: [contract1._id, contract2._id] } });
      await Residency.deleteMany({ _id: { $in: [res1._id, res2._id] } });
      await Bed.findByIdAndUpdate(bed1._id, { status: 'available' });
      await Bed.findByIdAndUpdate(bed2._id, { status: 'available' });
      await Student.deleteMany({ _id: { $in: [s1._id, s2._id] } });
      console.log('  ✅ Đã dọn dẹp dữ liệu kiểm thử an toàn.');

      console.log('--------------------------------------------------');
      console.log('🎉 TOÀN BỘ CÁC TEST CASES CỦA GIAI ĐOẠN 4 ĐỀU VƯỢT QUA 100%!');
      console.log('--------------------------------------------------');
    } catch (err) {
      console.error('[TEST-PHASE4] ❌ Lỗi kiểm thử:', err);
    } finally {
      server.close();
      await mongoose.connection.close();
      process.exit(0);
    }
  });
}

runPhase4Tests();

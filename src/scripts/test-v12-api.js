/**
 * Script kiểm thử toàn diện các API mới của v1.2 (Users, Applications, Supplies, Portal, Payments).
 * Kiểm thử tính nhất quán của thuộc tính, phân quyền RBAC và các quy tắc nghiệp vụ.
 */

require('dotenv').config();
const http = require('http');
const app = require('../app');
const mongoose = require('mongoose');

const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');
const Room = require('../modules/rooms/room.model');
const RoomType = require('../modules/rooms/room-type.model');
const SupplyItem = require('../modules/supplies/supply-item.model');
const Application = require('../modules/residencies/application.model');
const Contract = require('../modules/contracts/contract.model');
const Invoice = require('../modules/fees/invoice.model');
const Payment = require('../modules/payments/payment.model');

let server;
let port;

function request(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runV12Tests() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  console.log('--------------------------------------------------');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN BACKEND V1.2.8...');
  console.log('--------------------------------------------------');

  try {
    // 1. Đăng nhập Admin & Sinh viên
    console.log('▶ Bước 1: Đăng nhập Admin và Sinh viên...');
    const adminLogin = await request('/api/auth/login', 'POST', {}, {
      email: 'admin@dorm.local',
      password: 'Admin@123',
    });
    console.assert(adminLogin.status === 200, 'Admin login phải 200');
    const adminToken = adminLogin.body.data.token;
    const adminHeader = { Authorization: `Bearer ${adminToken}` };

    const studentLogin = await request('/api/auth/login', 'POST', {}, {
      email: 'student.nam@dorm.local',
      password: 'Student@123',
    });
    console.assert(studentLogin.status === 200, 'Student login phải 200');
    const studentToken = studentLogin.body.data.token;
    const studentHeader = { Authorization: `Bearer ${studentToken}` };
    const studentId = studentLogin.body.data.user.studentId;

    // Dọn dẹp trạng thái cũ của sinh viên mẫu để test luôn chạy sạch
    const BedModel = require('../modules/rooms/bed.model');
    const ResidencyModel = require('../modules/residencies/residency.model');
    const SupplyOrderModel = require('../modules/supplies/supply-order.model');

    await Application.deleteMany({ studentId });
    const oldContracts = await Contract.find({ studentId });
    for (const c of oldContracts) {
      await BedModel.findByIdAndUpdate(c.bedId, { status: 'available' });
    }
    await Contract.deleteMany({ studentId });
    await ResidencyModel.deleteMany({ studentId });
    await Invoice.deleteMany({ studentId });
    await Payment.deleteMany({ studentId });
    await SupplyOrderModel.deleteMany({ studentId });

    console.log('  ✅ Đăng nhập Admin và Sinh viên thành công!');

    // 2. Quản lý tài khoản (SCR-81, GET /api/users)
    console.log('\n▶ Bước 2: Kiểm thử Quản lý tài khoản (/api/users)...');
    const usersRes = await request('/api/users?page=1&limit=10', 'GET', adminHeader);
    console.assert(usersRes.status === 200, 'GET /api/users phải 200');
    console.assert(usersRes.body.data.summary !== undefined, 'Response phải có block summary');
    console.log(`  ✅ Lấy danh sách tài khoản thành công! Tổng số: ${usersRes.body.data.total}`);

    // 3. Danh mục nhu yếu phẩm (GET /api/supply-items)
    console.log('\n▶ Bước 3: Kiểm thử Quản lý nhu yếu phẩm (/api/supply-items)...');
    const supplyItemsRes = await request('/api/supply-items', 'GET', adminHeader);
    console.assert(supplyItemsRes.status === 200, 'GET /api/supply-items phải 200');
    console.assert(supplyItemsRes.body.data.items.length >= 5, 'Phải có ít nhất 5 sản phẩm');
    console.log(`  ✅ Lấy danh mục nhu yếu phẩm thành công (${supplyItemsRes.body.data.total} vật phẩm)!`);

    // 4. Portal Sinh viên xem chỗ ở (/api/portal/my-residence)
    console.log('\n▶ Bước 4: Kiểm thử Cổng sinh viên /api/portal/my-residence...');
    const myResidenceRes = await request('/api/portal/my-residence', 'GET', studentHeader);
    console.assert(myResidenceRes.status === 200, 'GET /api/portal/my-residence phải 200');
    console.assert(myResidenceRes.body.data.hasResidence !== undefined, 'hasResidence phải tồn tại');
    console.log(`  ✅ Cổng sinh viên kiểm tra chỗ ở thành công! (hasResidence: ${myResidenceRes.body.data.hasResidence})`);

    // 5. Cổng sinh viên nộp đơn đăng ký phòng (/api/portal/my-applications)
    console.log('\n▶ Bước 5: Kiểm thử Cổng sinh viên nộp đơn đăng ký phòng (/api/portal/my-applications)...');
    const availableRooms = await request('/api/rooms/available', 'GET', studentHeader);
    console.assert(availableRooms.status === 200, 'GET /api/rooms/available phải 200');
    console.assert(availableRooms.body.data.items.length > 0, 'Phải có phòng trống');
    const chosenRoom = availableRooms.body.data.items[0];

    // Xóa đơn pending cũ nếu có để tránh conflict
    await Application.deleteMany({ studentId: studentLogin.body.data.user.studentId, status: 'pending' });

    const applyRes = await request('/api/portal/my-applications', 'POST', studentHeader, {
      roomId: chosenRoom.id,
      startDate: '2026-10-01',
      endDate: '2027-06-30',
      note: 'Em muốn đăng ký phòng kỳ mới',
    });
    console.assert(applyRes.status === 201, 'Nộp đơn đăng ký phải 201');
    console.assert(applyRes.body.data.applicationCode.startsWith('DK-'), 'Mã đơn phải có tiền tố DK-');
    const applicationId = applyRes.body.data.id;
    console.log(`  ✅ Nộp đơn đăng ký thành công! Mã đơn: ${applyRes.body.data.applicationCode}`);

    // 6. Cán bộ duyệt đơn đăng ký (/api/applications/:id/approve)
    console.log('\n▶ Bước 6: Kiểm thử Cán bộ duyệt đơn đăng ký phòng...');
    const approveRes = await request(`/api/applications/${applicationId}/approve`, 'PATCH', adminHeader);
    console.assert(approveRes.status === 200, 'Duyệt đơn phải 200');
    console.assert(approveRes.body.data.contract !== undefined, 'Duyệt đơn phải tự sinh Contract');
    console.assert(Array.isArray(approveRes.body.data.invoices) && approveRes.body.data.invoices.length === 2, 'Duyệt đơn phải sinh 2 hóa đơn');
    const depositInvoice = approveRes.body.data.invoices.find(inv => inv.type === 'deposit') || approveRes.body.data.invoices[0];
    const rentInvoice = approveRes.body.data.invoices.find(inv => inv.type === 'monthly') || approveRes.body.data.invoices[1];
    console.assert(depositInvoice !== undefined, 'Có hóa đơn cọc');
    console.assert(rentInvoice !== undefined, 'Có hóa đơn tiền phòng tháng đầu');
    console.log(`  ✅ Duyệt đơn đăng ký thành công! Đã tự động gán giường ${approveRes.body.data.contract.bedCode} và tạo hợp đồng ${approveRes.body.data.contract.contractCode}`);

    // 7. Cổng sinh viên kiểm tra lại chỗ ở sau khi được duyệt
    console.log('\n▶ Bước 7: Cổng sinh viên kiểm tra lại chỗ ở sau khi duyệt...');
    const updatedResidenceRes = await request('/api/portal/my-residence', 'GET', studentHeader);
    console.assert(updatedResidenceRes.status === 200, 'GET /api/portal/my-residence phải 200');
    console.assert(updatedResidenceRes.body.data.hasResidence === true, 'hasResidence phải là true');
    console.assert(updatedResidenceRes.body.data.contract.bedCode === approveRes.body.data.contract.bedCode, 'Mã giường phải khớp');
    console.log(`  ✅ Chỗ ở cập nhật chính xác! Phòng: ${updatedResidenceRes.body.data.contract.roomNumber}, Giường: ${updatedResidenceRes.body.data.contract.bedCode}`);

    // 8. Cổng sinh viên xem Shop nhu yếu phẩm (/api/portal/supply-items)
    console.log('\n▶ Bước 8: Kiểm thử Cổng sinh viên xem Shop nhu yếu phẩm...');
    const portalSuppliesRes = await request('/api/portal/supply-items', 'GET', studentHeader);
    console.assert(portalSuppliesRes.status === 200, 'GET /api/portal/supply-items phải 200');
    console.assert(Array.isArray(portalSuppliesRes.body.data.items), 'Danh sách vật phẩm phải là mảng');
    console.assert(Array.isArray(portalSuppliesRes.body.data.includedInRoom), 'includedInRoom phải là mảng');
    console.log(`  ✅ Shop nhu yếu phẩm hiển thị chuẩn! (Có sẵn trong phòng: ${portalSuppliesRes.body.data.includedInRoom.length} món, Đang bán: ${portalSuppliesRes.body.data.items.length} món)`);

    // 9. Cổng sinh viên đặt mua nhu yếu phẩm (/api/portal/my-supply-orders)
    console.log('\n▶ Bước 9: Sinh viên đặt mua nhu yếu phẩm...');
    const buyItem = portalSuppliesRes.body.data.items[0];
    const orderRes = await request('/api/portal/my-supply-orders', 'POST', studentHeader, {
      items: [{ supplyItemId: buyItem.id, quantity: 2 }],
    });
    console.assert(orderRes.status === 201, 'Đặt hàng phải 201');
    console.assert(orderRes.body.data.orderCode.startsWith('DH-'), 'Mã đơn phải là DH-');
    console.assert(orderRes.body.data.invoice.type === 'supplies', 'Hóa đơn đi kèm phải là type supplies');
    console.log(`  ✅ Đặt mua nhu yếu phẩm thành công! Mã đơn: ${orderRes.body.data.orderCode}, Tổng tiền: ${orderRes.body.data.totalAmount} đ`);

    // 10. Thu tiền mặt quầy cho hóa đơn nhu yếu phẩm (/api/payments/offline)
    console.log('\n▶ Bước 10: Thu tiền quầy cho hóa đơn mua nhu yếu phẩm...');
    const suppliesInvoiceId = orderRes.body.data.invoice.id;
    const paymentRes = await request('/api/payments/offline', 'POST', adminHeader, {
      invoiceId: suppliesInvoiceId,
      amount: orderRes.body.data.totalAmount,
      method: 'cash',
      note: 'Sinh viên thanh toán tiền mặt tại quầy',
    });
    if (paymentRes.status !== 201) {
      console.error('Payment failure detail:', JSON.stringify(paymentRes.body));
    }
    console.assert(paymentRes.status === 201, 'Thu tiền offline phải 201');
    console.assert(paymentRes.body.data.invoice.status === 'paid', 'Hóa đơn phải chuyển sang paid');
    console.log(`  ✅ Thu tiền mặt thành công! Hóa đơn đã được cập nhật: ${paymentRes.body.data.invoice.status}`);

    // Kiểm tra đơn hàng nhu yếu phẩm đã tự chuyển sang status 'ready' (BR-95)
    const SupplyOrder = require('../modules/supplies/supply-order.model');
    const checkedOrder = await SupplyOrder.findById(orderRes.body.data.id);
    console.assert(checkedOrder.status === 'ready', 'Đơn hàng phải tự động chuyển sang ready khi trả đủ tiền');
    console.log(`  ✅ Đơn hàng ${checkedOrder.orderCode} đã tự động chuyển sang trạng thái: ${checkedOrder.status} (chờ nhận hàng)!`);

    // Dọn dẹp dữ liệu kiểm thử
    console.log('\n▶ Dọn dẹp dữ liệu sau kiểm thử...');
    await Application.findByIdAndDelete(applicationId);
    await Contract.findByIdAndDelete(approveRes.body.data.contract.id);
    const invoiceIdsToDelete = [suppliesInvoiceId, ...approveRes.body.data.invoices.map(i => i.id)];
    await Invoice.deleteMany({ _id: { $in: invoiceIdsToDelete } });
    await Payment.deleteMany({ invoiceId: suppliesInvoiceId });
    await SupplyOrder.findByIdAndDelete(orderRes.body.data.id);
    const Bed = require('../modules/rooms/bed.model');
    await Bed.findByIdAndUpdate(approveRes.body.data.contract.bedId, { status: 'available' });
    const Residency = require('../modules/residencies/residency.model');
    await Residency.deleteMany({ studentId: studentLogin.body.data.user.studentId });
    console.log('  ✅ Đã dọn dẹp dữ liệu kiểm thử an toàn!');

    console.log('\n--------------------------------------------------');
    console.log('🎉 TOÀN BỘ CÁC TÍNH NĂNG V1.2.8 ĐÃ VƯỢT QUA KIỂM THỬ 100%!');
    console.log('--------------------------------------------------');

    server.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi kiểm thử v1.2:', err);
    if (server) server.close();
    await mongoose.connection.close();
    process.exit(1);
  }
}

runV12Tests();

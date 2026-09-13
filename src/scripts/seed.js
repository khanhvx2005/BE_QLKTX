/**
 * Script khởi tạo dữ liệu mẫu ban đầu (Seed Data) cho hệ thống DMS-KTX.
 * Tạo sẵn các tài khoản: Admin, Staff, Viewer để phục vụ kiểm thử và phát triển.
 * Sử dụng: npm run seed hoặc node src/scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../modules/auth/user.model');

async function seedData() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[SEED] ❌ Lỗi: Chưa cấu hình MONGODB_URI trong .env');
    process.exit(1);
  }

  console.log('--------------------------------------------------');
  console.log('[SEED] Bắt đầu khởi tạo dữ liệu mẫu cho hệ thống...');

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log(`[SEED] ✅ Đã kết nối tới MongoDB: ${mongoose.connection.name}`);

    // 1. Khởi tạo tài khoản Quản trị viên (Admin)
    const adminEmail = 'admin@dorm.local';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const passwordHash = await User.hashPassword('Admin@123');
      admin = await User.create({
        email: adminEmail,
        passwordHash,
        fullName: 'Quản trị viên Hệ thống (Admin)',
        role: 'admin',
        isActive: true,
      });
      console.log(`[SEED] ➕ Đã tạo tài khoản Admin: ${adminEmail} / Admin@123`);
    } else {
      console.log(`[SEED] ℹ️ Tài khoản Admin đã tồn tại: ${adminEmail}`);
    }

    // 2. Khởi tạo tài khoản Nhân viên Ký túc xá (Staff)
    const staffEmail = 'staff1@dorm.local';
    let staff = await User.findOne({ email: staffEmail });
    if (!staff) {
      const passwordHash = await User.hashPassword('Staff@123');
      staff = await User.create({
        email: staffEmail,
        passwordHash,
        fullName: 'Lê Thị Cán Bộ Quản Lý (Staff)',
        role: 'staff',
        isActive: true,
      });
      console.log(`[SEED] ➕ Đã tạo tài khoản Staff: ${staffEmail} / Staff@123`);
    } else {
      console.log(`[SEED] ℹ️ Tài khoản Staff đã tồn tại: ${staffEmail}`);
    }

    // 3. Khởi tạo tài khoản Khách chỉ xem (Viewer)
    const viewerEmail = 'viewer@dorm.local';
    let viewer = await User.findOne({ email: viewerEmail });
    if (!viewer) {
      const passwordHash = await User.hashPassword('Viewer@123');
      viewer = await User.create({
        email: viewerEmail,
        passwordHash,
        fullName: 'Ban Giám Hiệu / Khách Xem (Viewer)',
        role: 'viewer',
        isActive: true,
      });
      console.log(`[SEED] ➕ Đã tạo tài khoản Viewer: ${viewerEmail} / Viewer@123`);
    } else {
      console.log(`[SEED] ℹ️ Tài khoản Viewer đã tồn tại: ${viewerEmail}`);
    }

    // 4. Khởi tạo Tòa nhà mẫu (Buildings)
    const Building = require('../modules/rooms/building.model');
    const Room = require('../modules/rooms/room.model');
    const Bed = require('../modules/rooms/bed.model');

    let buildingA = await Building.findOne({ code: 'A' });
    if (!buildingA) {
      buildingA = await Building.create({
        code: 'A',
        name: 'Tòa nhà A (Khu Nam)',
        address: 'Khu nội trú số 1, Ký túc xá',
        description: 'Tòa nhà 5 tầng dành riêng cho sinh viên nam',
        isActive: true,
      });
      console.log(`[SEED] ➕ Đã tạo Tòa nhà A: ${buildingA.name}`);
    }

    let buildingB = await Building.findOne({ code: 'B' });
    if (!buildingB) {
      buildingB = await Building.create({
        code: 'B',
        name: 'Tòa nhà B (Khu Nữ)',
        address: 'Khu nội trú số 2, Ký túc xá',
        description: 'Tòa nhà 5 tầng dành riêng cho sinh viên nữ',
        isActive: true,
      });
      console.log(`[SEED] ➕ Đã tạo Tòa nhà B: ${buildingB.name}`);
    }

    // 5. Khởi tạo Phòng mẫu (Rooms) & Giường (Beds)
    // Phòng 101 tòa A (Nam, 4 giường, 600.000đ/giường)
    let roomA101 = await Room.findOne({ buildingId: buildingA._id, roomNumber: '101' });
    if (!roomA101) {
      roomA101 = await Room.create({
        buildingId: buildingA._id,
        roomNumber: '101',
        gender: 'male',
        capacity: 4,
        pricePerBed: 600000,
        status: 'active',
      });
      console.log(`[SEED] ➕ Đã tạo Phòng 101 Tòa A (Nam, 4 giường)`);
      // Tạo 4 giường cho phòng 101
      for (let b = 1; b <= 4; b++) {
        await Bed.create({ roomId: roomA101._id, bedNumber: b, status: 'available' });
      }
      console.log(`[SEED] ➕ Đã tạo 4 giường cho Phòng 101 Tòa A`);
    }

    // Phòng 201 tòa B (Nữ, 4 giường, 600.000đ/giường)
    let roomB201 = await Room.findOne({ buildingId: buildingB._id, roomNumber: '201' });
    if (!roomB201) {
      roomB201 = await Room.create({
        buildingId: buildingB._id,
        roomNumber: '201',
        gender: 'female',
        capacity: 4,
        pricePerBed: 600000,
        status: 'active',
      });
      console.log(`[SEED] ➕ Đã tạo Phòng 201 Tòa B (Nữ, 4 giường)`);
      // Tạo 4 giường cho phòng 201
      for (let b = 1; b <= 4; b++) {
        await Bed.create({ roomId: roomB201._id, bedNumber: b, status: 'available' });
      }
      console.log(`[SEED] ➕ Đã tạo 4 giường cho Phòng 201 Tòa B`);
    }

    // 7. Khởi tạo 2 Sinh viên mẫu (1 Nam, 1 Nữ)
    const Student = require('../modules/students/student.model');

    const demoStudents = [
      {
        email: 'student.nam@dorm.local',
        password: 'Student@123',
        fullName: 'Trần Văn Nam',
        studentCode: 'SV20260001',
        gender: 'male',
        phone: '0901234567',
        faculty: 'Công nghệ thông tin',
        className: 'CNTT-K66',
      },
      {
        email: 'student.nu@dorm.local',
        password: 'Student@123',
        fullName: 'Nguyễn Thị Hoa',
        studentCode: 'SV20260002',
        gender: 'female',
        phone: '0907654321',
        faculty: 'Kinh tế Quốc tế',
        className: 'KTQT-K66',
      },
    ];

    for (const ds of demoStudents) {
      let u = await User.findOne({ email: ds.email });
      if (!u) {
        const passwordHash = await User.hashPassword(ds.password);
        u = await User.create({
          email: ds.email,
          passwordHash,
          fullName: ds.fullName,
          role: 'student',
          isActive: true,
        });

        await Student.create({
          userId: u._id,
          fullName: ds.fullName,
          studentCode: ds.studentCode,
          phone: ds.phone,
          email: ds.email,
          gender: ds.gender,
          faculty: ds.faculty,
          className: ds.className,
          status: 'active',
        });
        console.log(`[SEED] ➕ Đã tạo Sinh viên mẫu: ${ds.email} (${ds.fullName}) / ${ds.password}`);
      } else {
        console.log(`[SEED] ℹ️ Sinh viên mẫu đã tồn tại: ${ds.email}`);
      }
    }

    console.log('--------------------------------------------------');
    console.log('[SEED] 🎉 HOÀN THÀNH KHỞI TẠO DỮ LIỆU BAN ĐẦU!');
    console.log('--------------------------------------------------');
    console.log('Danh sách dữ liệu mẫu đã sẵn sàng:');
    console.log('1. Admin:       admin@dorm.local        | Mật khẩu: Admin@123');
    console.log('2. Staff:       staff1@dorm.local       | Mật khẩu: Staff@123');
    console.log('3. Viewer:      viewer@dorm.local       | Mật khẩu: Viewer@123');
    console.log('4. Sinh viên 1: student.nam@dorm.local  | Mật khẩu: Student@123 (Mã: SV20260001)');
    console.log('5. Sinh viên 2: student.nu@dorm.local   | Mật khẩu: Student@123 (Mã: SV20260002)');
    console.log('6. Tòa A:       Tòa nhà A (Nam)         - Phòng 101 (4 giường)');
    console.log('7. Tòa B:       Tòa nhà B (Nữ)          - Phòng 201 (4 giường)');
    console.log('8. Biểu phí:    Điện 3.000đ, Nước 15.000đ, Cọc 1.000.000đ, Thuê 600.000đ');
    console.log('--------------------------------------------------');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[SEED] ❌ Khởi tạo dữ liệu thất bại:', error);
    process.exit(1);
  }
}

seedData();

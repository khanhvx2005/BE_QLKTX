/**
 * Script khởi tạo dữ liệu mẫu ban đầu (Seed Data v2.0-HaUI) cho Hệ thống HaUI - DMS.
 * Tòa nhà K1, K2, K3, K4; Phòng KTX nhúng giường trực tiếp;
 * Tài khoản mẫu (Admin, Staff, Sinh viên HaUI).
 *
 * Sử dụng: npm run seed hoặc node src/scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');
const Building = require('../modules/rooms/building.model');
const Room = require('../modules/rooms/room.model');
const Contract = require('../modules/contracts/contract.model');
const Invoice = require('../modules/fees/invoice.model');
const cache = require('../core/utils/cache');

async function seedData() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dms_ktx';

  console.log('--------------------------------------------------');
  console.log('[SEED] Bắt đầu khởi tạo dữ liệu mẫu HaUI - DMS v2.0...');

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log(`[SEED] ✅ Đã kết nối tới MongoDB: ${mongoose.connection.name}`);

    // ==========================================
    // 1. Khởi tạo Tòa nhà KTX HaUI (Buildings)
    // ==========================================
    const buildingConfigs = [
      { code: 'K1', name: 'Tòa K1 - KTX Nam Cơ sở 1', description: 'Khu nội trú nam sinh viên, gần cổng chính', isActive: true },
      { code: 'K2', name: 'Tòa K2 - KTX Nữ Cơ sở 1', description: 'Khu nội trú nữ sinh viên', isActive: true },
      { code: 'K3', name: 'Tòa K3 - KTX Cơ sở 2 Tây Tựu', description: 'Khu KTX Cơ sở 2', isActive: true },
      { code: 'K4', name: 'Tòa K4 - KTX Cơ sở 3 Hà Nam', description: 'Khu KTX Cơ sở 3', isActive: true },
    ];

    const buildings = {};
    for (const bc of buildingConfigs) {
      let b = await Building.findOne({ code: bc.code });
      if (!b) {
        b = await Building.create(bc);
      }
      buildings[bc.code] = b;
    }
    console.log(`[SEED] ✅ Đã khởi tạo 4 tòa nhà KTX (K1, K2, K3, K4).`);

    // ==========================================
    // 2. Khởi tạo Phòng KTX kèm Giường nhúng (Rooms & Embedded Beds)
    // ==========================================
    const roomConfigs = [
      // Tòa K1 (Nam) - Tầng 1 đến 3
      { buildingCode: 'K1', roomNumber: '101', floor: 1, gender: 'male', capacity: 4, pricePerMonth: 500000, depositAmount: 500000 },
      { buildingCode: 'K1', roomNumber: '102', floor: 1, gender: 'male', capacity: 6, pricePerMonth: 400000, depositAmount: 500000 },
      { buildingCode: 'K1', roomNumber: '201', floor: 2, gender: 'male', capacity: 6, pricePerMonth: 400000, depositAmount: 500000 },
      { buildingCode: 'K1', roomNumber: '202', floor: 2, gender: 'male', capacity: 8, pricePerMonth: 350000, depositAmount: 500000 },
      { buildingCode: 'K1', roomNumber: '302', floor: 3, gender: 'male', capacity: 6, pricePerMonth: 400000, depositAmount: 500000 },

      // Tòa K2 (Nữ) - Tầng 1 đến 3
      { buildingCode: 'K2', roomNumber: '101', floor: 1, gender: 'female', capacity: 4, pricePerMonth: 500000, depositAmount: 500000 },
      { buildingCode: 'K2', roomNumber: '102', floor: 1, gender: 'female', capacity: 6, pricePerMonth: 400000, depositAmount: 500000 },
      { buildingCode: 'K2', roomNumber: '201', floor: 2, gender: 'female', capacity: 6, pricePerMonth: 400000, depositAmount: 500000 },
      { buildingCode: 'K2', roomNumber: '302', floor: 3, gender: 'female', capacity: 6, pricePerMonth: 400000, depositAmount: 500000 },
    ];

    const createdRooms = [];
    for (const rc of roomConfigs) {
      const building = buildings[rc.buildingCode];
      let room = await Room.findOne({ buildingId: building._id, roomNumber: rc.roomNumber });
      if (!room) {
        // Tự động sinh danh sách giường nhúng
        const beds = Array.from({ length: rc.capacity }, (_, i) => ({
          bedNumber: i + 1,
          status: 'available',
          studentId: null,
        }));

        room = await Room.create({
          buildingId: building._id,
          roomNumber: rc.roomNumber,
          floor: rc.floor,
          gender: rc.gender,
          capacity: rc.capacity,
          pricePerMonth: rc.pricePerMonth,
          depositAmount: rc.depositAmount,
          status: 'active',
          beds,
        });
      }
      createdRooms.push(room);
    }
    console.log(`[SEED] ✅ Đã khởi tạo ${createdRooms.length} phòng KTX kèm giường nhúng.`);

    // ==========================================
    // 3. Khởi tạo Tài khoản Quản trị & Cán bộ
    // ==========================================
    // 3.1 Admin
    const adminEmail = 'admin@haui.edu.vn';
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      adminUser = await User.create({
        email: adminEmail,
        passwordHash: await bcrypt.hash('admin123', 10),
        fullName: 'Quản trị viên Hệ thống KTX',
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
      });
    }

    // 3.2 Staff (Cán bộ)
    const staffEmail = 'staff@haui.edu.vn';
    let staffUser = await User.findOne({ email: staffEmail });
    if (!staffUser) {
      staffUser = await User.create({
        email: staffEmail,
        passwordHash: await bcrypt.hash('staff123', 10),
        fullName: 'Cán bộ Quản lý KTX HaUI',
        role: 'staff',
        isActive: true,
        mustChangePassword: false,
      });
    }

    // ==========================================
    // 4. Khởi tạo Sinh viên mẫu & Tài khoản
    // ==========================================
    const studentData = [
      {
        studentCode: '2021601234',
        fullName: 'Nguyễn Văn An',
        gender: 'male',
        phone: '0981234567',
        email: '2021601234@st.haui.edu.vn',
        faculty: 'Công nghệ thông tin',
        className: 'KTPM01-K16',
      },
      {
        studentCode: '2021605678',
        fullName: 'Trần Thị Bình',
        gender: 'female',
        phone: '0979876543',
        email: '2021605678@st.haui.edu.vn',
        faculty: 'Kinh tế',
        className: 'QTKD02-K16',
      },
    ];

    for (const sd of studentData) {
      let st = await Student.findOne({ studentCode: sd.studentCode });
      if (!st) {
        st = await Student.create(sd);
      }

      // Tạo user tương ứng
      let user = await User.findOne({ email: sd.email });
      if (!user) {
        user = await User.create({
          email: sd.email,
          passwordHash: await bcrypt.hash(sd.studentCode, 10), // Pass khởi tạo = MSSV
          fullName: sd.fullName,
          role: 'student',
          studentId: st._id,
          isActive: true,
          mustChangePassword: true, // Bắt buộc đổi MK lần đầu
        });
        st.userId = user._id;
        await st.save();
      }
    }

    console.log(`[SEED] ✅ Đã khởi tạo các tài khoản người dùng mẫu:`);
    console.log(`   - Admin: ${adminEmail} (mật khẩu: admin123)`);
    console.log(`   - Staff: ${staffEmail} (mật khẩu: staff123)`);
    console.log(`   - Sinh viên 1: 2021601234 (Tài khoản: 2021601234, Mật khẩu: 2021601234)`);
    console.log(`   - Sinh viên 2: 2021605678 (Tài khoản: 2021605678, Mật khẩu: 2021605678)`);

    // Xóa cache Redis
    await cache.delByPattern('*');

    console.log('--------------------------------------------------');
    console.log('[SEED] 🎉 Hoàn tất khởi tạo dữ liệu HaUI - DMS thành công!');
    process.exit(0);
  } catch (err) {
    console.error('[SEED] ❌ Lỗi khởi tạo:', err);
    process.exit(1);
  }
}

seedData();

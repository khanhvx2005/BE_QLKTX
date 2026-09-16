/**
 * Script khởi tạo dữ liệu mẫu ban đầu (Seed Data v1.2.8) cho hệ thống DMS-KTX.
 * Tạo biểu phí FeeTypes, các loại phòng RoomTypes, nhu yếu phẩm SupplyItems,
 * tòa nhà Buildings, phòng Rooms, giường Beds và tài khoản mẫu (Admin, Staff, Viewer, Sinh viên).
 *
 * Sử dụng: npm run seed hoặc node src/scripts/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../modules/auth/user.model');
const Student = require('../modules/students/student.model');
const Building = require('../modules/rooms/building.model');
const RoomType = require('../modules/rooms/room-type.model');
const Room = require('../modules/rooms/room.model');
const Bed = require('../modules/rooms/bed.model');
const FeeType = require('../modules/fees/fee-type.model');
const SupplyItem = require('../modules/supplies/supply-item.model');

async function seedData() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[SEED] ❌ Lỗi: Chưa cấu hình MONGODB_URI trong .env');
    process.exit(1);
  }

  console.log('--------------------------------------------------');
  console.log('[SEED] Bắt đầu khởi tạo dữ liệu mẫu DMS v1.2.8...');

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log(`[SEED] ✅ Đã kết nối tới MongoDB: ${mongoose.connection.name}`);

    // ==========================================
    // 1. Khởi tạo Biểu phí (FeeType - DATA-SCHEMA §3.8)
    // ==========================================
    const feeTypeConfigs = [
      { code: 'rent', name: 'Tiền phòng theo kỳ', defaultAmount: 0, isRecurring: true },
      { code: 'electricity', name: 'Tiền điện sinh hoạt', defaultAmount: 2500, isRecurring: true },
      { code: 'water', name: 'Tiền nước sinh hoạt', defaultAmount: 12000, isRecurring: true },
      { code: 'deposit', name: 'Tiền cọc thế chân', defaultAmount: 500000, isRecurring: false },
      { code: 'supplies', name: 'Mua sắm nhu yếu phẩm', defaultAmount: 0, isRecurring: false },
      { code: 'other', name: 'Chi phí phát sinh khác', defaultAmount: 0, isRecurring: false },
    ];

    for (const ft of feeTypeConfigs) {
      await FeeType.findOneAndUpdate(
        { code: ft.code },
        { ...ft, isActive: true },
        { upsert: true, new: true }
      );
    }
    console.log(`[SEED] ✅ Đã khởi tạo 6 loại biểu phí chuẩn (FeeType).`);

    // ==========================================
    // 2. Khởi tạo Loại phòng (RoomType - DATA-SCHEMA §3.4)
    // ==========================================
    const roomTypeConfigs = [
      {
        name: 'Tiêu chuẩn · 6 người',
        tier: 'standard',
        capacity: 6,
        pricePerMonth: 320000,
        depositAmount: 500000,
        amenities: ['Giường tầng', 'Tủ cá nhân', 'Quạt trần', 'Bàn học chung'],
        isActive: true,
      },
      {
        name: 'Tiêu chuẩn · 4 người',
        tier: 'standard',
        capacity: 4,
        pricePerMonth: 450000,
        depositAmount: 700000,
        amenities: ['Giường tầng', 'Tủ cá nhân', 'Quạt trần', 'Bàn học'],
        isActive: true,
      },
      {
        name: 'Chất lượng cao · 4 người',
        tier: 'premium',
        capacity: 4,
        pricePerMonth: 950000,
        depositAmount: 1000000,
        amenities: ['Giường tầng', 'Tủ cá nhân', 'Điều hòa', 'Bình nóng lạnh', 'WC riêng', 'Bàn học riêng'],
        isActive: true,
      },
      {
        name: 'Chất lượng cao · 2 người',
        tier: 'premium',
        capacity: 2,
        pricePerMonth: 1500000,
        depositAmount: 1500000,
        amenities: ['Điều hòa', 'Bình nóng lạnh', 'Tủ lạnh', 'Giường đơn', 'Bàn học riêng'],
        isActive: true,
      },
    ];

    const createdRoomTypes = {};
    for (const rtc of roomTypeConfigs) {
      let rt = await RoomType.findOne({ name: rtc.name });
      if (!rt) {
        rt = await RoomType.create(rtc);
      } else {
        Object.assign(rt, rtc);
        await rt.save();
      }
      createdRoomTypes[rtc.name] = rt;
    }
    console.log(`[SEED] ✅ Đã khởi tạo các loại phòng chuẩn (RoomType).`);

    // ==========================================
    // 3. Khởi tạo Vật phẩm Nhu yếu phẩm (SupplyItem)
    // ==========================================
    const standard6 = createdRoomTypes['Tiêu chuẩn · 6 người'];
    const premium4 = createdRoomTypes['Chất lượng cao · 4 người'];
    const premium2 = createdRoomTypes['Chất lượng cao · 2 người'];

    const supplyItemConfigs = [
      {
        name: 'Vỏ đệm 90x190cm',
        category: 'bedding',
        unit: 'cái',
        price: 120000,
        imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400',
        includedInRoomTypes: [],
      },
      {
        name: 'Đệm mút 90x190cm',
        category: 'bedding',
        unit: 'cái',
        price: 350000,
        imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400',
        includedInRoomTypes: [premium4._id, premium2._id],
      },
      {
        name: 'Ruột gối ép hơi',
        category: 'bedding',
        unit: 'cái',
        price: 60000,
        imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400',
        includedInRoomTypes: [premium2._id],
      },
      {
        name: 'Vỏ gối cotton',
        category: 'bedding',
        unit: 'cái',
        price: 40000,
        imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400',
        includedInRoomTypes: [],
      },
      {
        name: 'Chăn hè thu 1m5x2m',
        category: 'bedding',
        unit: 'cái',
        price: 180000,
        imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400',
        includedInRoomTypes: [premium2._id],
      },
      {
        name: 'Ấm đun siêu tốc 1.8L',
        category: 'appliances',
        unit: 'cái',
        price: 150000,
        imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400',
        includedInRoomTypes: [premium4._id, premium2._id],
      },
      {
        name: 'Đèn học LED chống cận',
        category: 'personal',
        unit: 'cái',
        price: 120000,
        imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400',
        includedInRoomTypes: [],
      },
      {
        name: 'Ổ cắm điện nối dài 3m',
        category: 'personal',
        unit: 'cái',
        price: 80000,
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400',
        includedInRoomTypes: [],
      },
      {
        name: 'Móc treo quần áo (Bộ 10 chiếc)',
        category: 'other',
        unit: 'bộ',
        price: 30000,
        imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400',
        includedInRoomTypes: [],
      },
      {
        name: 'Thùng rác mini nắp lật',
        category: 'cleaning',
        unit: 'cái',
        price: 45000,
        imageUrl: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400',
        includedInRoomTypes: [],
      },
    ];

    for (const sic of supplyItemConfigs) {
      let item = await SupplyItem.findOne({ name: sic.name });
      if (!item) {
        await SupplyItem.create(sic);
      } else {
        Object.assign(item, sic);
        await item.save();
      }
    }
    console.log(`[SEED] ✅ Đã khởi tạo 10 vật phẩm nhu yếu phẩm (SupplyItem).`);

    // ==========================================
    // 4. Khởi tạo Tòa nhà, Phòng & Giường tự sinh (Rooms & Beds)
    // ==========================================
    let buildingA = await Building.findOne({ code: 'A' });
    if (!buildingA) {
      buildingA = await Building.create({
        code: 'A',
        name: 'Tòa nhà A',
        address: 'Khu nội trú số 1, Ký túc xá',
        description: 'Tòa nhà 4 tầng',
        isActive: true,
      });
    }

    let buildingB = await Building.findOne({ code: 'B' });
    if (!buildingB) {
      buildingB = await Building.create({
        code: 'B',
        name: 'Tòa nhà B',
        address: 'Khu nội trú số 2, Ký túc xá',
        description: 'Tòa nhà 4 tầng',
        isActive: true,
      });
    }

    // Tạo phòng A101 (Nam - Tiêu chuẩn 6)
    let roomA101 = await Room.findOne({ buildingId: buildingA._id, roomNumber: 'A101' });
    if (!roomA101) {
      roomA101 = await Room.create({
        buildingId: buildingA._id,
        roomTypeId: standard6._id,
        roomNumber: 'A101',
        floor: 1,
        gender: 'male',
        capacity: standard6.capacity,
        status: 'active',
      });
      // Tự sinh 6 giường theo chuẩn: A101-01 -> A101-06
      for (let i = 1; i <= standard6.capacity; i++) {
        const bedCode = `A101-${String(i).padStart(2, '0')}`;
        await Bed.create({ roomId: roomA101._id, bedNumber: i, bedCode, status: 'available' });
      }
      console.log(`[SEED] ➕ Đã tạo Phòng A101 (Nam, 6 giường) kèm Beds.`);
    } else if (!roomA101.roomTypeId) {
      roomA101.roomTypeId = standard6._id;
      roomA101.capacity = standard6.capacity;
      await roomA101.save();
    }

    // Tạo phòng A102 (Nam - Chất lượng cao 4)
    let roomA102 = await Room.findOne({ buildingId: buildingA._id, roomNumber: 'A102' });
    if (!roomA102) {
      roomA102 = await Room.create({
        buildingId: buildingA._id,
        roomTypeId: premium4._id,
        roomNumber: 'A102',
        floor: 1,
        gender: 'male',
        capacity: premium4.capacity,
        status: 'active',
      });
      for (let i = 1; i <= premium4.capacity; i++) {
        const bedCode = `A102-${String(i).padStart(2, '0')}`;
        await Bed.create({ roomId: roomA102._id, bedNumber: i, bedCode, status: 'available' });
      }
      console.log(`[SEED] ➕ Đã tạo Phòng A102 (Nam, 4 giường) kèm Beds.`);
    } else if (!roomA102.roomTypeId) {
      roomA102.roomTypeId = premium4._id;
      roomA102.capacity = premium4.capacity;
      await roomA102.save();
    }

    // Tạo phòng B201 (Nữ - Tiêu chuẩn 6)
    let roomB201 = await Room.findOne({ buildingId: buildingB._id, roomNumber: 'B201' });
    if (!roomB201) {
      roomB201 = await Room.create({
        buildingId: buildingB._id,
        roomTypeId: standard6._id,
        roomNumber: 'B201',
        floor: 2,
        gender: 'female',
        capacity: standard6.capacity,
        status: 'active',
      });
      for (let i = 1; i <= standard6.capacity; i++) {
        const bedCode = `B201-${String(i).padStart(2, '0')}`;
        await Bed.create({ roomId: roomB201._id, bedNumber: i, bedCode, status: 'available' });
      }
      console.log(`[SEED] ➕ Đã tạo Phòng B201 (Nữ, 6 giường) kèm Beds.`);
    } else if (!roomB201.roomTypeId) {
      roomB201.roomTypeId = standard6._id;
      roomB201.capacity = standard6.capacity;
      await roomB201.save();
    }

    // Tạo phòng B203 (Nữ - Chất lượng cao 4)
    let roomB203 = await Room.findOne({ buildingId: buildingB._id, roomNumber: 'B203' });
    if (!roomB203) {
      roomB203 = await Room.create({
        buildingId: buildingB._id,
        roomTypeId: premium4._id,
        roomNumber: 'B203',
        floor: 2,
        gender: 'female',
        capacity: premium4.capacity,
        status: 'active',
      });
      for (let i = 1; i <= premium4.capacity; i++) {
        const bedCode = `B203-${String(i).padStart(2, '0')}`;
        await Bed.create({ roomId: roomB203._id, bedNumber: i, bedCode, status: 'available' });
      }
      console.log(`[SEED] ➕ Đã tạo Phòng B203 (Nữ, 4 giường) kèm Beds.`);
    } else if (!roomB203.roomTypeId) {
      roomB203.roomTypeId = premium4._id;
      roomB203.capacity = premium4.capacity;
      await roomB203.save();
    }

    // ==========================================
    // 5. Khởi tạo Tài khoản Quản trị & Cán bộ
    // ==========================================
    // 1. Admin
    let admin = await User.findOne({ email: 'admin@dorm.local' });
    if (!admin) {
      const passwordHash = await User.hashPassword('Admin@123');
      admin = await User.create({
        email: 'admin@dorm.local',
        passwordHash,
        fullName: 'Quản trị viên Hệ thống (Admin)',
        role: 'admin',
        isActive: true,
      });
      console.log(`[SEED] ➕ Đã tạo tài khoản Admin: admin@dorm.local / Admin@123`);
    }

    // 2. Staff
    let staff = await User.findOne({ email: 'staff1@dorm.local' });
    if (!staff) {
      const passwordHash = await User.hashPassword('Staff@123');
      staff = await User.create({
        email: 'staff1@dorm.local',
        passwordHash,
        fullName: 'Lê Thị Cán Bộ Quản Lý (Staff)',
        role: 'staff',
        isActive: true,
      });
      console.log(`[SEED] ➕ Đã tạo tài khoản Staff: staff1@dorm.local / Staff@123`);
    }

    // 3. Viewer
    let viewer = await User.findOne({ email: 'viewer@dorm.local' });
    if (!viewer) {
      const passwordHash = await User.hashPassword('Viewer@123');
      viewer = await User.create({
        email: 'viewer@dorm.local',
        passwordHash,
        fullName: 'Ban Giám Hiệu / Khách Xem (Viewer)',
        role: 'viewer',
        isActive: true,
      });
      console.log(`[SEED] ➕ Đã tạo tài khoản Viewer: viewer@dorm.local / Viewer@123`);
    }

    // ==========================================
    // 6. Khởi tạo Sinh viên mẫu & Tài khoản Cổng SV
    // ==========================================
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
      let st = await Student.findOne({ studentCode: ds.studentCode });

      if (!u) {
        const passwordHash = await User.hashPassword(ds.password);
        u = await User.create({
          email: ds.email,
          passwordHash,
          fullName: ds.fullName,
          role: 'student',
          isActive: true,
        });
      }

      if (!st) {
        st = await Student.create({
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
        u.studentId = st._id;
        await u.save();
        console.log(`[SEED] ➕ Đã tạo Sinh viên mẫu: ${ds.email} (${ds.fullName}) / ${ds.password}`);
      }
    }

    console.log('--------------------------------------------------');
    console.log('[SEED] 🎉 HOÀN THÀNH KHỞI TẠO DỮ LIỆU BAN ĐẦU V1.2.8!');
    console.log('--------------------------------------------------');
    console.log('1. Admin:       admin@dorm.local        | Mật khẩu: Admin@123');
    console.log('2. Staff:       staff1@dorm.local       | Mật khẩu: Staff@123');
    console.log('3. Viewer:      viewer@dorm.local       | Mật khẩu: Viewer@123');
    console.log('4. Sinh viên 1: student.nam@dorm.local  | Mật khẩu: Student@123 (Mã: SV20260001, Nam)');
    console.log('5. Sinh viên 2: student.nu@dorm.local   | Mật khẩu: Student@123 (Mã: SV20260002, Nữ)');
    console.log('--------------------------------------------------');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[SEED] ❌ Khởi tạo dữ liệu thất bại:', error);
    process.exit(1);
  }
}

seedData();

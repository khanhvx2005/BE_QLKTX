/**
 * Service xử lý nghiệp vụ cho Module Rooms (Tòa nhà & Phòng KTX HaUI).
 * 
 * ============================================================================
 * [LUỒNG LOGIC NGHIỆP VỤ CỐT LÕI - DÀNH CHO TEAM 5]:
 * 1. Tự động sinh giường (FR-24):
 *    - Khi tạo phòng mới với sức chứa `capacity` (4, 6 hoặc 8 chỗ), hệ thống
 *      tự động sinh mảng `beds` từ giường 1 -> N ở trạng thái 'available'.
 * 2. Quy tắc ngăn xếp (Stack Allocation - BR-07 & FR-23):
 *    - Tra cứu phòng trống luôn ưu tiên: Tầng thấp nhất trước -> Số phòng nhỏ nhất trước.
 * 3. Tối ưu hiệu năng bằng Redis Caching:
 *    - Cache danh mục phòng trống: `rooms:available:...`
 *    - Khi có phòng mới hoặc có biến động duyệt đơn/trả phòng, tự động xóa cache (Invalidation).
 * ============================================================================
 */

const Room = require('./room.model');
const Building = require('./building.model');
const ApiError = require('../../core/errors/api-error');
const cache = require('../../core/utils/cache');

// ============================================================================
// 1. NGHIỆP VỤ TÒA NHÀ KTX (BUILDINGS)
// ============================================================================

/**
 * Lấy danh sách toàn bộ tòa nhà KTX (FR-20)
 * Áp dụng Redis Cache để tăng tốc độ tải trang
 */
const getBuildings = async (query = {}) => {
  const cacheKey = `buildings:all:${query.includeInactive ? 'with_inactive' : 'active_only'}`;

  return cache.wrap(
    cacheKey,
    async () => {
      const filter = {};
      if (query.includeInactive !== true && query.includeInactive !== 'true') {
        filter.isActive = true;
      }
      return Building.find(filter).sort('code');
    },
    600 // Cache trong 10 phút
  );
};

/**
 * Thêm tòa nhà KTX mới (FR-21)
 */
const createBuilding = async (data) => {
  const codeUpper = data.code.trim().toUpperCase();
  const existing = await Building.findOne({ code: codeUpper });
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', `Mã tòa nhà ${codeUpper} đã tồn tại trên hệ thống`);
  }

  const building = await Building.create({
    ...data,
    code: codeUpper,
  });

  // Xóa cache tòa nhà để cập nhật số liệu mới
  await cache.delByPattern('buildings:*');

  return building;
};

/**
 * Cập nhật thông tin tòa nhà (FR-21)
 */
const updateBuilding = async (id, data) => {
  const building = await Building.findById(id);
  if (!building) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tòa nhà');
  }

  // Nếu muốn tắt hoạt động tòa nhà: Kiểm tra xem còn sinh viên đang ở trong tòa không
  if (data.isActive === false) {
    const activeRooms = await Room.find({
      buildingId: id,
      'beds.status': 'occupied',
    });
    if (activeRooms.length > 0) {
      throw new ApiError(
        422,
        'BUILDING_HAS_OCCUPANTS',
        'Không thể đóng tòa nhà vì vẫn còn sinh viên đang cư trú trong các phòng'
      );
    }
  }

  Object.assign(building, data);
  await building.save();

  // Xóa cache
  await cache.delByPattern('buildings:*');

  return building;
};

// ============================================================================
// 2. NGHIỆP VỤ PHÒNG KTX (ROOMS)
// ============================================================================

/**
 * Tạo phòng KTX mới kèm TỰ ĐỘNG SINH GIƯỜNG NHÚNG (FR-24)
 * Luồng logic:
 * Input: buildingId, roomNumber, floor, gender, capacity (4/6/8), pricePerMonth, depositAmount
 * Xử lý: Sinh mảng beds [ { bedNumber: 1, status: 'available' }, ... ]
 * Output: Room đã lưu kèm danh sách giường sẵn sàng tiếp nhận sinh viên
 */
const createRoom = async (data) => {
  const building = await Building.findById(data.buildingId);
  if (!building) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tòa nhà chỉ định');
  }

  const roomNumberTrim = data.roomNumber.trim();

  // Kiểm tra không bao giờ trùng số phòng trong cùng 1 tòa nhà
  const existing = await Room.findOne({
    buildingId: data.buildingId,
    roomNumber: roomNumberTrim,
  });
  if (existing) {
    throw new ApiError(
      409,
      'DUPLICATE_ENTRY',
      `Phòng ${roomNumberTrim} đã tồn tại trong tòa nhà ${building.code}`
    );
  }

  // Tự động sinh danh sách giường nhúng tương ứng với sức chứa
  const capacity = Number(data.capacity);
  const beds = Array.from({ length: capacity }, (_, i) => ({
    bedNumber: i + 1,
    status: 'available',
    studentId: null,
  }));

  const room = await Room.create({
    ...data,
    roomNumber: roomNumberTrim,
    beds,
  });

  // Xóa cache danh sách phòng để sinh viên tra cứu thấy ngay phòng mới
  await cache.delByPattern('rooms:*');

  return room;
};

/**
 * Tra cứu phòng còn giường trống theo QUY TẮC NGĂN XẾP (FR-23 & BR-07)
 * Dùng cho Cổng Đăng ký KTX Online công khai và cán bộ xếp phòng
 * 
 * Luồng dữ liệu:
 * 1. Kiểm tra cache Redis: nếu có trả về ngay lập tức (~2ms)
 * 2. Lọc theo giới tính sinh viên: male hoặc female (BR-01)
 * 3. Chỉ lấy phòng có ít nhất 1 giường 'available'
 * 4. Sắp xếp ngăn xếp: floor ASC (tầng thấp trước), roomNumber ASC (phòng nhỏ trước)
 * 5. Lưu kết quả vào Redis cache
 */
const getAvailableRooms = async (query = {}) => {
  const gender = query.gender;
  const buildingId = query.buildingId;
  const cacheKey = `rooms:available:${gender || 'all'}:${buildingId || 'all'}`;

  return cache.wrap(
    cacheKey,
    async () => {
      const filter = {
        status: 'active',
        'beds.status': 'available', // Phòng phải còn ít nhất 1 giường trống
      };

      if (gender) {
        filter.gender = gender;
      }
      if (buildingId) {
        filter.buildingId = buildingId;
      }

      // Sắp xếp theo quy tắc ngăn xếp: Tầng thấp trước -> Số phòng nhỏ trước
      const rooms = await Room.find(filter)
        .populate('buildingId', 'code name')
        .sort({ floor: 1, roomNumber: 1 });

      // Format dữ liệu trả về thân thiện cho Frontend
      return rooms.map((r) => {
        const json = r.toJSON();
        const availableBeds = r.beds
          .filter((b) => b.status === 'available')
          .map((b) => b.bedNumber);

        return {
          id: json.id,
          building: r.buildingId,
          roomNumber: r.roomNumber,
          floor: r.floor,
          gender: r.gender,
          capacity: r.capacity,
          pricePerMonth: r.pricePerMonth,
          depositAmount: r.depositAmount,
          availableBedsCount: availableBeds.length,
          availableBedNumbers: availableBeds,
        };
      });
    },
    300 // Cache trong 5 phút
  );
};

/**
 * Xem danh sách phòng phân trang (FR-22)
 */
const getRooms = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.buildingId) filter.buildingId = query.buildingId;
  if (query.floor) filter.floor = Number(query.floor);
  if (query.gender) filter.gender = query.gender;
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.roomNumber = { $regex: query.search.trim(), $options: 'i' };
  }

  const [total, rooms] = await Promise.all([
    Room.countDocuments(filter),
    Room.find(filter)
      .populate('buildingId', 'code name')
      .populate('beds.studentId', 'studentCode fullName phone')
      .sort({ floor: 1, roomNumber: 1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    data: rooms,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Xem chi tiết phòng KTX
 */
const getRoomById = async (id) => {
  const room = await Room.findById(id)
    .populate('buildingId', 'code name description')
    .populate('beds.studentId', 'studentCode fullName phone className faculty email');

  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy thông tin phòng');
  }

  return room;
};

/**
 * Cập nhật thông tin phòng (FR-25)
 * Ràng buộc: Chặn sửa giới tính hoặc sức chứa nếu phòng đã có sinh viên đang ở
 */
const updateRoom = async (id, data) => {
  const room = await Room.findById(id);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  const hasOccupants = room.beds.some((b) => b.status === 'occupied');

  if (hasOccupants) {
    if (data.gender && data.gender !== room.gender) {
      throw new ApiError(
        422,
        'ROOM_HAS_OCCUPANTS',
        'Không thể đổi giới tính của phòng khi đang có sinh viên cư trú'
      );
    }
    if (data.capacity && Number(data.capacity) !== room.capacity) {
      throw new ApiError(
        422,
        'ROOM_HAS_OCCUPANTS',
        'Không thể thay đổi sức chứa của phòng khi đang có sinh viên cư trú'
      );
    }
  }

  // Nếu thay đổi sức chứa và phòng chưa có ai ở: cập nhật lại mảng giường
  if (data.capacity && Number(data.capacity) !== room.capacity && !hasOccupants) {
    const newCap = Number(data.capacity);
    room.capacity = newCap;
    room.beds = Array.from({ length: newCap }, (_, i) => ({
      bedNumber: i + 1,
      status: 'available',
      studentId: null,
    }));
  }

  if (data.floor !== undefined) room.floor = data.floor;
  if (data.pricePerMonth !== undefined) room.pricePerMonth = data.pricePerMonth;
  if (data.depositAmount !== undefined) room.depositAmount = data.depositAmount;
  if (data.status !== undefined) room.status = data.status;

  await room.save();

  // Xóa cache để cập nhật thông tin phòng
  await cache.delByPattern('rooms:*');

  return room;
};

module.exports = {
  getBuildings,
  createBuilding,
  updateBuilding,
  createRoom,
  getAvailableRooms,
  getRooms,
  getRoomById,
  updateRoom,
};

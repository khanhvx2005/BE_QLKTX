/**
 * Service xử lý logic nghiệp vụ cho Module Rooms (Tòa nhà, Loại phòng, Phòng, Giường).
 * Tuân thủ theo API.md §4 và DATA-SCHEMA.md §3.3 - 3.5 (Chuẩn v1.2).
 */

const Building = require('./building.model');
const RoomType = require('./room-type.model');
const Room = require('./room.model');
const Bed = require('./bed.model');
const Residency = require('../residencies/residency.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');

// ==========================================
// 1. Quản lý Tòa nhà (Buildings)
// ==========================================

const getBuildings = async (query = {}) => {
  const filter = {};
  if (query.includeInactive !== true && query.includeInactive !== 'true') {
    filter.isActive = true;
  }

  const buildings = await Building.find(filter).sort('code');

  const result = await Promise.all(
    buildings.map(async (b) => {
      const rooms = await Room.find({ buildingId: b._id, status: { $ne: 'inactive' } });
      const roomIds = rooms.map((r) => r._id);

      const beds = await Bed.find({ roomId: { $in: roomIds } });
      const totalBeds = beds.length;
      const occupiedBeds = beds.filter((bed) => bed.status === 'occupied').length;
      const availableBeds = beds.filter((bed) => bed.status === 'available').length;
      const maintenanceBeds = beds.filter((bed) => bed.status === 'maintenance').length;

      return {
        ...b.toJSON(),
        stats: {
          totalRooms: rooms.length,
          totalBeds,
          occupiedBeds,
          availableBeds,
          maintenanceBeds,
        },
      };
    })
  );

  return result;
};

const createBuilding = async (data) => {
  const codeUpper = data.code.trim().toUpperCase();
  const existing = await Building.findOne({ code: codeUpper });
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', 'Mã tòa nhà đã tồn tại', {
      errors: [{ field: 'code', message: 'Mã tòa nhà đã tồn tại trong hệ thống' }],
    });
  }

  const building = await Building.create({
    ...data,
    code: codeUpper,
  });

  return building;
};

const updateBuilding = async (id, data) => {
  const building = await Building.findById(id);
  if (!building) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tòa nhà');
  }

  // Chặn ngừng hoạt động tòa còn người ở (FR-25, BUILDING_HAS_OCCUPANTS)
  if (data.isActive === false && building.isActive === true) {
    const rooms = await Room.find({ buildingId: id });
    const roomIds = rooms.map((r) => r._id);
    const occupiedCount = await Bed.countDocuments({ roomId: { $in: roomIds }, status: 'occupied' });
    if (occupiedCount > 0) {
      throw new ApiError(422, 'BUILDING_HAS_OCCUPANTS', 'Tòa nhà đang có người ở, không thể ngừng hoạt động');
    }
  }

  Object.assign(building, data);
  await building.save();
  return building;
};

// ==========================================
// 2. Quản lý Loại phòng (Room Types)
// ==========================================

const getRoomTypes = async (query = {}, user = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.tier) filter.tier = query.tier;
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === true || query.isActive === 'true';
  }

  const [items, total] = await Promise.all([
    RoomType.find(filter).sort('pricePerMonth').skip(skip).limit(limit),
    RoomType.countDocuments(filter),
  ]);

  const withAvailability = query.withAvailability === true || query.withAvailability === 'true';

  let enrichedItems = items.map((t) => t.toJSON());

  if (withAvailability) {
    // Nếu là sinh viên gọi, xác định giới tính sinh viên để chỉ đếm các phòng đúng giới tính
    let studentGender = null;
    if (user?.role === 'student' && user?.studentId) {
      const student = await Student.findById(user.studentId);
      if (student) studentGender = student.gender;
    }

    enrichedItems = await Promise.all(
      enrichedItems.map(async (type) => {
        const roomFilter = { roomTypeId: type.id, status: 'active' };
        if (studentGender) {
          roomFilter.gender = studentGender;
        }

        const rooms = await Room.find(roomFilter);
        const roomIds = rooms.map((r) => r._id);

        const availableSlots = await Bed.countDocuments({
          roomId: { $in: roomIds },
          status: 'available',
        });

        return {
          ...type,
          roomCount: rooms.length,
          availableSlots,
        };
      })
    );
  }

  return {
    items: enrichedItems,
    total,
    page,
    limit,
  };
};

const createRoomType = async (data) => {
  const existing = await RoomType.findOne({ name: data.name.trim() });
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', 'Tên loại phòng đã tồn tại', {
      errors: [{ field: 'name', message: 'Tên loại phòng đã tồn tại' }],
    });
  }

  const roomType = await RoomType.create(data);
  return roomType;
};

const updateRoomType = async (id, data) => {
  const roomType = await RoomType.findById(id);
  if (!roomType) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy loại phòng');
  }

  // Khóa đổi tier/capacity khi đã có phòng dùng loại này (BR-09, ROOM_TYPE_IN_USE)
  const isChangingStructure =
    (data.tier && data.tier !== roomType.tier) ||
    (data.capacity && Number(data.capacity) !== roomType.capacity);

  if (isChangingStructure) {
    const roomsCount = await Room.countDocuments({ roomTypeId: id });
    if (roomsCount > 0) {
      throw new ApiError(
        422,
        'ROOM_TYPE_IN_USE',
        'Loại phòng đang được sử dụng, không thể đổi hạng hoặc sức chứa'
      );
    }
  }

  Object.assign(roomType, data);
  await roomType.save();
  return roomType;
};

// ==========================================
// 3. Quản lý Phòng (Rooms)
// ==========================================

const getRooms = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.buildingId) filter.buildingId = query.buildingId;
  if (query.roomTypeId) filter.roomTypeId = query.roomTypeId;
  if (query.floor) filter.floor = Number(query.floor);
  if (query.gender) filter.gender = query.gender;
  if (query.search) {
    filter.roomNumber = { $regex: query.search.trim(), $options: 'i' };
  }

  const rooms = await Room.find(filter)
    .populate('buildingId', 'code name')
    .populate('roomTypeId', 'name tier pricePerMonth')
    .sort('buildingId roomNumber');

  // Lấy chi tiết giường và tổng hợp chỉ số
  const roomItems = await Promise.all(
    rooms.map(async (room) => {
      const beds = await Bed.find({ roomId: room._id });
      const occupied = beds.filter((b) => b.status === 'occupied').length;
      const availableSlots = beds.filter((b) => b.status === 'available').length;
      const maintenanceBeds = beds.filter((b) => b.status === 'maintenance').length;

      return {
        id: room._id.toString(),
        buildingId: room.buildingId?._id?.toString() || null,
        buildingCode: room.buildingId?.code || '',
        buildingName: room.buildingId?.name || '',
        roomNumber: room.roomNumber,
        floor: room.floor,
        roomTypeId: room.roomTypeId?._id?.toString() || null,
        roomTypeName: room.roomTypeId?.name || '',
        tier: room.roomTypeId?.tier || 'standard',
        pricePerMonth: room.roomTypeId?.pricePerMonth || 0,
        gender: room.gender,
        capacity: room.capacity,
        occupied,
        availableSlots,
        maintenanceBeds,
        status: room.status,
      };
    })
  );

  // Lọc theo availability nếu có yêu cầu
  let filtered = roomItems;
  if (query.availability === 'has_slot') {
    filtered = filtered.filter((r) => r.availableSlots > 0);
  } else if (query.availability === 'full') {
    filtered = filtered.filter((r) => r.availableSlots === 0);
  } else if (query.availability === 'has_maintenance') {
    filtered = filtered.filter((r) => r.maintenanceBeds > 0);
  }

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    items: paginated,
    total,
    page,
    limit,
  };
};

const getAvailableRooms = async (query = {}, user = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = { status: 'active' };
  if (query.buildingId) filter.buildingId = query.buildingId;
  if (query.roomTypeId) filter.roomTypeId = query.roomTypeId;

  // Nếu là sinh viên: giới tính lấy từ hồ sơ sinh viên qua JWT, bỏ qua param gender
  if (user?.role === 'student' && user?.studentId) {
    const student = await Student.findById(user.studentId);
    if (student) filter.gender = student.gender;
  } else if (query.gender) {
    filter.gender = query.gender;
  }

  const rooms = await Room.find(filter)
    .populate('buildingId', 'code name')
    .populate('roomTypeId', 'name tier pricePerMonth')
    .sort('buildingId roomNumber');

  const availableRooms = [];
  for (const room of rooms) {
    const beds = await Bed.find({ roomId: room._id });
    const availableSlots = beds.filter((b) => b.status === 'available').length;
    const occupied = beds.filter((b) => b.status === 'occupied').length;

    if (availableSlots > 0) {
      availableRooms.push({
        id: room._id.toString(),
        roomNumber: room.roomNumber,
        floor: room.floor,
        buildingId: room.buildingId?._id?.toString() || null,
        buildingCode: room.buildingId?.code || '',
        buildingName: room.buildingId?.name || '',
        roomTypeId: room.roomTypeId?._id?.toString() || null,
        roomTypeName: room.roomTypeId?.name || '',
        tier: room.roomTypeId?.tier || 'standard',
        pricePerMonth: room.roomTypeId?.pricePerMonth || 0,
        gender: room.gender,
        capacity: room.capacity,
        occupied,
        availableSlots,
      });
    }
  }

  const total = availableRooms.length;
  const paginated = availableRooms.slice(skip, skip + limit);

  return {
    items: paginated,
    total,
    page,
    limit,
  };
};

const getRoomById = async (id) => {
  const room = await Room.findById(id)
    .populate('buildingId', 'code name')
    .populate('roomTypeId', 'name tier pricePerMonth amenities includedSupplies');

  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  const beds = await Bed.find({ roomId: room._id }).sort('bedNumber');

  // Lấy thông tin sinh viên đang ở trên từng giường (nếu có)
  const bedsWithOccupant = await Promise.all(
    beds.map(async (bed) => {
      let occupant = null;
      if (bed.status === 'occupied') {
        const residency = await Residency.findOne({ bedId: bed._id, status: 'active' }).populate(
          'studentId',
          'studentCode fullName className'
        );
        if (residency?.studentId) {
          occupant = {
            studentCode: residency.studentId.studentCode,
            studentName: residency.studentId.fullName,
            className: residency.studentId.className,
          };
        }
      }

      return {
        id: bed._id.toString(),
        bedNumber: bed.bedNumber,
        bedCode: bed.bedCode,
        status: bed.status,
        note: bed.note,
        occupant,
      };
    })
  );

  const occupied = beds.filter((b) => b.status === 'occupied').length;
  const availableSlots = beds.filter((b) => b.status === 'available').length;
  const maintenanceBeds = beds.filter((b) => b.status === 'maintenance').length;

  return {
    id: room._id.toString(),
    roomNumber: room.roomNumber,
    floor: room.floor,
    buildingName: room.buildingId?.name || '',
    buildingCode: room.buildingId?.code || '',
    gender: room.gender,
    status: room.status,
    roomTypeId: room.roomTypeId?._id?.toString() || null,
    roomTypeName: room.roomTypeId?.name || '',
    tier: room.roomTypeId?.tier || 'standard',
    pricePerMonth: room.roomTypeId?.pricePerMonth || 0,
    capacity: room.capacity,
    occupied,
    availableSlots,
    maintenanceBeds,
    amenities: room.roomTypeId?.amenities || [],
    includedSupplies: room.roomTypeId?.includedSupplies || [],
    beds: bedsWithOccupant,
  };
};

const createRoom = async (data) => {
  const building = await Building.findById(data.buildingId);
  if (!building) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tòa nhà');
  }

  const roomType = await RoomType.findById(data.roomTypeId);
  if (!roomType) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy loại phòng');
  }

  // Kiểm tra trùng số phòng trong tòa
  const existing = await Room.findOne({
    buildingId: data.buildingId,
    roomNumber: data.roomNumber.trim(),
  });
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', 'Số phòng đã tồn tại trong tòa nhà', {
      errors: [{ field: 'roomNumber', message: 'Số phòng đã tồn tại trong tòa nhà' }],
    });
  }

  // Tạo phòng với sức chứa sao chép từ RoomType
  const room = await Room.create({
    buildingId: data.buildingId,
    roomTypeId: data.roomTypeId,
    roomNumber: data.roomNumber.trim(),
    floor: Number(data.floor) || 1,
    gender: data.gender,
    capacity: roomType.capacity,
    status: data.status || 'active',
  });

  // Tự động sinh `capacity` giường theo mã chuẩn: B203-01, B203-02...
  const bedsToCreate = [];
  const buildingCode = building.code.toUpperCase();
  const roomNum = room.roomNumber;
  const prefix = roomNum.startsWith(buildingCode) ? roomNum : `${buildingCode}${roomNum}`;

  for (let i = 1; i <= roomType.capacity; i++) {
    const bedCode = `${prefix}-${String(i).padStart(2, '0')}`;
    bedsToCreate.push({
      roomId: room._id,
      bedNumber: i,
      bedCode,
      status: 'available',
      note: null,
    });
  }

  await Bed.insertMany(bedsToCreate);

  return {
    id: room._id.toString(),
    roomNumber: room.roomNumber,
    floor: room.floor,
    gender: room.gender,
    capacity: room.capacity,
    bedsCreated: room.capacity,
  };
};

const updateRoom = async (id, data) => {
  const room = await Room.findById(id);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  const occupiedCount = await Bed.countDocuments({ roomId: id, status: 'occupied' });

  // Kiểm tra nếu phòng đang có người ở thì cấm đổi loại phòng, giới tính hoặc chuyển inactive (BR-09, ROOM_HAS_OCCUPANTS)
  if (occupiedCount > 0) {
    const isChangingRoomType = data.roomTypeId && data.roomTypeId.toString() !== room.roomTypeId.toString();
    const isChangingGender = data.gender && data.gender !== room.gender;
    const isDeactivating = data.status && data.status !== 'active';

    if (isChangingRoomType || isChangingGender || isDeactivating) {
      throw new ApiError(
        422,
        'ROOM_HAS_OCCUPANTS',
        'Phòng đang có người ở, không thể đổi loại phòng hoặc giới tính'
      );
    }
  }

  // Nếu đổi loại phòng lúc phòng trống -> cập nhật lại capacity và sinh lại giường
  if (data.roomTypeId && data.roomTypeId.toString() !== room.roomTypeId.toString() && occupiedCount === 0) {
    const newRoomType = await RoomType.findById(data.roomTypeId);
    if (!newRoomType) {
      throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy loại phòng mới');
    }

    const building = await Building.findById(room.buildingId);
    const buildingCode = building ? building.code.toUpperCase() : '';
    const roomNum = data.roomNumber || room.roomNumber;
    const prefix = roomNum.startsWith(buildingCode) ? roomNum : `${buildingCode}${roomNum}`;

    await Bed.deleteMany({ roomId: id });

    const newBeds = [];
    for (let i = 1; i <= newRoomType.capacity; i++) {
      newBeds.push({
        roomId: room._id,
        bedNumber: i,
        bedCode: `${prefix}-${String(i).padStart(2, '0')}`,
        status: 'available',
        note: null,
      });
    }
    await Bed.insertMany(newBeds);
    room.capacity = newRoomType.capacity;
  }

  Object.assign(room, data);
  await room.save();
  return room;
};

// ==========================================
// 4. Quản lý Giường (Beds)
// ==========================================

const updateBedStatus = async (id, { status, note }) => {
  const bed = await Bed.findById(id);
  if (!bed) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy giường');
  }

  // Chặn đưa giường đang có người ở vào bảo trì (BED_OCCUPIED, 422)
  if (bed.status === 'occupied') {
    throw new ApiError(422, 'BED_OCCUPIED', 'Giường đang có người ở, không thể chuyển bảo trì');
  }

  bed.status = status;
  bed.note = status === 'maintenance' ? (note || null) : null;
  await bed.save();

  return bed;
};

module.exports = {
  // Buildings
  getBuildings,
  createBuilding,
  updateBuilding,

  // RoomTypes
  getRoomTypes,
  createRoomType,
  updateRoomType,

  // Rooms
  getRooms,
  getAvailableRooms,
  getRoomById,
  createRoom,
  updateRoom,

  // Beds
  updateBedStatus,
};

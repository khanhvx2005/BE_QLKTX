/**
 * Service xử lý logic nghiệp vụ cho Module Rooms (Tòa nhà, Phòng, Giường).
 * Tuân thủ theo API.md §4 và DATA-SCHEMA.md §3.3-3.5.
 */

const Building = require('./building.model');
const Room = require('./room.model');
const Bed = require('./bed.model');
const ApiError = require('../../core/errors/api-error');

// ==========================================
// 1. Quản lý Tòa nhà (Buildings)
// ==========================================

const getBuildings = async () => {
  const buildings = await Building.find({ isActive: true }).sort('code');

  // Tính toán thống kê tỷ lệ lấp đầy cho từng tòa nhà (Occupancy stats)
  const result = await Promise.all(
    buildings.map(async (b) => {
      const rooms = await Room.find({ buildingId: b._id, status: { $ne: 'inactive' } });
      const roomIds = rooms.map((r) => r._id);

      const beds = await Bed.find({ roomId: { $in: roomIds } });
      const totalBeds = beds.length;
      const occupiedBeds = beds.filter((bed) => bed.status === 'occupied').length;
      const availableBeds = beds.filter((bed) => bed.status === 'available').length;

      return {
        ...b.toJSON(),
        stats: {
          totalRooms: rooms.length,
          totalBeds,
          occupiedBeds,
          availableBeds,
        },
      };
    })
  );

  return result;
};

const createBuilding = async (data) => {
  const existing = await Building.findOne({ code: data.code.toUpperCase() });
  if (existing) {
    throw new ApiError(409, 'BUILDING_CODE_ALREADY_EXISTS', `Mã tòa nhà ${data.code} đã tồn tại`);
  }

  const building = await Building.create({
    ...data,
    code: data.code.toUpperCase(),
  });

  return building;
};

const updateBuilding = async (id, data) => {
  const building = await Building.findById(id);
  if (!building) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tòa nhà');
  }

  Object.assign(building, data);
  await building.save();
  return building;
};

// ==========================================
// 2. Quản lý Phòng (Rooms)
// ==========================================

const getRooms = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.buildingId) filter.buildingId = query.buildingId;
  if (query.gender) filter.gender = query.gender;
  if (query.status) filter.status = query.status;

  const rooms = await Room.find(filter)
    .populate('buildingId', 'code name')
    .sort('buildingId roomNumber');

  // Tính số lượng giường trống thực tế của từng phòng
  const enrichedRooms = await Promise.all(
    rooms.map(async (room) => {
      const beds = await Bed.find({ roomId: room._id });
      const totalBeds = beds.length;
      const availableBeds = beds.filter((b) => b.status === 'available').length;
      const occupiedBeds = beds.filter((b) => b.status === 'occupied').length;

      return {
        ...room.toJSON(),
        totalBeds,
        availableBeds,
        occupiedBeds,
      };
    })
  );

  // Lọc theo hasAvailableBed nếu query yêu cầu
  let finalItems = enrichedRooms;
  if (query.hasAvailableBed === true || query.hasAvailableBed === 'true') {
    finalItems = finalItems.filter((r) => r.availableBeds > 0);
  }

  const total = finalItems.length;
  const paginatedItems = finalItems.slice(skip, skip + limit);

  return {
    items: paginatedItems,
    total,
    page,
    limit,
  };
};

const getRoomById = async (id) => {
  const room = await Room.findById(id).populate('buildingId', 'code name address');
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  const beds = await Bed.find({ roomId: room._id }).sort('bedNumber');
  return {
    ...room.toJSON(),
    beds,
  };
};

const createRoom = async (data) => {
  // 1. Kiểm tra tòa nhà tồn tại
  const building = await Building.findById(data.buildingId);
  if (!building || !building.isActive) {
    throw new ApiError(404, 'NOT_FOUND', 'Tòa nhà không tồn tại hoặc đã bị vô hiệu hóa');
  }

  // 2. Kiểm tra trùng số phòng trong cùng 1 tòa nhà
  const existing = await Room.findOne({
    buildingId: data.buildingId,
    roomNumber: data.roomNumber.trim(),
  });
  if (existing) {
    throw new ApiError(409, 'ROOM_NUMBER_ALREADY_EXISTS', `Phòng ${data.roomNumber} đã tồn tại trong tòa nhà này`);
  }

  const room = await Room.create({
    ...data,
    roomNumber: data.roomNumber.trim(),
  });

  return room;
};

const updateRoom = async (id, data) => {
  const room = await Room.findById(id);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  // Nếu giảm capacity, kiểm tra xem số giường hiện có có vượt quá capacity mới không
  if (data.capacity && data.capacity < room.capacity) {
    const currentBedsCount = await Bed.countDocuments({ roomId: room._id });
    if (currentBedsCount > data.capacity) {
      throw new ApiError(
        422,
        'CAPACITY_LESS_THAN_BED_COUNT',
        `Không thể giảm sức chứa xuống ${data.capacity} vì phòng đang có ${currentBedsCount} giường`
      );
    }
  }

  Object.assign(room, data);
  await room.save();
  return room;
};

// ==========================================
// 3. Quản lý Giường (Beds)
// ==========================================

const getBedsByRoom = async (roomId) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  const beds = await Bed.find({ roomId }).sort('bedNumber');

  // Lấy thông tin sinh viên đang ở nếu có Residency model
  const mongoose = require('mongoose');
  const enrichedBeds = await Promise.all(
    beds.map(async (bed) => {
      const bedObj = bed.toJSON();
      if (bed.status === 'occupied' && mongoose.models.Residency) {
        const residency = await mongoose.models.Residency.findOne({
          bedId: bed._id,
          status: 'active',
        }).populate('studentId', 'fullName studentCode phone');
        bedObj.occupant = residency ? residency.studentId : null;
      } else {
        bedObj.occupant = null;
      }
      return bedObj;
    })
  );

  return enrichedBeds;
};

const addBed = async (roomId, { bedNumber }) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  // Kiểm tra sức chứa
  const currentBedCount = await Bed.countDocuments({ roomId });
  if (currentBedCount >= room.capacity) {
    throw new ApiError(
      422,
      'ROOM_CAPACITY_EXCEEDED',
      `Phòng đã đạt sức chứa tối đa (${room.capacity} giường)`
    );
  }

  // Kiểm tra trùng số giường trong phòng
  const existing = await Bed.findOne({ roomId, bedNumber });
  if (existing) {
    throw new ApiError(409, 'BED_NUMBER_ALREADY_EXISTS', `Giường số ${bedNumber} đã tồn tại trong phòng này`);
  }

  const bed = await Bed.create({
    roomId,
    bedNumber,
    status: 'available',
  });

  return bed;
};

/**
 * Tự động sinh danh sách giường từ 1 đến capacity của phòng.
 */
const generateBeds = async (roomId) => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  const existingBeds = await Bed.find({ roomId });
  const existingNumbers = new Set(existingBeds.map((b) => b.bedNumber));

  const bedsToCreate = [];
  for (let i = 1; i <= room.capacity; i++) {
    if (!existingNumbers.has(i)) {
      bedsToCreate.push({
        roomId: room._id,
        bedNumber: i,
        status: 'available',
      });
    }
  }

  if (bedsToCreate.length > 0) {
    await Bed.insertMany(bedsToCreate);
  }

  const allBeds = await Bed.find({ roomId }).sort('bedNumber');
  return allBeds;
};

/**
 * Thay đổi trạng thái giường thủ công (chuyển bảo trì hoặc có sẵn).
 * Không được phép đổi nếu giường đang có sinh viên ở ('occupied').
 */
const updateBedStatus = async (bedId, newStatus) => {
  const bed = await Bed.findById(bedId);
  if (!bed) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy giường');
  }

  if (bed.status === 'occupied') {
    throw new ApiError(422, 'BED_IS_OCCUPIED', 'Không thể đổi trạng thái giường đang có sinh viên lưu trú');
  }

  bed.status = newStatus;
  await bed.save();
  return bed;
};

module.exports = {
  // Buildings
  getBuildings,
  createBuilding,
  updateBuilding,
  // Rooms
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  // Beds
  getBedsByRoom,
  addBed,
  generateBeds,
  updateBedStatus,
};

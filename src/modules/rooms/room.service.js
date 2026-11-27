/**
 * Tòa nhà 3 Cơ sở & Phòng KTX theo bảng giá HaUI 2026–2027 (quản lý gọn tới cấp Phòng).
 */

const Building = require('./building.model');
const Room = require('./room.model');
const Contract = require('../contracts/contract.model');
const Student = require('../students/student.model');
const { fail, fieldErrors, paginate, matches, isObjectId } = require('../../core/utils/http');
const { CAMPUSES, CAMPUS_INFO, ROOM_TIERS, ROOM_CAPACITY, ROOM_PRICES_2026 } = require('../../shared/constants/enums');
const { byId } = require('../../shared/views');

const numericSort = (a, b) =>
  String(a.campus || '').localeCompare(String(b.campus || '')) ||
  String(a.buildingCode || '').localeCompare(String(b.buildingCode || '')) ||
  a.floor - b.floor ||
  String(a.roomNumber).localeCompare(String(b.roomNumber), 'vi', { numeric: true });

const defaultAmenitiesFor = (tier, capacity) => {
  if (tier === 'high_quality') {
    return [
      'Wifi miễn phí',
      'Điều hòa',
      'Bình nóng lạnh',
      'Tủ cá nhân',
      capacity <= 3 ? 'Giường gỗ' : 'Giường tầng',
      'Đệm',
      'Quạt trần',
      'Dụng cụ vệ sinh',
      'Khép kín >30m²',
    ];
  }
  return ['Wifi miễn phí', 'Bình nóng lạnh', 'Tủ cá nhân', 'Giường tầng', 'Quạt trần', 'Dụng cụ vệ sinh', 'Khép kín >30m²'];
};

const availableSlotsOf = (r) => (r.status === 'maintenance' ? 0 : Math.max(0, (r.capacity || 0) - (r.occupiedCount || 0)));
const maintenanceSlotsOf = (r) => (r.status === 'maintenance' ? Math.max(0, (r.capacity || 0) - (r.occupiedCount || 0)) : 0);

const roomBase = (r, b) => {
  const cInfo = b?.campus ? CAMPUS_INFO[b.campus] : null;
  return {
    id: String(r._id),
    campus: b?.campus ?? null,
    campusName: cInfo?.name ?? null,
    buildingId: String(r.buildingId),
    buildingCode: b?.code ?? null,
    buildingName: b?.name ?? null,
    roomNumber: r.roomNumber,
    floor: r.floor,
    gender: r.gender,
    roomTier: r.roomTier || 'standard',
    capacity: r.capacity,
    hasAirConditioner: Boolean(r.hasAirConditioner),
    hasWaterHeater: r.hasWaterHeater !== false,
    amenities: Array.isArray(r.amenities) ? r.amenities : [],
    pricePerMonth: r.pricePerMonth,
    depositAmount: r.depositAmount,
    status: r.status,
  };
};

const roomView = (r, b, pendingCount = 0) => ({
  ...roomBase(r, b),
  occupied: r.occupiedCount || 0,
  availableSlots: availableSlotsOf(r),
  maintenanceSlots: maintenanceSlotsOf(r),
  pendingApplications: pendingCount,
});

const buildingView = (b, rooms = []) => {
  const own = rooms.filter((r) => String(r.buildingId) === String(b._id));
  const cInfo = CAMPUS_INFO[b.campus] || null;
  return {
    id: String(b._id),
    campus: b.campus,
    campusName: cInfo?.name ?? null,
    campusAddress: cInfo?.address ?? null,
    code: b.code,
    name: b.name,
    totalFloors: b.totalFloors || 5,
    description: b.description ?? '',
    isActive: b.isActive,
    stats: {
      totalRooms: own.length,
      totalSlots: own.reduce((t, r) => t + (r.capacity || 0), 0),
      occupiedSlots: own.reduce((t, r) => t + (r.occupiedCount || 0), 0),
      availableSlots: own.reduce((t, r) => t + availableSlotsOf(r), 0),
      maintenanceSlots: own.reduce((t, r) => t + maintenanceSlotsOf(r), 0),
    },
  };
};

// ---------------------------------------------------------------- tòa nhà
async function listBuildings(q = {}) {
  const filter = String(q.includeInactive) === 'true' ? {} : { isActive: true };
  if (q.campus && CAMPUSES.includes(q.campus)) filter.campus = q.campus;
  const list = await Building.find(filter).sort({ campus: 1, code: 1 }).lean();
  const rooms = await Room.find({ buildingId: { $in: list.map((b) => b._id) } })
    .select('buildingId capacity occupiedCount status')
    .lean();
  return { data: list.map((b) => buildingView(b, rooms)) };
}

async function createBuilding(body = {}) {
  const campus = String(body.campus || 'cs1').trim().toLowerCase();
  const code = String(body.code || '').trim().toUpperCase();
  const name = String(body.name || '').trim();
  const totalFloors = body.totalFloors !== undefined ? Number(body.totalFloors) : 5;
  const errors = [];
  if (!CAMPUSES.includes(campus)) errors.push({ field: 'campus', message: 'Cơ sở không hợp lệ (hiện quản lý Cơ sở 1)' });
  if (!code) errors.push({ field: 'code', message: 'Nhập mã tòa nhà' });
  else if (!/^[A-Z0-9-]{1,10}$/.test(code)) errors.push({ field: 'code', message: 'Mã gồm chữ, số, dấu -, tối đa 10 ký tự' });
  if (!name) errors.push({ field: 'name', message: 'Nhập tên tòa nhà' });
  if (!Number.isInteger(totalFloors) || totalFloors < 1) errors.push({ field: 'totalFloors', message: 'Số tầng phải là số nguyên >= 1' });
  if (errors.length) fieldErrors(errors);

  if (await Building.exists({ code })) {
    fail(409, 'DUPLICATE_ENTRY', `Mã tòa nhà ${code} đã tồn tại`, {
      errors: [{ field: 'code', message: `Mã tòa nhà ${code} đã tồn tại` }],
    });
  }
  const b = await Building.create({
    campus,
    code,
    name,
    totalFloors,
    description: String(body.description || '').trim(),
    isActive: true,
  });
  return { data: buildingView(b.toObject()), message: `Đã thêm tòa nhà ${name}`, status: 201 };
}

async function updateBuilding(id, body = {}) {
  const b = isObjectId(id) ? await Building.findById(id) : null;
  if (!b) fail(404, 'NOT_FOUND', 'Không tìm thấy tòa nhà');
  if (body.name !== undefined && !String(body.name).trim()) fieldErrors([{ field: 'name', message: 'Nhập tên tòa nhà' }]);
  if (body.campus !== undefined && !CAMPUSES.includes(body.campus)) {
    fieldErrors([{ field: 'campus', message: 'Cơ sở không hợp lệ (cs1, cs2, cs3)' }]);
  }
  const rooms = await Room.find({ buildingId: b._id }).select('_id buildingId capacity occupiedCount status').lean();
  if (body.isActive === false && b.isActive) {
    const occupied = rooms.reduce((t, r) => t + (r.occupiedCount || 0), 0);
    if (occupied > 0) fail(422, 'BUILDING_HAS_OCCUPANTS', `Tòa ${b.name} còn ${occupied} sinh viên đang ở hoặc giữ chỗ, không thể ngừng hoạt động`);
    const hasPending = await Contract.exists({
      roomId: { $in: rooms.map((r) => r._id) },
      status: { $in: ['pending', 'pending_payment'] },
    });
    if (hasPending) {
      fail(422, 'BUILDING_HAS_PENDING_APPLICATIONS', `Tòa ${b.name} đang có đơn chờ xử lý hoặc chờ đóng phí, không thể ngừng hoạt động`);
    }
  }
  if (body.campus !== undefined) b.campus = body.campus;
  if (body.name !== undefined) b.name = String(body.name).trim();
  if (body.totalFloors !== undefined && Number.isInteger(Number(body.totalFloors)) && Number(body.totalFloors) >= 1) {
    b.totalFloors = Number(body.totalFloors);
  }
  if (body.description !== undefined) b.description = String(body.description).trim();
  if (typeof body.isActive === 'boolean') b.isActive = body.isActive;
  await b.save();
  const message =
    body.isActive === false
      ? 'Đã ngừng hoạt động tòa nhà'
      : body.isActive === true && Object.keys(body).length === 1
      ? 'Đã kích hoạt lại tòa nhà'
      : 'Cập nhật tòa nhà thành công';
  return { data: buildingView(b.toObject(), rooms), message };
}

// ---------------------------------------------------------------- phòng
const roomErrors = ({ roomNumber, floor, gender, roomTier = 'standard', capacity, pricePerMonth, depositAmount, status = 'active' }) => {
  const errors = [];
  const money = (v) => v !== '' && v !== null && v !== undefined && Number.isInteger(Number(v)) && Number(v) >= 0;
  if (!String(roomNumber || '').trim()) errors.push({ field: 'roomNumber', message: 'Nhập số phòng' });
  if (!(Number(floor) >= 1)) errors.push({ field: 'floor', message: 'Nhập tầng (>= 1)' });
  if (gender !== undefined && gender !== null && gender !== '' && !['male', 'female'].includes(gender)) {
    errors.push({ field: 'gender', message: 'Giới tính phòng phải là male, female hoặc bỏ trống' });
  }
  if (!ROOM_TIERS.includes(roomTier)) errors.push({ field: 'roomTier', message: 'Hạng phòng phải là high_quality, standard hoặc basic' });
  if (!ROOM_CAPACITY.includes(Number(capacity))) errors.push({ field: 'capacity', message: 'Sức chứa phải là 2, 3, 4 hoặc 6 người' });
  if (!money(pricePerMonth)) errors.push({ field: 'pricePerMonth', message: 'Nhập đơn giá thuê (số nguyên, không âm)' });
  if (!money(depositAmount)) errors.push({ field: 'depositAmount', message: 'Nhập tiền cọc (số nguyên, không âm)' });
  if (!['active', 'maintenance'].includes(status)) errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
  return errors;
};

async function assertRoomNumberFree(buildingId, roomNumber, exceptId = null) {
  if (await Room.exists({ buildingId, roomNumber, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })) {
    fail(409, 'DUPLICATE_ENTRY', 'Số phòng đã tồn tại trong tòa nhà', {
      errors: [{ field: 'roomNumber', message: 'Số phòng đã tồn tại trong tòa nhà' }],
    });
  }
}

async function listRooms(q = {}) {
  const filter = {};
  if (q.buildingId && isObjectId(q.buildingId)) filter.buildingId = q.buildingId;
  if (q.floor) filter.floor = Number(q.floor);
  if (q.gender === 'empty') filter.gender = null;
  else if (q.gender) filter.gender = q.gender;
  if (q.roomTier) filter.roomTier = q.roomTier;
  if (q.capacity) filter.capacity = Number(q.capacity);
  if (q.status) filter.status = q.status;

  if (q.campus && CAMPUSES.includes(q.campus) && !filter.buildingId) {
    const campusBuildings = await Building.find({ campus: q.campus }).select('_id').lean();
    filter.buildingId = { $in: campusBuildings.map((b) => b._id) };
  }

  const rooms = await Room.find(filter).lean();
  const [buildings, pendingAgg] = await Promise.all([
    Building.find({ _id: { $in: rooms.map((r) => r.buildingId) } }).lean(),
    Contract.aggregate([
      { $match: { roomId: { $in: rooms.map((r) => r._id) }, status: 'pending' } },
      { $group: { _id: '$roomId', n: { $sum: 1 } } },
    ]),
  ]);
  const bMap = byId(buildings);
  const pendingMap = new Map(pendingAgg.map((x) => [String(x._id), x.n]));

  let rows = rooms.map((r) => roomView(r, bMap.get(String(r.buildingId)), pendingMap.get(String(r._id)) || 0)).sort(numericSort);
  if (q.availability === 'has_slot') rows = rows.filter((r) => r.availableSlots > 0);
  if (q.availability === 'full') rows = rows.filter((r) => r.availableSlots === 0);
  rows = rows.filter((r) => matches(q.search, [r.roomNumber, r.buildingName, r.buildingCode, `${r.buildingCode}-${r.roomNumber}`]));
  return { data: paginate(rows, { limit: 100, ...q }) };
}

/** Chi tiết phòng kèm danh sách sinh viên đang cư trú / giữ chỗ trong phòng */
async function getRoom(id) {
  const r = isObjectId(id) ? await Room.findById(id).lean() : null;
  if (!r) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  const b = await Building.findById(r.buildingId).lean();
  const [holding, pendingCount] = await Promise.all([
    Contract.find({ roomId: r._id, status: { $in: ['pending_payment', 'active'] } }).lean(),
    Contract.countDocuments({ roomId: r._id, status: 'pending' }),
  ]);
  const students = byId(await Student.find({ _id: { $in: holding.map((c) => c.studentId) } }).lean());
  const occupants = holding
    .map((c) => {
      const st = students.get(String(c.studentId));
      return st
        ? {
            contractId: String(c._id),
            contractCode: c.contractCode,
            contractStatus: c.status,
            studentId: String(st._id),
            studentCode: st.studentCode,
            fullName: st.fullName,
            className: st.className ?? null,
            faculty: st.faculty ?? null,
            checkedInAt: c.checkedInAt ?? null,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b2) => a.studentCode.localeCompare(b2.studentCode));

  return { data: { ...roomView(r, b, pendingCount), occupants } };
}

async function createRoom(body = {}) {
  const b = isObjectId(body.buildingId) ? await Building.findById(body.buildingId).lean() : null;
  const roomTier = body.roomTier || 'standard';
  const capacity = Number(body.capacity);
  const suggestedPrice = b && ROOM_PRICES_2026[roomTier]?.[capacity]?.[b.campus];
  const pricePerMonth = body.pricePerMonth !== undefined ? Number(body.pricePerMonth) : suggestedPrice;
  const depositAmount = body.depositAmount !== undefined ? Number(body.depositAmount) : 500000;

  const errors = roomErrors({ ...body, roomTier, capacity, pricePerMonth, depositAmount });
  if (!b) errors.push({ field: 'buildingId', message: 'Chọn tòa nhà' });
  if (errors.length) fieldErrors(errors);

  const roomNumber = String(body.roomNumber).trim();
  await assertRoomNumberFree(b._id, roomNumber);
  const hasAirConditioner = body.hasAirConditioner !== undefined ? Boolean(body.hasAirConditioner) : roomTier === 'high_quality';
  const hasWaterHeater = body.hasWaterHeater !== undefined ? Boolean(body.hasWaterHeater) : true;
  const amenities = Array.isArray(body.amenities) && body.amenities.length ? body.amenities : defaultAmenitiesFor(roomTier, capacity);

  const r = await Room.create({
    buildingId: b._id,
    roomNumber,
    floor: Number(body.floor),
    gender: body.gender || null,
    roomTier,
    capacity,
    occupiedCount: 0,
    hasAirConditioner,
    hasWaterHeater,
    amenities,
    pricePerMonth,
    depositAmount,
    status: 'active',
  });
  return { data: roomView(r.toObject(), b), message: `Đã tạo phòng ${b.code}-${roomNumber} (${capacity} chỗ)`, status: 201 };
}

async function updateRoom(id, body = {}) {
  const r = isObjectId(id) ? await Room.findById(id) : null;
  if (!r) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  const current = r.toObject();
  const errors = roomErrors({ ...current, ...body });
  if (errors.length) fieldErrors(errors);

  const capacity = Number(body.capacity ?? r.capacity);
  const nextGender = body.gender !== undefined ? (body.gender || null) : r.gender;
  const genderChanged = body.gender !== undefined && nextGender !== r.gender;
  if (r.occupiedCount > 0 && genderChanged) {
    fail(422, 'ROOM_HAS_OCCUPANTS', 'Phòng đang có sinh viên ở hoặc giữ chỗ, không thể đổi giới tính');
  }
  if (capacity < r.occupiedCount) {
    fail(422, 'CAPACITY_BELOW_OCCUPIED', `Phòng đang có ${r.occupiedCount} người ở/giữ chỗ, không thể giảm sức chứa xuống ${capacity}`);
  }
  if (genderChanged && (await Contract.exists({ roomId: r._id, status: { $in: ['pending', 'pending_payment'] } }))) {
    fail(422, 'ROOM_HAS_PENDING_APPLICATIONS', 'Phòng đang có đơn chờ xử lý, không đổi được giới tính');
  }
  const roomNumber = body.roomNumber !== undefined ? String(body.roomNumber).trim() : r.roomNumber;
  if (roomNumber !== r.roomNumber) await assertRoomNumberFree(r.buildingId, roomNumber, r._id);

  r.roomNumber = roomNumber;
  r.capacity = capacity;
  if (body.floor !== undefined) r.floor = Number(body.floor);
  if (body.gender !== undefined) r.gender = nextGender;
  if (body.roomTier) r.roomTier = body.roomTier;
  if (body.hasAirConditioner !== undefined) r.hasAirConditioner = Boolean(body.hasAirConditioner);
  if (body.hasWaterHeater !== undefined) r.hasWaterHeater = Boolean(body.hasWaterHeater);
  if (Array.isArray(body.amenities)) r.amenities = body.amenities;
  if (body.pricePerMonth !== undefined) r.pricePerMonth = Number(body.pricePerMonth);
  if (body.depositAmount !== undefined) r.depositAmount = Number(body.depositAmount);
  if (body.status) r.status = body.status;
  await r.save();
  const b = await Building.findById(r.buildingId).lean();
  return { data: roomView(r.toObject(), b), message: 'Cập nhật phòng thành công' };
}

module.exports = {
  listBuildings,
  createBuilding,
  updateBuilding,
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  roomBase,
  roomView,
  defaultAmenitiesFor,
  availableSlotsOf,
  maintenanceSlotsOf,
  numericSort,
};

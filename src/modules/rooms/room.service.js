/**
 * Tòa nhà và phòng — API.md §4. Giường nằm trong phòng (beds[]), giá và cọc nằm trên phòng.
 * Chỗ trống = số giường `available` — KHÔNG tính bằng sức chứa − số người ở (BR-05).
 */

const Building = require('./building.model');
const Room = require('./room.model');
const Contract = require('../contracts/contract.model');
const Student = require('../students/student.model');
const { fail, fieldErrors, paginate, matches } = require('../../core/utils/http');
const { byId } = require('../../shared/views');

const numericSort = (a, b) => a.floor - b.floor || String(a.roomNumber).localeCompare(String(b.roomNumber), 'vi', { numeric: true });

// ---------------------------------------------------------------- dạng trả ra
const roomBase = (r, b) => ({
  id: String(r._id),
  buildingId: String(r.buildingId),
  buildingCode: b?.code ?? null,
  buildingName: b?.name ?? null,
  roomNumber: r.roomNumber,
  floor: r.floor,
  gender: r.gender,
  capacity: r.capacity,
  pricePerMonth: r.pricePerMonth,
  depositAmount: r.depositAmount,
  status: r.status,
});

const bedCount = (r, status) => (r.beds || []).filter((x) => x.status === status).length;

const roomView = (r, b) => ({
  ...roomBase(r, b),
  occupied: bedCount(r, 'occupied'),
  availableSlots: bedCount(r, 'available'),
  maintenanceBeds: bedCount(r, 'maintenance'),
});

const buildingView = (b, rooms = []) => {
  const own = rooms.filter((r) => String(r.buildingId) === String(b._id));
  const bedsOf = (status) => own.reduce((t, r) => t + bedCount(r, status), 0);
  return {
    id: String(b._id),
    code: b.code,
    name: b.name,
    description: b.description ?? '',
    isActive: b.isActive,
    stats: {
      totalRooms: own.length,
      totalBeds: own.reduce((t, r) => t + (r.beds || []).length, 0),
      occupiedBeds: bedsOf('occupied'),
      availableBeds: bedsOf('available'),
      maintenanceBeds: bedsOf('maintenance'),
    },
  };
};

/** Giường của phòng: 1..capacity, giữ nguyên giường đã có (trạng thái bảo trì, người ở) */
const bedsFor = (capacity, existing = []) => Array.from({ length: capacity }, (_, i) => {
  const n = i + 1;
  return existing.find((x) => x.bedNumber === n) ?? { bedNumber: n, status: 'available', studentId: null };
});

// ---------------------------------------------------------------- tòa nhà
async function listBuildings(q = {}) {
  const filter = String(q.includeInactive) === 'true' ? {} : { isActive: true };
  const list = await Building.find(filter).sort({ code: 1 }).lean();
  const rooms = await Room.find({ buildingId: { $in: list.map((b) => b._id) } }).select('buildingId beds').lean();
  return { data: list.map((b) => buildingView(b, rooms)) };
}

async function createBuilding(body = {}) {
  const code = String(body.code || '').trim().toUpperCase();
  const name = String(body.name || '').trim();
  const errors = [];
  if (!code) errors.push({ field: 'code', message: 'Nhập mã tòa nhà' });
  else if (!/^[A-Z0-9-]{1,10}$/.test(code)) errors.push({ field: 'code', message: 'Mã gồm chữ, số, dấu -, tối đa 10 ký tự' });
  if (!name) errors.push({ field: 'name', message: 'Nhập tên tòa nhà' });
  if (errors.length) fieldErrors(errors);
  if (await Building.exists({ code })) {
    fail(409, 'DUPLICATE_ENTRY', `Mã tòa nhà ${code} đã tồn tại`, { errors: [{ field: 'code', message: `Mã tòa nhà ${code} đã tồn tại` }] });
  }
  const b = await Building.create({ code, name, description: String(body.description || '').trim(), isActive: true });
  return { data: buildingView(b.toObject()), message: `Đã thêm tòa nhà ${name}`, status: 201 };
}

/** { name, description, isActive } — không đổi mã; không ngừng hoạt động khi còn người ở (FR-21) */
async function updateBuilding(id, body = {}) {
  const b = await Building.findById(id);
  if (!b) fail(404, 'NOT_FOUND', 'Không tìm thấy tòa nhà');
  if (body.name !== undefined && !String(body.name).trim()) fieldErrors([{ field: 'name', message: 'Nhập tên tòa nhà' }]);
  const rooms = await Room.find({ buildingId: b._id }).select('buildingId beds').lean();
  if (body.isActive === false && b.isActive) {
    const occupied = rooms.reduce((t, r) => t + bedCount(r, 'occupied'), 0);
    if (occupied > 0) fail(422, 'BUILDING_HAS_OCCUPANTS', `Tòa ${b.name} còn ${occupied} sinh viên đang ở, không thể ngừng hoạt động`);
  }
  if (body.name !== undefined) b.name = String(body.name).trim();
  if (body.description !== undefined) b.description = String(body.description).trim();
  if (typeof body.isActive === 'boolean') b.isActive = body.isActive;
  await b.save();
  // Tên tòa luôn đọc từ bản ghi tòa khi trả phòng / hợp đồng → đổi tên là hiện ngay ở mọi màn
  const message = body.isActive === false ? 'Đã ngừng hoạt động tòa nhà'
    : body.isActive === true && Object.keys(body).length === 1 ? 'Đã kích hoạt lại tòa nhà' : 'Cập nhật tòa nhà thành công';
  return { data: buildingView(b.toObject(), rooms), message };
}

// ---------------------------------------------------------------- phòng
const roomErrors = ({ roomNumber, floor, gender, capacity, pricePerMonth, depositAmount, status = 'active' }) => {
  const errors = [];
  const money = (v) => v !== '' && v !== null && v !== undefined && Number.isInteger(Number(v)) && Number(v) >= 0;
  if (!String(roomNumber || '').trim()) errors.push({ field: 'roomNumber', message: 'Nhập số phòng' });
  if (!(Number(floor) >= 1)) errors.push({ field: 'floor', message: 'Nhập tầng' });
  if (!['male', 'female'].includes(gender)) errors.push({ field: 'gender', message: 'Vui lòng chọn giới tính phòng' });
  if (![4, 6, 8].includes(Number(capacity))) errors.push({ field: 'capacity', message: 'Sức chứa phải là 4, 6 hoặc 8' });
  if (!money(pricePerMonth)) errors.push({ field: 'pricePerMonth', message: 'Nhập đơn giá thuê (số nguyên, không âm)' });
  if (!money(depositAmount)) errors.push({ field: 'depositAmount', message: 'Nhập tiền cọc (số nguyên, không âm)' });
  if (!['active', 'maintenance'].includes(status)) errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
  return errors;
};

async function assertRoomNumberFree(buildingId, roomNumber, exceptId = null) {
  if (await Room.exists({ buildingId, roomNumber, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })) {
    fail(409, 'DUPLICATE_ENTRY', 'Số phòng đã tồn tại trong tòa nhà', { errors: [{ field: 'roomNumber', message: 'Số phòng đã tồn tại trong tòa nhà' }] });
  }
}

async function listRooms(q = {}) {
  const filter = {};
  if (q.buildingId) filter.buildingId = q.buildingId;
  if (q.floor) filter.floor = Number(q.floor);
  if (q.gender) filter.gender = q.gender;
  if (q.capacity) filter.capacity = Number(q.capacity);
  if (q.status) filter.status = q.status;
  const rooms = await Room.find(filter).lean();
  const buildings = byId(await Building.find({ _id: { $in: rooms.map((r) => r.buildingId) } }).lean());
  let rows = rooms.map((r) => roomView(r, buildings.get(String(r.buildingId)))).sort(numericSort);
  if (q.availability === 'has_slot') rows = rows.filter((r) => r.availableSlots > 0);
  if (q.availability === 'full') rows = rows.filter((r) => r.availableSlots === 0);
  rows = rows.filter((r) => matches(q.search, [r.roomNumber, r.buildingName, `${r.buildingCode}-${r.roomNumber}`]));
  return { data: paginate(rows, { limit: 100, ...q }) };
}

/** Chi tiết phòng: mỗi giường kèm người ở (MSSV, tên, lớp) và cờ có đơn chờ giữ (`hasPendingApplication`) */
async function getRoom(id) {
  const r = await Room.findById(id).lean();
  if (!r) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  const b = await Building.findById(r.buildingId).lean();
  const [active, pending] = await Promise.all([
    Contract.find({ roomId: r._id, status: 'active' }).lean(),
    Contract.find({ roomId: r._id, status: 'pending' }).select('bedNumber').lean(),
  ]);
  const students = byId(await Student.find({ _id: { $in: active.map((c) => c.studentId) } }).lean());
  const beds = (r.beds || []).slice().sort((x, y) => x.bedNumber - y.bedNumber).map((bed) => {
    const c = active.find((x) => x.bedNumber === bed.bedNumber);
    const st = c && students.get(String(c.studentId));
    return {
      bedNumber: bed.bedNumber,
      bedCode: `${b?.code ?? ''}-${r.roomNumber}-${String(bed.bedNumber).padStart(2, '0')}`,
      status: bed.status,
      hasPendingApplication: pending.some((p) => p.bedNumber === bed.bedNumber),
      occupant: st ? { studentCode: st.studentCode, fullName: st.fullName, className: st.className ?? null } : null,
    };
  });
  return { data: { ...roomView(r, b), beds } };
}

async function createRoom(body = {}) {
  const b = body.buildingId && /^[a-f\d]{24}$/i.test(body.buildingId) ? await Building.findById(body.buildingId).lean() : null;
  const errors = roomErrors(body);
  if (!b) errors.push({ field: 'buildingId', message: 'Chọn tòa nhà' });
  if (errors.length) fieldErrors(errors);
  const roomNumber = String(body.roomNumber).trim();
  await assertRoomNumberFree(b._id, roomNumber);
  const capacity = Number(body.capacity);
  const r = await Room.create({
    buildingId: b._id, roomNumber, floor: Number(body.floor), gender: body.gender, capacity,
    pricePerMonth: Number(body.pricePerMonth), depositAmount: Number(body.depositAmount), status: 'active',
    beds: bedsFor(capacity),
  });
  return { data: roomView(r.toObject(), b), message: `Đã tạo phòng ${roomNumber} với ${capacity} giường`, status: 201 };
}

/** FR-25: phòng có người không đổi giới tính / sức chứa. Đổi sức chứa giữ giường cũ, chỉ thêm/bớt giường số lớn */
async function updateRoom(id, body = {}) {
  const r = await Room.findById(id);
  if (!r) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  const current = r.toObject();
  const errors = roomErrors({ ...current, ...body });
  if (errors.length) fieldErrors(errors);
  const capacity = Number(body.capacity ?? r.capacity);
  const capacityChanged = capacity !== r.capacity;
  const genderChanged = body.gender && body.gender !== r.gender;
  const hasOccupants = r.beds.some((x) => x.status === 'occupied');
  if (hasOccupants && (capacityChanged || genderChanged)) {
    fail(422, 'ROOM_HAS_OCCUPANTS', 'Phòng đang có người ở, không thể đổi giới tính hoặc sức chứa');
  }
  // Đơn chờ duyệt đã chọn phòng theo giới tính cũ → đổi giới tính là xếp SV vào phòng khác giới
  if (genderChanged && (await Contract.exists({ roomId: r._id, status: 'pending' }))) {
    fail(422, 'ROOM_HAS_PENDING_APPLICATIONS', 'Phòng đang có đơn chờ duyệt, không đổi được giới tính');
  }
  const roomNumber = body.roomNumber !== undefined ? String(body.roomNumber).trim() : r.roomNumber;
  if (roomNumber !== r.roomNumber) await assertRoomNumberFree(r.buildingId, roomNumber, r._id);
  if (capacityChanged) {
    const orphan = await Contract.findOne({ roomId: r._id, status: 'pending', bedNumber: { $gt: capacity } }).lean();
    if (orphan) {
      fail(422, 'ROOM_HAS_PENDING_APPLICATIONS', `Đơn ${orphan.contractCode} đang chọn giường ${String(orphan.bedNumber).padStart(2, '0')}, không giảm sức chứa xuống ${capacity} được`);
    }
    r.beds = bedsFor(capacity, current.beds);
    r.capacity = capacity;
  }
  r.roomNumber = roomNumber;
  if (body.floor !== undefined) r.floor = Number(body.floor);
  if (body.gender) r.gender = body.gender;
  if (body.pricePerMonth !== undefined) r.pricePerMonth = Number(body.pricePerMonth);
  if (body.depositAmount !== undefined) r.depositAmount = Number(body.depositAmount);
  if (body.status) r.status = body.status;
  await r.save();
  const b = await Building.findById(r.buildingId).lean();
  return { data: roomView(r.toObject(), b), message: 'Cập nhật phòng thành công' };
}

module.exports = {
  listBuildings, createBuilding, updateBuilding, listRooms, getRoom, createRoom, updateRoom,
  roomBase, roomView, numericSort, bedCount,
};

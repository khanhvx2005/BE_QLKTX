/**
 * Chỉ số điện nước (API.md §7, FR-40→41) và hóa đơn (HaUI - DMS v3.0).
 *
 * Luồng tháng:
 *   1. Lấy bảng lưới (`sheet`) theo tòa & tháng.
 *   2. Lưu hàng loạt (`saveBulk`): kiểm tra nối tiếp `oldIndex === previous.newIndex` (trừ khi `allowMeterReset: true`).
 *   3. Chốt & phát hành cả tòa (`publish`): mỗi phòng CÓ NGƯỜI ở -> MỘT hóa đơn phòng (`scope: 'room'`),
 *      bắn Chuông thông báo In-app + Email đồng loạt tới toàn bộ thành viên trong phòng.
 */

const Building = require('../rooms/building.model');
const Room = require('../rooms/room.model');
const Contract = require('../contracts/contract.model');
const UtilityReading = require('./utility-reading.model');
const Invoice = require('./invoice.model');
const Payment = require('../payments/payment.model');
const notificationService = require('../notifications/notification.service');
const { sendUtilityBillEmail } = require('../../core/email/email.service');
const { fail, fieldErrors, paginate, matches, isObjectId } = require('../../core/utils/http');
const { utilityInvoiceCode } = require('../../core/utils/code-generator');
const { localMonth, today, addDays } = require('../../core/utils/dates');
const { loadCtx, invoiceView, paymentView, residentsOf, byId } = require('../../shared/views');
const { numericSort } = require('../rooms/room.service');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const isIndex = (v) => v !== '' && v !== null && v !== undefined && Number.isInteger(Number(v)) && Number(v) >= 0;
const isPrice = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
const monthText = (m) => {
  const [y, mm] = m.split('-');
  return `Tháng ${Number(mm)}/${y}`;
};

const checkMonth = (value, field = 'monthYear') => {
  const monthYear = String(value || '');
  if (!MONTH_RE.test(monthYear)) fieldErrors([{ field, message: 'Chọn tháng (YYYY-MM)' }]);
  if (monthYear > localMonth()) fieldErrors([{ field, message: 'Chưa tới tháng này, không nhập trước được' }]);
  return monthYear;
};

async function findBuilding(id) {
  const b = isObjectId(id) ? await Building.findById(id).lean() : null;
  if (!b) fail(404, 'NOT_FOUND', 'Không tìm thấy tòa nhà');
  return b;
}

/** Phòng phải ghi điện nước: phòng active hoặc phòng bảo trì nhưng vẫn còn người ở */
async function billableRoomsOf(buildingId) {
  const rooms = await Room.find({ buildingId }).lean();
  return rooms
    .filter((r) => r.status === 'active' || (r.occupiedCount || 0) > 0)
    .sort(numericSort);
}

const meterOf = (oldIndex, newIndex, unitPrice) => ({
  oldIndex,
  newIndex,
  usage: newIndex - oldIndex,
  unitPrice,
  amount: (newIndex - oldIndex) * unitPrice,
});

const readingView = (u) => (u ? UtilityReading.hydrate(u).toJSON() : null);

/** GET /utility-readings/sheet?buildingId=&monthYear= */
async function sheet(q = {}) {
  const building = await findBuilding(q.buildingId);
  const monthYear = checkMonth(q.monthYear);
  const rooms = await billableRoomsOf(building._id);
  const roomIds = rooms.map((r) => r._id);
  const readings = await UtilityReading.find({ roomId: { $in: roomIds }, monthYear: { $lte: monthYear } }).lean();
  const occupied = await Contract.aggregate([
    { $match: { roomId: { $in: roomIds }, status: 'active' } },
    { $group: { _id: '$roomId', n: { $sum: 1 } } },
  ]);
  const occOf = new Map(occupied.map((x) => [String(x._id), x.n]));
  const latest = readings
    .slice()
    .sort((a, b) => b.monthYear.localeCompare(a.monthYear) || new Date(b.recordedAt) - new Date(a.recordedAt))[0];

  return {
    data: {
      buildingId: String(building._id),
      buildingCode: building.code,
      campus: building.campus,
      monthYear,
      defaultUnitPrices: {
        electricity: latest?.electricity.unitPrice ?? 0,
        water: latest?.water.unitPrice ?? 0,
      },
      rows: rooms.map((r) => {
        const own = readings.filter((u) => String(u.roomId) === String(r._id));
        const prev = own.filter((u) => u.monthYear < monthYear).sort((a, b) => b.monthYear.localeCompare(a.monthYear))[0];
        return {
          room: {
            id: String(r._id),
            roomNumber: r.roomNumber,
            floor: r.floor,
            roomTier: r.roomTier,
            capacity: r.capacity,
            status: r.status,
            occupied: occOf.get(String(r._id)) ?? 0,
          },
          previous: prev ? { electricityNewIndex: prev.electricity.newIndex, waterNewIndex: prev.water.newIndex } : null,
          reading: readingView(own.find((u) => u.monthYear === monthYear)),
        };
      }),
    },
  };
}

/**
 * POST /utility-readings/bulk — { buildingId, monthYear, electricityUnitPrice, waterUnitPrice, rows[] }.
 * Kiểm tra nối tiếp chỉ số với tháng trước trừ khi `row.allowMeterReset === true`.
 */
async function saveBulk(body = {}, actor) {
  const building = await findBuilding(body.buildingId);
  const monthYear = checkMonth(body.monthYear);
  const priceErrors = [];
  if (!isPrice(body.electricityUnitPrice)) priceErrors.push({ field: 'electricityUnitPrice', message: 'Đơn giá điện phải là số nguyên lớn hơn 0' });
  if (!isPrice(body.waterUnitPrice)) priceErrors.push({ field: 'waterUnitPrice', message: 'Đơn giá nước phải là số nguyên lớn hơn 0' });
  if (priceErrors.length) fieldErrors(priceErrors);

  const billableRooms = await billableRoomsOf(building._id);
  const rooms = byId(billableRooms);
  const prevReadings = await UtilityReading.find({
    roomId: { $in: billableRooms.map((r) => r._id) },
    monthYear: { $lt: monthYear },
  })
    .sort({ monthYear: -1 })
    .lean();
  const prevByRoom = new Map();
  for (const r of prevReadings) {
    const key = String(r.roomId);
    if (!prevByRoom.has(key)) prevByRoom.set(key, r);
  }

  const errors = [];
  let savedCount = 0;

  for (const row of Array.isArray(body.rows) ? body.rows : []) {
    const err = (message, code = 'VALIDATION_ERROR') => errors.push({ roomId: row.roomId, code, message });
    const room = rooms.get(String(row.roomId));
    if (!room) {
      err('Phòng không thuộc tòa này, hoặc đang bảo trì và không có người ở');
      continue;
    }
    const fields = ['electricityOldIndex', 'electricityNewIndex', 'waterOldIndex', 'waterNewIndex'];
    if (!fields.every((f) => isIndex(row[f]))) {
      err('Nhập đủ 4 chỉ số, là số nguyên không âm');
      continue;
    }
    const v = Object.fromEntries(fields.map((f) => [f, Number(row[f])]));
    if (v.electricityNewIndex < v.electricityOldIndex || v.waterNewIndex < v.waterOldIndex) {
      err('Chỉ số mới không được nhỏ hơn chỉ số cũ');
      continue;
    }

    const prev = prevByRoom.get(String(room._id));
    if (prev && !row.allowMeterReset) {
      if (v.electricityOldIndex !== prev.electricity.newIndex || v.waterOldIndex !== prev.water.newIndex) {
        err(
          `Chỉ số cũ không khớp kỳ trước (Điện: ${prev.electricity.newIndex}, Nước: ${prev.water.newIndex}). Bật allowMeterReset nếu vừa thay công tơ`,
          'METER_INDEX_MISMATCH'
        );
        continue;
      }
    }

    const existing = await UtilityReading.findOne({ roomId: room._id, monthYear }).lean();
    if (existing?.isBilled) {
      err('Tháng này đã chốt, không sửa được chỉ số');
      continue;
    }

    const electricity = meterOf(v.electricityOldIndex, v.electricityNewIndex, Number(body.electricityUnitPrice));
    const water = meterOf(v.waterOldIndex, v.waterNewIndex, Number(body.waterUnitPrice));

    await UtilityReading.updateOne(
      { roomId: room._id, monthYear, isBilled: false },
      {
        $set: {
          electricity,
          water,
          totalAmount: electricity.amount + water.amount,
          recordedBy: actor.id,
          recordedByName: actor.fullName,
          recordedAt: new Date(),
        },
      },
      { upsert: true }
    );
    savedCount += 1;
  }

  return {
    data: { savedCount, errors },
    message: errors.length ? `Đã lưu ${savedCount} phòng, ${errors.length} phòng lỗi` : `Đã lưu ${savedCount} phòng`,
  };
}

/**
 * POST /utility-readings/publish — { buildingId, monthYear } (FR-41).
 * Chốt 01 hóa đơn điện nước/phòng, khóa bản ghi, bắn Thông báo In-app & Email đồng loạt.
 */
async function publish(body = {}) {
  const building = await findBuilding(body.buildingId);
  const monthYear = checkMonth(body.monthYear);
  const rooms = await billableRoomsOf(building._id);
  const skipped = [];
  let publishedCount = 0;
  let notifiedCount = 0;

  for (const room of rooms) {
    const reading = await UtilityReading.findOne({ roomId: room._id, monthYear, isBilled: false }).lean();
    if (!reading) continue;
    const residents = await residentsOf(room._id);
    if (!residents.length) {
      skipped.push({ roomId: String(room._id), roomNumber: room.roomNumber, reason: 'Phòng không có người ở' });
      continue;
    }

    const perStudentAmount = Math.round(reading.totalAmount / residents.length);
    const locked = await UtilityReading.findOneAndUpdate(
      { _id: reading._id, isBilled: false },
      { $set: { isBilled: true, occupantsCount: residents.length, perStudentAmount } },
      { returnDocument: 'after' }
    );
    if (!locked) continue;

    const dueDate = addDays(today(), 7);
    const invoiceCode = utilityInvoiceCode(building.code, room.roomNumber, monthYear);
    let invoice;
    try {
      invoice = await Invoice.create({
        invoiceCode,
        type: 'utility',
        scope: 'room',
        amount: reading.totalAmount,
        description: `Tiền điện nước Phòng ${building.code}-${room.roomNumber} - ${monthText(monthYear)} (${residents.length} người)`,
        studentId: null,
        roomId: room._id,
        utilityReadingId: reading._id,
        monthYear,
        dueDate,
        status: 'unpaid',
      });
    } catch (err) {
      await UtilityReading.updateOne({ _id: reading._id }, { $set: { isBilled: false, occupantsCount: null, perStudentAmount: null } });
      throw err;
    }

    // Bắn Chuông thông báo & Email đồng loạt tới toàn bộ thành viên trong phòng (BR-03)
    const label = `${building.code}-${room.roomNumber}`;
    await notificationService
      .notifyStudents(
        residents.map(({ student }) => student._id),
        {
          type: 'utility',
          campus: building.campus,
          title: `Hóa đơn điện nước ${monthText(monthYear)} — Phòng ${label}`,
          content: `Tổng tiền điện nước phòng là ${reading.totalAmount.toLocaleString('vi-VN')} VNĐ (tạm chia ${perStudentAmount.toLocaleString('vi-VN')}đ/người). Hạn thanh toán: ${dueDate}.`,
          refType: 'invoice',
          refId: invoice._id,
        }
      )
      .catch(() => {});

    for (const { student } of residents) {
      if (student.email) {
        sendUtilityBillEmail({
          to: student.email,
          studentName: student.fullName,
          roomLabel: label,
          monthYear: monthText(monthYear),
          totalAmount: reading.totalAmount,
          perStudentAmount,
          dueDate,
          invoiceCode,
        }).catch(() => {});
      }
    }

    publishedCount += 1;
    notifiedCount += residents.length;
  }

  if (!publishedCount) {
    fail(422, 'NOTHING_TO_PUBLISH', 'Không có phòng nào sẵn sàng phát hành: chưa nhập chỉ số, đã chốt hết, hoặc phòng không có người ở', { skipped });
  }
  return {
    data: { publishedCount, notifiedCount, skipped },
    message: `Đã phát hành ${publishedCount} hóa đơn điện nước và gửi thông báo tới ${notifiedCount} sinh viên`,
  };
}

/** GET /utility-readings/history?roomId=&limit=12 */
async function history(q = {}) {
  if (!isObjectId(q.roomId) || !(await Room.exists({ _id: q.roomId }))) fail(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  const limit = Math.min(Number(q.limit) || 12, 24);
  const list = await UtilityReading.find({ roomId: q.roomId }).sort({ monthYear: -1 }).limit(limit).lean();
  return { data: list.map(readingView) };
}

// ================================================================ Hóa đơn

async function invoiceViews(list) {
  const ctx = await loadCtx({
    roomIds: list.map((i) => i.roomId),
    studentIds: list.flatMap((i) => [i.studentId, i.payerStudentId]),
  });
  return list.map((i) => invoiceView(i, ctx));
}

/** GET /invoices?status=&type=&scope=&campus=&buildingId=&search=&page=&limit= */
async function listInvoices(q = {}) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.scope) filter.scope = q.scope;
  let rows = await invoiceViews(await Invoice.find(filter).lean());
  if (q.campus) rows = rows.filter((i) => i.room?.campus === q.campus);
  if (q.buildingId) rows = rows.filter((i) => i.room?.buildingId === String(q.buildingId));
  rows = rows.filter((i) =>
    matches(q.search, [
      i.invoiceCode,
      i.student?.studentCode,
      i.student?.fullName,
      i.room?.roomNumber,
      i.room && `${i.room.buildingCode}-${i.room.roomNumber}`,
    ])
  );
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.invoiceCode.localeCompare(a.invoiceCode));

  const sum = (list) => list.reduce((t, i) => t + i.amount, 0);
  const effective = rows.filter((i) => i.status !== 'cancelled');
  const unpaid = effective.filter((i) => i.status === 'unpaid');
  const summary = {
    totalAmount: sum(effective),
    paidAmount: sum(effective.filter((i) => i.status === 'paid')),
    unpaidAmount: sum(unpaid),
    unpaidCount: unpaid.length,
    cancelledCount: rows.length - effective.length,
  };
  return { data: paginate(rows, q, { summary }) };
}

/** GET /invoices/:id */
async function getInvoice(id) {
  const inv = isObjectId(id) ? await Invoice.findById(id).lean() : null;
  if (!inv) fail(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  const payments = await Payment.find({ invoiceId: inv._id }).sort({ paidAt: -1 }).lean();
  const ctx = await loadCtx({
    roomIds: [inv.roomId],
    studentIds: [inv.studentId, inv.payerStudentId, ...payments.map((p) => p.payerStudentId)],
  });
  const detail = {
    ...invoiceView(inv, ctx),
    contractCode: inv.contractId ? (await Contract.findById(inv.contractId).select('contractCode').lean())?.contractCode ?? null : null,
    payments: payments.map((p) => paymentView(p, ctx, new Map([[String(inv._id), inv]]))),
  };
  if (inv.type === 'utility') {
    detail.reading = readingView(inv.utilityReadingId ? await UtilityReading.findById(inv.utilityReadingId).lean() : null);
    detail.members = (await residentsOf(inv.roomId)).map(({ student }) => ({
      id: String(student._id),
      studentCode: student.studentCode,
      fullName: student.fullName,
    }));
  }
  return { data: detail };
}

module.exports = {
  sheet,
  saveBulk,
  publish,
  history,
  listInvoices,
  getInvoice,
  invoiceViews,
  readingView,
};

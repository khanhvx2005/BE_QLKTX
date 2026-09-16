/**
 * Service xử lý nghiệp vụ cho Module Fees (Biểu phí, Chỉ số Điện Nước, Hóa đơn).
 * Thực thi thuật toán chia đều điện nước phòng theo PRD.md §2.9 (Quy tắc A2), DATA-SCHEMA.md §3.8 - §3.10 và API.md §7 (v1.2.9 - v1.2.12).
 */

const FeeType = require('./fee-type.model');
const UtilityReading = require('./utility-reading.model');
const Invoice = require('./invoice.model');
const Payment = require('../payments/payment.model');
const Room = require('../rooms/room.model');
const Bed = require('../rooms/bed.model');
const Residency = require('../residencies/residency.model');
const Contract = require('../contracts/contract.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');
const { generateInvoiceCode } = require('../../core/utils/code-generator');

const SYSTEM_FEE_CODES = ['rent', 'electricity', 'water', 'deposit', 'supplies', 'other'];

// ==========================================
// 1. Quản lý Biểu phí (Fee Types - API.md §7 v1.2.9)
// ==========================================

const getFeeTypes = async (query = {}) => {
  const filter = {};
  if (query.includeInactive !== true && query.includeInactive !== 'true') {
    filter.isActive = true;
  }

  const feeTypes = await FeeType.find(filter).sort('code');
  return feeTypes.map((f) => ({
    ...f.toJSON(),
    isSystem: SYSTEM_FEE_CODES.includes(f.code),
  }));
};

const createFeeType = async (data) => {
  const codeLower = data.code.trim().toLowerCase();
  const existing = await FeeType.findOne({ code: codeLower });
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', `Mã loại phí ${codeLower} đã tồn tại`, {
      errors: [{ field: 'code', message: `Mã loại phí ${codeLower} đã tồn tại` }],
    });
  }

  if (['electricity', 'water'].includes(codeLower) && data.defaultAmount <= 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Đơn giá điện nước phải lớn hơn 0', {
      errors: [{ field: 'defaultAmount', message: 'Đơn giá điện nước phải lớn hơn 0' }],
    });
  }

  const feeType = await FeeType.create({
    ...data,
    code: codeLower,
  });

  return {
    ...feeType.toJSON(),
    isSystem: SYSTEM_FEE_CODES.includes(feeType.code),
  };
};

const updateFeeType = async (id, data) => {
  const feeType = await FeeType.findById(id);
  if (!feeType) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy loại phí');
  }

  delete data.code; // Không cho phép đổi code

  if (SYSTEM_FEE_CODES.includes(feeType.code)) {
    if (data.isActive === false) {
      throw new ApiError(
        422,
        'FEE_TYPE_REQUIRED',
        'Không thể vô hiệu hóa loại phí hệ thống bắt buộc'
      );
    }
    delete data.isRecurring; // isRecurring của hệ thống là cố định
  }

  Object.assign(feeType, data);
  await feeType.save();

  return {
    ...feeType.toJSON(),
    isSystem: SYSTEM_FEE_CODES.includes(feeType.code),
  };
};

// ==========================================
// 2. Quản lý Chỉ số Điện Nước (Utility Readings - API.md §7 v1.2.10)
// ==========================================

const getUtilityReadings = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.billingPeriod) filter.billingPeriod = query.billingPeriod;
  if (query.roomId) filter.roomId = query.roomId;

  let readings = await UtilityReading.find(filter)
    .populate({
      path: 'roomId',
      select: 'roomNumber gender floor buildingId',
      populate: { path: 'buildingId', select: 'code name' },
    })
    .populate('recordedBy', 'fullName')
    .sort('-billingPeriod');

  if (query.buildingId) {
    readings = readings.filter(
      (r) => r.roomId?.buildingId?._id?.toString() === query.buildingId.toString()
    );
  }

  const total = readings.length;
  const paginated = readings.slice(skip, skip + limit);

  const items = paginated.map((r) => {
    const room = r.roomId;
    const building = room?.buildingId;
    return {
      id: r._id.toString(),
      roomId: room?._id ? room._id.toString() : (r.roomId ? r.roomId.toString() : ''),
      roomNumber: room?.roomNumber || '',
      buildingId: building?._id ? building._id.toString() : '',
      buildingName: building?.name || '',
      billingPeriod: r.billingPeriod,
      electricityStart: r.electricityStart,
      electricityEnd: r.electricityEnd,
      waterStart: r.waterStart,
      waterEnd: r.waterEnd,
      electricityUnitPrice: r.electricityUnitPrice,
      waterUnitPrice: r.waterUnitPrice,
      electricityConsumption: r.electricityConsumption,
      electricityAmount: r.electricityAmount,
      waterConsumption: r.waterConsumption,
      waterAmount: r.waterAmount,
      isInvoiced: Boolean(r.isInvoiced),
      recordedByName: r.recordedBy?.fullName || 'Ban quản lý',
      recordedAt: r.recordedAt || r.createdAt,
    };
  });

  return {
    items,
    total,
    page,
    limit,
  };
};

const recordUtilityReading = async (data, actorId = null) => {
  const { roomId, billingPeriod, electricityStart, electricityEnd, waterStart, waterEnd } = data;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYearMonth = `${currentYear}-${currentMonth}`;

  if (billingPeriod > currentYearMonth) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Dữ liệu không hợp lệ',
      { errors: [{ field: 'billingPeriod', message: 'Kỳ ghi chỉ số không được vượt quá tháng hiện tại' }] }
    );
  }

  if (electricityEnd < electricityStart) {
    throw new ApiError(
      422,
      'INVALID_METER_READING',
      'Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ'
    );
  }
  if (waterEnd < waterStart) {
    throw new ApiError(
      422,
      'INVALID_METER_READING',
      'Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ'
    );
  }

  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  const existing = await UtilityReading.findOne({ roomId, billingPeriod });
  if (existing) {
    throw new ApiError(
      409,
      'DUPLICATE_ENTRY',
      `Phòng này đã được ghi chỉ số điện nước cho kỳ ${billingPeriod}`,
      { errors: [{ field: 'billingPeriod', message: 'Kỳ này đã có chỉ số điện nước' }] }
    );
  }

  const [electricityFeeType, waterFeeType] = await Promise.all([
    FeeType.findOne({ code: 'electricity' }),
    FeeType.findOne({ code: 'water' }),
  ]);

  const electricityUnitPrice = electricityFeeType ? electricityFeeType.defaultAmount : 2500;
  const waterUnitPrice = waterFeeType ? waterFeeType.defaultAmount : 12000;

  const electricityConsumption = electricityEnd - electricityStart;
  const waterConsumption = waterEnd - waterStart;
  const electricityAmount = electricityConsumption * electricityUnitPrice;
  const waterAmount = waterConsumption * waterUnitPrice;

  const reading = await UtilityReading.create({
    roomId,
    billingPeriod,
    electricityStart,
    electricityEnd,
    waterStart,
    waterEnd,
    electricityUnitPrice,
    waterUnitPrice,
    electricityConsumption,
    waterConsumption,
    electricityAmount,
    waterAmount,
    isInvoiced: false,
    recordedBy: actorId,
    recordedAt: new Date(),
  });

  return {
    id: reading._id.toString(),
    electricityConsumption,
    electricityAmount,
    waterConsumption,
    waterAmount,
    isInvoiced: false,
  };
};

const updateUtilityReading = async (id, data, actorId = null) => {
  const reading = await UtilityReading.findById(id);
  if (!reading) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi chỉ số');
  }

  if (reading.isInvoiced) {
    throw new ApiError(
      422,
      'READING_ALREADY_INVOICED',
      'Kỳ này đã lập hóa đơn, không thể sửa chỉ số'
    );
  }

  const eStart = data.electricityStart !== undefined ? data.electricityStart : reading.electricityStart;
  const eEnd = data.electricityEnd !== undefined ? data.electricityEnd : reading.electricityEnd;
  const wStart = data.waterStart !== undefined ? data.waterStart : reading.waterStart;
  const wEnd = data.waterEnd !== undefined ? data.waterEnd : reading.waterEnd;

  if (eEnd < eStart) {
    throw new ApiError(422, 'INVALID_METER_READING', 'Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ');
  }
  if (wEnd < wStart) {
    throw new ApiError(422, 'INVALID_METER_READING', 'Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ');
  }

  reading.electricityStart = eStart;
  reading.electricityEnd = eEnd;
  reading.waterStart = wStart;
  reading.waterEnd = wEnd;
  reading.electricityConsumption = eEnd - eStart;
  reading.waterConsumption = wEnd - wStart;
  reading.electricityAmount = reading.electricityConsumption * reading.electricityUnitPrice;
  reading.waterAmount = reading.waterConsumption * reading.waterUnitPrice;

  if (actorId) {
    reading.recordedBy = actorId;
    reading.recordedAt = new Date();
  }

  await reading.save();
  return reading;
};

// ==========================================
// 3. Quản lý Hóa đơn & Lập hàng loạt (API.md §7 v1.2.11)
// ==========================================

const parseBuildingIds = (rawIds) => {
  if (!rawIds) return [];
  if (Array.isArray(rawIds)) return rawIds;
  return String(rawIds).split(',').map((id) => id.trim()).filter(Boolean);
};

/**
 * Xem trước lập hóa đơn hàng loạt (API.md §7 v1.2.11 - GET /api/invoices/generation-preview)
 * Chạy cùng thuật toán với generateInvoices nhưng KHÔNG ghi vào CSDL.
 */
const getGenerationPreview = async ({ billingPeriod, buildingIds }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYearMonth = `${currentYear}-${currentMonth}`;

  if (billingPeriod > currentYearMonth) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Dữ liệu không hợp lệ',
      { errors: [{ field: 'billingPeriod', message: 'Kỳ lập hóa đơn không được vượt quá tháng hiện tại' }] }
    );
  }

  const bIds = parseBuildingIds(buildingIds);
  const roomFilter = { status: { $ne: 'inactive' } };
  if (bIds.length > 0) {
    roomFilter.buildingId = { $in: bIds };
  }

  const rooms = await Room.find(roomFilter).populate('buildingId', 'code name');

  let created = 0;
  let updated = 0;
  let totalAmount = 0;
  let eligibleStudents = 0;
  let readyRooms = 0;
  const skipped = [];

  for (const room of rooms) {
    const reading = await UtilityReading.findOne({
      roomId: room._id,
      billingPeriod,
    });

    const bCode = room.buildingId?.code || '';

    if (!reading) {
      skipped.push({
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        buildingCode: bCode,
        code: 'NO_READING',
        reason: 'Chưa nhập chỉ số điện nước',
      });
      continue;
    }

    if (reading.isInvoiced) {
      skipped.push({
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        buildingCode: bCode,
        code: 'ALREADY_INVOICED',
        reason: 'Kỳ này đã lập hóa đơn',
      });
      continue;
    }

    const beds = await Bed.find({ roomId: room._id });
    const bedIds = beds.map((b) => b._id);

    const activeResidencies = await Residency.find({
      bedId: { $in: bedIds },
      status: 'active',
    }).populate('studentId', 'studentCode fullName');

    const validResidencies = activeResidencies.filter((r) => r.studentId);
    const n = validResidencies.length;

    if (n === 0) {
      skipped.push({
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        buildingCode: bCode,
        code: 'NO_RESIDENT',
        reason: 'Không có sinh viên đang ở',
      });
      continue;
    }

    readyRooms += 1;
    eligibleStudents += n;

    validResidencies.sort((a, b) =>
      a.studentId.studentCode.localeCompare(b.studentId.studentCode)
    );

    const eTotal = reading.electricityAmount;
    const eBase = Math.floor(eTotal / n);
    const eRemainder = eTotal - eBase * n;

    const wTotal = reading.waterAmount;
    const wBase = Math.floor(wTotal / n);
    const wRemainder = wTotal - wBase * n;

    for (let i = 0; i < n; i++) {
      const resItem = validResidencies[i];
      const student = resItem.studentId;

      const studentElectricity = i === 0 ? eBase + eRemainder : eBase;
      const studentWater = i === 0 ? wBase + wRemainder : wBase;

      const existingInvoice = await Invoice.findOne({
        studentId: student._id,
        billingPeriod,
        type: 'monthly',
        status: { $ne: 'cancelled' },
      });

      if (existingInvoice) {
        updated += 1;
        totalAmount += studentElectricity + studentWater;
      } else {
        created += 1;
        const contract = await Contract.findOne({
          studentId: student._id,
          status: 'active',
        });
        const roomRent = contract ? contract.monthlyPrice : 0;
        totalAmount += roomRent + studentElectricity + studentWater;
      }
    }
  }

  return {
    created,
    updated,
    totalAmount,
    eligibleStudents,
    readyRooms,
    skipped,
  };
};

/**
 * Lập hóa đơn hàng loạt (API.md §7 v1.2.11 - POST /api/invoices/generate)
 * Ghi CSDL, chia đều điện nước và hỗ trợ bổ sung dòng điện nước vào HĐ tháng đã có (BR-48).
 */
const generateInvoices = async ({ billingPeriod, buildingIds, dueDate }, creatorUserId) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYearMonth = `${currentYear}-${currentMonth}`;

  if (billingPeriod > currentYearMonth) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Dữ liệu không hợp lệ',
      { errors: [{ field: 'billingPeriod', message: 'Kỳ lập hóa đơn không được vượt quá tháng hiện tại' }] }
    );
  }

  const bIds = parseBuildingIds(buildingIds);
  const roomFilter = { status: { $ne: 'inactive' } };
  if (bIds.length > 0) {
    roomFilter.buildingId = { $in: bIds };
  }

  const rooms = await Room.find(roomFilter).populate('buildingId', 'code name');

  let created = 0;
  let updated = 0;
  let totalAmount = 0;
  let eligibleStudents = 0;
  let readyRooms = 0;
  const skipped = [];

  const [electricityFeeType, waterFeeType, rentFeeType] = await Promise.all([
    FeeType.findOne({ code: 'electricity' }),
    FeeType.findOne({ code: 'water' }),
    FeeType.findOne({ code: 'rent' }),
  ]);

  const [year, month] = billingPeriod.split('-');
  const periodLabel = `${month}/${year}`;

  for (const room of rooms) {
    const reading = await UtilityReading.findOne({
      roomId: room._id,
      billingPeriod,
    });

    const bCode = room.buildingId?.code || '';

    if (!reading) {
      skipped.push({
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        buildingCode: bCode,
        code: 'NO_READING',
        reason: 'Chưa nhập chỉ số điện nước',
      });
      continue;
    }

    if (reading.isInvoiced) {
      skipped.push({
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        buildingCode: bCode,
        code: 'ALREADY_INVOICED',
        reason: 'Kỳ này đã lập hóa đơn',
      });
      continue;
    }

    const beds = await Bed.find({ roomId: room._id });
    const bedIds = beds.map((b) => b._id);

    const activeResidencies = await Residency.find({
      bedId: { $in: bedIds },
      status: 'active',
    }).populate('studentId', 'studentCode fullName');

    const validResidencies = activeResidencies.filter((r) => r.studentId);
    const n = validResidencies.length;

    if (n === 0) {
      skipped.push({
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        buildingCode: bCode,
        code: 'NO_RESIDENT',
        reason: 'Không có sinh viên đang ở',
      });
      continue;
    }

    readyRooms += 1;
    eligibleStudents += n;

    validResidencies.sort((a, b) =>
      a.studentId.studentCode.localeCompare(b.studentId.studentCode)
    );

    const eTotal = reading.electricityAmount;
    const eBase = Math.floor(eTotal / n);
    const eRemainder = eTotal - eBase * n;

    const wTotal = reading.waterAmount;
    const wBase = Math.floor(wTotal / n);
    const wRemainder = wTotal - wBase * n;

    for (let i = 0; i < n; i++) {
      const resItem = validResidencies[i];
      const student = resItem.studentId;

      const studentElectricity = i === 0 ? eBase + eRemainder : eBase;
      const studentWater = i === 0 ? wBase + wRemainder : wBase;

      const contract = await Contract.findOne({
        studentId: student._id,
        status: 'active',
      });

      const existingInvoice = await Invoice.findOne({
        studentId: student._id,
        billingPeriod,
        type: 'monthly',
        status: { $ne: 'cancelled' },
      });

      const electricityDesc = `Tiền điện tháng ${periodLabel} (${reading.electricityConsumption} kWh, chia đều ${n} người)`;
      const waterDesc = `Tiền nước tháng ${periodLabel} (${reading.waterConsumption} m3, chia đều ${n} người)`;

      if (existingInvoice) {
        existingInvoice.lineItems.push(
          {
            feeTypeId: electricityFeeType?._id || null,
            description: electricityDesc,
            quantity: 1,
            unitPrice: studentElectricity,
            amount: studentElectricity,
          },
          {
            feeTypeId: waterFeeType?._id || null,
            description: waterDesc,
            quantity: 1,
            unitPrice: studentWater,
            amount: studentWater,
          }
        );

        existingInvoice.totalAmount = existingInvoice.lineItems.reduce(
          (sum, item) => sum + item.amount,
          0
        );

        await existingInvoice.save();
        updated += 1;
        totalAmount += studentElectricity + studentWater;
      } else {
        const roomRent = contract ? contract.monthlyPrice : 0;
        const lineItems = [
          {
            feeTypeId: rentFeeType?._id || null,
            description: `Tiền phòng tháng ${periodLabel}`,
            quantity: 1,
            unitPrice: roomRent,
            amount: roomRent,
          },
          {
            feeTypeId: electricityFeeType?._id || null,
            description: electricityDesc,
            quantity: 1,
            unitPrice: studentElectricity,
            amount: studentElectricity,
          },
          {
            feeTypeId: waterFeeType?._id || null,
            description: waterDesc,
            quantity: 1,
            unitPrice: studentWater,
            amount: studentWater,
          },
        ];

        const invTotal = roomRent + studentElectricity + studentWater;

        await Invoice.create({
          invoiceCode: generateInvoiceCode(),
          studentId: student._id,
          contractId: contract ? contract._id : null,
          billingPeriod,
          type: 'monthly',
          lineItems,
          totalAmount: invTotal,
          paidAmount: 0,
          dueDate: new Date(dueDate),
          status: 'unpaid',
          createdBy: creatorUserId,
        });

        created += 1;
        totalAmount += invTotal;
      }
    }

    reading.isInvoiced = true;
    await reading.save();
  }

  return {
    created,
    updated,
    totalAmount,
    eligibleStudents,
    readyRooms,
    skipped,
  };
};

/**
 * Lấy danh sách hóa đơn có bộ lọc và summary (API.md §7 v1.2.11 - SCR-52)
 */
const getInvoices = async (query = {}, user = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.studentId) filter.studentId = query.studentId;
  if (query.billingPeriod) filter.billingPeriod = query.billingPeriod;
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;

  // Lấy toàn bộ hợp đồng để tra cứu phòng/tòa phẳng
  let invoices = await Invoice.find(filter)
    .populate('studentId', 'studentCode fullName phone className')
    .populate({
      path: 'contractId',
      populate: {
        path: 'bedId',
        populate: {
          path: 'roomId',
          populate: { path: 'buildingId' },
        },
      },
    })
    .sort({ createdAt: -1 });

  // Lọc theo search (invoiceCode, studentCode, studentName, bedCode)
  if (query.search && query.search.trim()) {
    const s = query.search.trim().toLowerCase();
    invoices = invoices.filter((inv) => {
      const code = (inv.invoiceCode || '').toLowerCase();
      const stCode = (inv.studentId?.studentCode || '').toLowerCase();
      const stName = (inv.studentId?.fullName || '').toLowerCase();
      const bed = (inv.contractId?.bedId?.bedCode || '').toLowerCase();
      return code.includes(s) || stCode.includes(s) || stName.includes(s) || bed.includes(s);
    });
  }

  // Lọc theo buildingId
  if (query.buildingId) {
    invoices = invoices.filter((inv) => {
      const bId = inv.contractId?.bedId?.roomId?.buildingId?._id?.toString();
      return bId === query.buildingId.toString();
    });
  }

  const now = new Date();

  // Tính summary trên toàn bộ tập đã lọc (loại bỏ hóa đơn cancelled)
  const nonCancelled = invoices.filter((inv) => inv.status !== 'cancelled');
  let summaryTotalAmount = 0;
  let summaryPaidAmount = 0;
  let summaryRemainingAmount = 0;
  let summaryOverdueCount = 0;
  let summaryOverdueAmount = 0;

  for (const inv of nonCancelled) {
    const paid = inv.paidAmount || 0;
    const rem = Math.max(0, inv.totalAmount - paid);
    summaryTotalAmount += inv.totalAmount;
    summaryPaidAmount += paid;
    summaryRemainingAmount += rem;

    if (['unpaid', 'partial', 'overdue'].includes(inv.status) && new Date(inv.dueDate) < now) {
      summaryOverdueCount += 1;
      summaryOverdueAmount += rem;
    }
  }

  const total = invoices.length;
  const paginated = invoices.slice(skip, skip + limit);

  const items = paginated.map((inv) => {
    const contract = inv.contractId;
    const bed = contract?.bedId;
    const room = bed?.roomId;
    const building = room?.buildingId;

    return {
      id: inv._id.toString(),
      invoiceCode: inv.invoiceCode,
      type: inv.type,
      billingPeriod: inv.billingPeriod,
      studentId: inv.studentId?._id?.toString() || null,
      studentName: inv.studentId?.fullName || '',
      studentCode: inv.studentId?.studentCode || '',
      contractId: contract?._id?.toString() || null,
      bedCode: bed?.bedCode || '',
      roomNumber: room?.roomNumber || '',
      buildingId: building?._id?.toString() || null,
      buildingCode: building?.code || '',
      buildingName: building?.name || '',
      lineItems: inv.lineItems,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount || 0,
      remainingAmount: Math.max(0, inv.totalAmount - (inv.paidAmount || 0)),
      issueDate: inv.createdAt.toISOString().slice(0, 10),
      dueDate: inv.dueDate.toISOString().slice(0, 10),
      status: inv.status,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    summary: {
      totalAmount: summaryTotalAmount,
      paidAmount: summaryPaidAmount,
      remainingAmount: summaryRemainingAmount,
      overdueCount: summaryOverdueCount,
      overdueAmount: summaryOverdueAmount,
    },
  };
};

/**
 * Lấy chi tiết hóa đơn (API.md §7 v1.2.12 - SCR-54)
 */
const getInvoiceById = async (id, user = null) => {
  const invoice = await Invoice.findById(id)
    .populate('studentId')
    .populate({
      path: 'contractId',
      populate: {
        path: 'bedId',
        populate: {
          path: 'roomId',
          populate: { path: 'buildingId' },
        },
      },
    });

  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  if (
    user?.role === 'student' &&
    user?.studentId &&
    invoice.studentId?._id?.toString() !== user.studentId.toString()
  ) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem hóa đơn của người khác');
  }

  // Lấy các giao dịch thanh toán thành công, sắp xếp từ cũ nhất đến mới nhất
  const payments = await Payment.find({ invoiceId: invoice._id, status: 'success' })
    .populate('recordedBy', 'fullName')
    .sort({ paidAt: 1, createdAt: 1 });

  // Nếu là hóa đơn supplies, lấy kèm thông tin đơn hàng
  let supplyOrder = null;
  if (invoice.type === 'supplies') {
    const SupplyOrder = require('../supplies/supply-order.model');
    const order = await SupplyOrder.findOne({ invoiceId: invoice._id });
    if (order) {
      supplyOrder = {
        id: order._id.toString(),
        orderCode: order.orderCode,
        status: order.status,
      };
    }
  }

  const contract = invoice.contractId;
  const bed = contract?.bedId;
  const room = bed?.roomId;
  const building = room?.buildingId;

  return {
    id: invoice._id.toString(),
    invoiceCode: invoice.invoiceCode,
    type: invoice.type,
    billingPeriod: invoice.billingPeriod,
    studentId: invoice.studentId?._id?.toString() || null,
    studentName: invoice.studentId?.fullName || '',
    studentCode: invoice.studentId?.studentCode || '',
    contractId: contract?._id?.toString() || null,
    contractCode: contract?.contractCode || null,
    bedCode: bed?.bedCode || '',
    roomNumber: room?.roomNumber || '',
    buildingId: building?._id?.toString() || null,
    buildingCode: building?.code || '',
    buildingName: building?.name || '',
    note: invoice.note || '',
    lineItems: invoice.lineItems,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount || 0,
    remainingAmount: Math.max(0, invoice.totalAmount - (invoice.paidAmount || 0)),
    issueDate: invoice.createdAt.toISOString().slice(0, 10),
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    status: invoice.status,
    payments: payments.map((p) => ({
      transactionRef: p.transactionRef,
      amount: p.amount,
      type: p.type,
      method: p.method,
      status: p.status,
      paidAt: p.paidAt,
      recordedByName: p.recordedBy?.fullName || 'Ban quản lý',
      bankReference: p.bankReference || null,
      gatewayTransactionId: p.gatewayTransactionId || null,
      note: p.note || '',
    })),
    supplyOrder,
  };
};

/**
 * Tạo hóa đơn phát sinh thủ công (API.md §7 v1.2.11 - SCR-52)
 */
const createOneOffInvoice = async (data, creatorUserId) => {
  const { contractId, studentId, dueDate, note, lineItems } = data;

  const contract = await Contract.findById(contractId);
  if (!contract || contract.status !== 'active') {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Hợp đồng phải ở trạng thái đang hiệu lực (active)');
  }

  let totalAmount = 0;
  const calculatedLineItems = [];

  for (let idx = 0; idx < lineItems.length; idx++) {
    const item = lineItems[idx];
    const feeType = await FeeType.findById(item.feeTypeId);
    if (!feeType) {
      throw new ApiError(404, 'NOT_FOUND', `Không tìm thấy loại phí tại dòng ${idx + 1}`);
    }

    if (['rent', 'deposit', 'supplies'].includes(feeType.code)) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Không được phép tạo hóa đơn phát sinh với loại phí tiền phòng, tiền cọc hoặc nhu yếu phẩm',
        { errors: [{ field: `lineItems.${idx}.feeTypeId`, message: 'Loại phí không hợp lệ cho hóa đơn phát sinh' }] }
      );
    }

    const qty = item.quantity || 1;
    const unitPrice = item.unitPrice !== undefined ? item.unitPrice : feeType.defaultAmount;
    const amount = qty * unitPrice;
    totalAmount += amount;

    calculatedLineItems.push({
      feeTypeId: feeType._id,
      description: item.description || feeType.name,
      quantity: qty,
      unitPrice,
      amount,
    });
  }

  const invoice = await Invoice.create({
    invoiceCode: generateInvoiceCode(),
    contractId,
    studentId,
    billingPeriod: null,
    type: 'other',
    lineItems: calculatedLineItems,
    totalAmount,
    paidAmount: 0,
    dueDate: new Date(dueDate),
    note: note || '',
    status: 'unpaid',
    createdBy: creatorUserId,
  });

  return invoice;
};

/**
 * Hủy hóa đơn (API.md §7 v1.2.11)
 */
const cancelInvoice = async (id, actorId = null) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  if (invoice.status === 'cancelled' || ['supplies', 'settlement'].includes(invoice.type)) {
    throw new ApiError(
      422,
      'INVOICE_NOT_CANCELLABLE',
      'Hóa đơn đã bị hủy trước đó hoặc thuộc loại nhu yếu phẩm / quyết toán không thể hủy trực tiếp'
    );
  }

  if ((invoice.paidAmount || 0) > 0) {
    throw new ApiError(
      422,
      'INVOICE_HAS_PAYMENT',
      'Hóa đơn đã có giao dịch thanh toán thành công, không thể hủy'
    );
  }

  invoice.status = 'cancelled';
  await invoice.save();

  // Nếu là hóa đơn monthly, kiểm tra xem phòng này trong kỳ này còn HĐ tháng nào có điện nước không
  if (invoice.type === 'monthly' && invoice.billingPeriod && invoice.contractId) {
    const contract = await Contract.findById(invoice.contractId).populate('bedId');
    const roomId = contract?.bedId?.roomId;

    if (roomId) {
      // Tìm các giường khác trong phòng
      const roomBeds = await Bed.find({ roomId });
      const bedIds = roomBeds.map((b) => b._id);
      const otherContracts = await Contract.find({ bedId: { $in: bedIds } });
      const contractIds = otherContracts.map((c) => c._id);

      const remainingActiveMonthly = await Invoice.find({
        contractId: { $in: contractIds },
        billingPeriod: invoice.billingPeriod,
        type: 'monthly',
        status: { $ne: 'cancelled' },
      });

      if (remainingActiveMonthly.length === 0) {
        await UtilityReading.findOneAndUpdate(
          { roomId, billingPeriod: invoice.billingPeriod },
          { isInvoiced: false }
        );
      }
    }
  }

  return { message: 'Đã hủy hóa đơn thành công' };
};

const getOverdueInvoices = async () => {
  const now = new Date();
  const invoices = await Invoice.find({
    status: { $in: ['unpaid', 'partial', 'overdue'] },
    dueDate: { $lt: now },
  })
    .populate('studentId', 'studentCode fullName phone className')
    .sort({ dueDate: 1 });

  return invoices.map((inv) => ({
    id: inv._id.toString(),
    invoiceCode: inv.invoiceCode,
    studentCode: inv.studentId?.studentCode || '',
    studentName: inv.studentId?.fullName || '',
    phone: inv.studentId?.phone || '',
    billingPeriod: inv.billingPeriod,
    totalAmount: inv.totalAmount,
    remainingAmount: Math.max(0, inv.totalAmount - (inv.paidAmount || 0)),
    dueDate: inv.dueDate.toISOString().slice(0, 10),
    status: inv.status,
  }));
};

module.exports = {
  getFeeTypes,
  createFeeType,
  updateFeeType,
  getUtilityReadings,
  recordUtilityReading,
  updateUtilityReading,
  getGenerationPreview,
  generateInvoices,
  getInvoices,
  getInvoiceById,
  createOneOffInvoice,
  cancelInvoice,
  getOverdueInvoices,
};

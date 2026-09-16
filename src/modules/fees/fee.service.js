/**
 * Service xử lý nghiệp vụ cho Module Fees (Biểu phí, Chỉ số Điện Nước, Hóa đơn).
 * Thực thi thuật toán chia đều điện nước phòng theo PRD.md §2.9 (Quy tắc A2), DATA-SCHEMA.md §3.8 - §3.10 và API.md §7.
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

// ==========================================
// 1. Quản lý Biểu phí (Fee Types)
// ==========================================

const getFeeTypes = async () => {
  return FeeType.find({ isActive: true }).sort('code');
};

const createFeeType = async (data) => {
  const codeLower = data.code.trim().toLowerCase();
  const existing = await FeeType.findOne({ code: codeLower });
  if (existing) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', `Mã loại phí ${codeLower} đã tồn tại`, {
      errors: [{ field: 'code', message: `Mã loại phí ${codeLower} đã tồn tại` }],
    });
  }

  return FeeType.create({
    ...data,
    code: codeLower,
  });
};

const updateFeeType = async (id, data) => {
  const feeType = await FeeType.findById(id);
  if (!feeType) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy loại phí');
  }

  Object.assign(feeType, data);
  await feeType.save();
  return feeType;
};

// ==========================================
// 2. Quản lý Chỉ số Điện Nước (Utility Readings)
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
    .sort('-billingPeriod');

  // Lọc theo buildingId nếu có
  if (query.buildingId) {
    readings = readings.filter(
      (r) => r.roomId?.buildingId?._id?.toString() === query.buildingId.toString()
    );
  }

  const total = readings.length;
  const paginated = readings.slice(skip, skip + limit);

  return {
    items: paginated,
    total,
    page,
    limit,
  };
};

/**
 * Ghi chỉ số điện nước cho 1 phòng trong 1 kỳ (PRD §2.9 A2).
 */
const recordUtilityReading = async (data, actorId = null) => {
  const { roomId, billingPeriod, electricityStart, electricityEnd, waterStart, waterEnd } = data;

  // 1. Kiểm tra tính hợp lệ của chỉ số
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

  // 2. Kiểm tra phòng tồn tại
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  // 3. Kiểm tra đã ghi kỳ này chưa
  const existing = await UtilityReading.findOne({ roomId, billingPeriod });
  if (existing) {
    throw new ApiError(
      409,
      'DUPLICATE_ENTRY',
      `Phòng này đã được ghi chỉ số điện nước cho kỳ ${billingPeriod}`,
      { errors: [{ field: 'billingPeriod', message: 'Kỳ này đã có chỉ số điện nước' }] }
    );
  }

  // 4. Lấy đơn giá chuẩn từ danh mục FeeType
  const [electricityFeeType, waterFeeType] = await Promise.all([
    FeeType.findOne({ code: 'electricity' }),
    FeeType.findOne({ code: 'water' }),
  ]);

  const electricityUnitPrice = electricityFeeType ? electricityFeeType.defaultAmount : 2500;
  const waterUnitPrice = waterFeeType ? waterFeeType.defaultAmount : 12000;

  // 5. Tính toán sản lượng và thành tiền
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
    electricityConsumption,
    waterConsumption,
    electricityUnitPrice,
    waterUnitPrice,
    electricityAmount,
    waterAmount,
    isInvoiced: false,
    recordedBy: actorId,
  });

  return reading;
};

const updateUtilityReading = async (id, data) => {
  const reading = await UtilityReading.findById(id);
  if (!reading) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi chỉ số điện nước');
  }

  if (reading.isInvoiced) {
    throw new ApiError(422, 'READING_ALREADY_INVOICED', 'Kỳ này đã lập hóa đơn, không thể sửa chỉ số');
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

  await reading.save();
  return reading;
};

// ==========================================
// 3. Quản lý Hóa đơn (Invoices)
// ==========================================

/**
 * Lập hóa đơn hàng loạt cho một kỳ (API.md §7 POST /api/invoices/generate).
 * Thuật toán: Chia đều điện nước phòng với phần dư dồn cho SV có MSSV nhỏ nhất (PRD §2.9 A2).
 * Hỗ trợ cập nhật dòng điện nước vào hóa đơn tháng đã có (BR-48).
 */
const generateInvoices = async ({ billingPeriod, buildingIds, dueDate }, creatorUserId) => {
  const roomFilter = { status: { $ne: 'inactive' } };
  if (buildingIds && buildingIds.length > 0) {
    roomFilter.buildingId = { $in: buildingIds };
  }

  const rooms = await Room.find(roomFilter).populate('buildingId');

  let createdCount = 0;
  let updatedCount = 0;
  let totalAmountAccumulator = 0;
  const skipped = [];

  const [electricityFeeType, waterFeeType, rentFeeType] = await Promise.all([
    FeeType.findOne({ code: 'electricity' }),
    FeeType.findOne({ code: 'water' }),
    FeeType.findOne({ code: 'rent' }),
  ]);

  for (const room of rooms) {
    // 1. Kiểm tra đã ghi chỉ số điện nước cho phòng này chưa
    const reading = await UtilityReading.findOne({
      roomId: room._id,
      billingPeriod,
    });

    if (!reading) {
      skipped.push({
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        reason: 'Chưa nhập chỉ số điện nước',
      });
      continue;
    }

    // 2. Tìm danh sách sinh viên đang ở trong phòng này
    const beds = await Bed.find({ roomId: room._id });
    const bedIds = beds.map((b) => b._id);

    const activeResidencies = await Residency.find({
      bedId: { $in: bedIds },
      status: 'active',
    }).populate('studentId');

    const validResidencies = activeResidencies.filter((r) => r.studentId);
    const n = validResidencies.length;

    if (n === 0) {
      skipped.push({
        roomId: room._id.toString(),
        roomNumber: room.roomNumber,
        reason: 'Không có sinh viên đang ở',
      });
      continue;
    }

    // Sắp xếp sinh viên theo mã số tăng dần để bạn nhỏ nhất gánh phần dư
    validResidencies.sort((a, b) =>
      a.studentId.studentCode.localeCompare(b.studentId.studentCode)
    );

    // 3. Thuật toán chia đều điện nước phòng (PRD §2.9 A2)
    const eTotal = reading.electricityAmount;
    const eBase = Math.floor(eTotal / n);
    const eRemainder = eTotal - eBase * n;

    const wTotal = reading.waterAmount;
    const wBase = Math.floor(wTotal / n);
    const wRemainder = wTotal - wBase * n;

    // 4. Lập hoặc cập nhật hóa đơn cho từng sinh viên
    for (let i = 0; i < n; i++) {
      const resItem = validResidencies[i];
      const student = resItem.studentId;

      const studentElectricity = i === 0 ? eBase + eRemainder : eBase;
      const studentWater = i === 0 ? wBase + wRemainder : wBase;

      // Tìm hợp đồng của sinh viên
      const contract = await Contract.findOne({
        studentId: student._id,
        status: 'active',
      });

      // Kiểm tra xem sinh viên đã có hóa đơn monthly của kỳ này chưa
      let existingInvoice = await Invoice.findOne({
        studentId: student._id,
        billingPeriod,
        type: 'monthly',
      });

      if (existingInvoice) {
        // BR-48: Đã có hóa đơn tháng (do kích hoạt HĐ giữa kỳ) -> Bổ sung dòng điện nước
        existingInvoice.lineItems.push(
          {
            feeTypeId: electricityFeeType?._id || null,
            description: `Tiền điện phòng ${room.roomNumber} kỳ ${billingPeriod}`,
            quantity: 1,
            unitPrice: studentElectricity,
            amount: studentElectricity,
          },
          {
            feeTypeId: waterFeeType?._id || null,
            description: `Tiền nước phòng ${room.roomNumber} kỳ ${billingPeriod}`,
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
        updatedCount += 1;
        totalAmountAccumulator += studentElectricity + studentWater;
      } else {
        // Chưa có -> Tạo hóa đơn mới gồm Tiền phòng + Điện + Nước
        const roomRent = contract ? contract.monthlyPrice : 0;
        const lineItems = [
          {
            feeTypeId: rentFeeType?._id || null,
            description: `Tiền phòng ${room.roomNumber} kỳ ${billingPeriod}`,
            quantity: 1,
            unitPrice: roomRent,
            amount: roomRent,
          },
          {
            feeTypeId: electricityFeeType?._id || null,
            description: `Tiền điện phòng ${room.roomNumber} kỳ ${billingPeriod}`,
            quantity: 1,
            unitPrice: studentElectricity,
            amount: studentElectricity,
          },
          {
            feeTypeId: waterFeeType?._id || null,
            description: `Tiền nước phòng ${room.roomNumber} kỳ ${billingPeriod}`,
            quantity: 1,
            unitPrice: studentWater,
            amount: studentWater,
          },
        ];

        const totalAmount = roomRent + studentElectricity + studentWater;

        await Invoice.create({
          invoiceCode: generateInvoiceCode(),
          studentId: student._id,
          contractId: contract ? contract._id : null,
          billingPeriod,
          type: 'monthly',
          lineItems,
          totalAmount,
          paidAmount: 0,
          dueDate: new Date(dueDate),
          status: 'unpaid',
          createdBy: creatorUserId,
        });

        createdCount += 1;
        totalAmountAccumulator += totalAmount;
      }
    }

    // Đánh dấu chỉ số phòng này đã lập hóa đơn
    reading.isInvoiced = true;
    await reading.save();
  }

  return {
    created: createdCount,
    updated: updatedCount,
    totalAmount: totalAmountAccumulator,
    skipped,
  };
};

/**
 * Lấy danh sách hóa đơn có bộ lọc
 */
const getInvoices = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.studentId) filter.studentId = query.studentId;
  if (query.billingPeriod) filter.billingPeriod = query.billingPeriod;
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('studentId', 'studentCode fullName phone className')
      .populate('contractId', 'contractCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
  ]);

  const items = invoices.map((inv) => ({
    id: inv._id.toString(),
    invoiceCode: inv.invoiceCode,
    studentId: inv.studentId?._id?.toString() || null,
    studentCode: inv.studentId?.studentCode || '',
    studentName: inv.studentId?.fullName || '',
    contractCode: inv.contractId?.contractCode || null,
    type: inv.type,
    billingPeriod: inv.billingPeriod,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount || 0,
    remainingAmount: Math.max(0, inv.totalAmount - (inv.paidAmount || 0)),
    dueDate: inv.dueDate.toISOString().slice(0, 10),
    status: inv.status,
    lineItems: inv.lineItems,
    createdAt: inv.createdAt,
  }));

  return {
    items,
    total,
    page,
    limit,
  };
};

/**
 * Lấy chi tiết 1 hóa đơn kèm lịch sử các giao dịch thanh toán
 */
const getInvoiceById = async (id, user = null) => {
  const invoice = await Invoice.findById(id)
    .populate('studentId')
    .populate('contractId');

  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  // Quyền truy cập: sinh viên chỉ xem hóa đơn của chính mình
  if (
    user?.role === 'student' &&
    user?.studentId &&
    invoice.studentId?._id?.toString() !== user.studentId.toString()
  ) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem hóa đơn của người khác');
  }

  const payments = await Payment.find({ invoiceId: invoice._id, status: 'success' }).sort({
    paidAt: -1,
  });

  return {
    id: invoice._id.toString(),
    invoiceCode: invoice.invoiceCode,
    student: invoice.studentId ? {
      id: invoice.studentId._id.toString(),
      studentCode: invoice.studentId.studentCode,
      fullName: invoice.studentId.fullName,
      phone: invoice.studentId.phone,
      className: invoice.studentId.className,
    } : null,
    contractCode: invoice.contractId?.contractCode || null,
    type: invoice.type,
    billingPeriod: invoice.billingPeriod,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount || 0,
    remainingAmount: Math.max(0, invoice.totalAmount - (invoice.paidAmount || 0)),
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    status: invoice.status,
    lineItems: invoice.lineItems,
    payments: payments.map((p) => ({
      id: p._id.toString(),
      transactionRef: p.transactionRef,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt,
      recordedBy: p.recordedBy,
    })),
    createdAt: invoice.createdAt,
  };
};

/**
 * Tạo thủ công 1 hóa đơn phát sinh
 */
const createInvoice = async (data, creatorUserId) => {
  const lineItems = (data.lineItems || []).map((item) => ({
    feeTypeId: item.feeTypeId || null,
    description: item.description,
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice,
    amount: (item.quantity || 1) * item.unitPrice,
  }));

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const invoice = await Invoice.create({
    invoiceCode: generateInvoiceCode(),
    studentId: data.studentId,
    contractId: data.contractId || null,
    billingPeriod: data.billingPeriod || null,
    type: data.type || 'other',
    lineItems,
    totalAmount,
    paidAmount: 0,
    dueDate: new Date(data.dueDate),
    status: 'unpaid',
    createdBy: creatorUserId,
  });

  return invoice;
};

/**
 * Hủy hóa đơn (chỉ được hủy khi chưa có thanh toán thành công)
 */
const cancelInvoice = async (id) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  const successPaymentCount = await Payment.countDocuments({
    invoiceId: id,
    status: 'success',
  });

  if (successPaymentCount > 0) {
    throw new ApiError(
      422,
      'INVOICE_HAS_PAYMENT',
      'Hóa đơn đã có giao dịch thanh toán thành công, không thể hủy'
    );
  }

  invoice.status = 'cancelled';
  await invoice.save();

  return { message: 'Đã hủy hóa đơn thành công' };
};

/**
 * Lấy danh sách hóa đơn quá hạn
 */
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
  generateInvoices,
  getInvoices,
  getInvoiceById,
  createInvoice,
  cancelInvoice,
  getOverdueInvoices,
};

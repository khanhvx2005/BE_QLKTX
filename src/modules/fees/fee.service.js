/**
 * Service xử lý nghiệp vụ cho Module Fees (Biểu phí, Chỉ số Điện Nước, Hóa đơn).
 * Thực thi thuật toán chia đều điện nước phòng theo PRD.md §2.9 (Quy tắc A2) và BR-51.
 */

const FeeType = require('./fee-type.model');
const UtilityReading = require('./utility-reading.model');
const Invoice = require('./invoice.model');
const Room = require('../rooms/room.model');
const Bed = require('../rooms/bed.model');
const Residency = require('../residencies/residency.model');
const Contract = require('../contracts/contract.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');

// ==========================================
// 1. Quản lý Biểu phí (Fee Types)
// ==========================================

const getFeeTypes = async () => {
  return FeeType.find({ isActive: true }).sort('code');
};

const createFeeType = async (data) => {
  const existing = await FeeType.findOne({ code: data.code.toUpperCase() });
  if (existing) {
    throw new ApiError(409, 'FEE_TYPE_CODE_ALREADY_EXISTS', `Mã loại phí ${data.code} đã tồn tại`);
  }

  return FeeType.create({
    ...data,
    code: data.code.toUpperCase(),
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
  const filter = {};
  if (query.billingPeriod) filter.billingPeriod = query.billingPeriod;
  if (query.roomId) filter.roomId = query.roomId;

  const readings = await UtilityReading.find(filter)
    .populate({
      path: 'roomId',
      select: 'roomNumber gender buildingId',
      populate: { path: 'buildingId', select: 'code name' },
    })
    .sort('-billingPeriod');

  // Lọc theo buildingId nếu có
  if (query.buildingId) {
    return readings.filter(
      (r) => r.roomId?.buildingId?._id?.toString() === query.buildingId.toString()
    );
  }

  return readings;
};

/**
 * Ghi chỉ số điện nước cho 1 phòng trong 1 kỳ (PRD §2.9 A2).
 */
const recordUtilityReading = async (data, actorId = null) => {
  const { roomId, billingPeriod, electricityStart, electricityEnd, waterStart, waterEnd } = data;

  // 1. Kiểm tra tính hợp lệ của chỉ số
  if (electricityEnd < electricityStart) {
    throw new ApiError(422, 'INVALID_METER_READING', 'Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ');
  }
  if (waterEnd < waterStart) {
    throw new ApiError(422, 'INVALID_METER_READING', 'Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ');
  }

  // 2. Kiểm tra phòng tồn tại
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng');
  }

  // 3. Kiểm tra đã ghi kỳ này chưa
  const existing = await UtilityReading.findOne({ roomId, billingPeriod });
  if (existing) {
    throw new ApiError(409, 'READING_ALREADY_EXISTS', `Phòng này đã được ghi chỉ số điện nước cho kỳ ${billingPeriod}`);
  }

  // 4. Lấy đơn giá chuẩn từ danh mục FeeType (hoặc lấy mặc định nếu chưa seed)
  const elecType = await FeeType.findOne({ code: 'ELECTRICITY', isActive: true });
  const waterType = await FeeType.findOne({ code: 'WATER', isActive: true });

  const electricityUnitPrice = elecType ? elecType.unitPrice : 3000;
  const waterUnitPrice = waterType ? waterType.unitPrice : 15000;

  const electricityConsumption = electricityEnd - electricityStart;
  const waterConsumption = waterEnd - waterStart;
  const electricityAmount = electricityConsumption * electricityUnitPrice;
  const waterAmount = waterConsumption * waterUnitPrice;
  const totalAmount = electricityAmount + waterAmount;

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
    totalAmount,
    isInvoiced: false,
    recordedBy: actorId,
  });

  return reading;
};

const updateUtilityReading = async (id, data) => {
  const reading = await UtilityReading.findById(id);
  if (!reading) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi chỉ số');
  }

  // Quy tắc nghiệp vụ: Đã lập hóa đơn thì cấm sửa chỉ số
  if (reading.isInvoiced) {
    throw new ApiError(422, 'READING_ALREADY_INVOICED', 'Kỳ này đã lập hóa đơn, không thể sửa chỉ số');
  }

  const electricityStart = data.electricityStart !== undefined ? data.electricityStart : reading.electricityStart;
  const electricityEnd = data.electricityEnd !== undefined ? data.electricityEnd : reading.electricityEnd;
  const waterStart = data.waterStart !== undefined ? data.waterStart : reading.waterStart;
  const waterEnd = data.waterEnd !== undefined ? data.waterEnd : reading.waterEnd;

  if (electricityEnd < electricityStart || waterEnd < waterStart) {
    throw new ApiError(422, 'INVALID_METER_READING', 'Chỉ số cuối kỳ phải lớn hơn hoặc bằng chỉ số đầu kỳ');
  }

  reading.electricityStart = electricityStart;
  reading.electricityEnd = electricityEnd;
  reading.waterStart = waterStart;
  reading.waterEnd = waterEnd;
  reading.electricityConsumption = electricityEnd - electricityStart;
  reading.waterConsumption = waterEnd - waterStart;
  reading.electricityAmount = reading.electricityConsumption * reading.electricityUnitPrice;
  reading.waterAmount = reading.waterConsumption * reading.waterUnitPrice;
  reading.totalAmount = reading.electricityAmount + reading.waterAmount;

  await reading.save();
  return reading;
};

// ==========================================
// 3. Quản lý Hóa đơn (Invoices) & Chia đều Điện Nước
// ==========================================

const generateInvoiceCode = async (billingPeriod = null) => {
  const now = new Date();
  const periodStr = billingPeriod ? billingPeriod.replace('-', '') : `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `INV-${periodStr}`;

  const count = await Invoice.countDocuments({
    invoiceCode: { $regex: `^${prefix}` },
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `${prefix}-${sequence}`;
};

/**
 * ⭐ LẬP HÓA ĐƠN HÀNG LOẠT VÀ CHIA ĐỀU ĐIỆN NƯỚC (PRD §2.9 A2, BR-51).
 * Tiền điện nước phòng được chia đều chính xác cho số sinh viên thực tế đang lưu trú.
 */
const generateInvoices = async ({ billingPeriod, buildingIds = [], dueDate }, actorId = null) => {
  // 1. Tìm tất cả hợp đồng đang active
  const contracts = await Contract.find({ status: 'active' }).populate({
    path: 'residencyId',
    populate: {
      path: 'bedId',
      populate: { path: 'roomId' },
    },
  });

  // Lọc theo danh sách tòa nhà nếu có truyền vào
  let validContracts = contracts.filter((c) => c.residencyId && c.residencyId.bedId && c.residencyId.bedId.roomId);
  if (buildingIds.length > 0) {
    const bIdSet = new Set(buildingIds.map((id) => id.toString()));
    validContracts = validContracts.filter((c) =>
      bIdSet.has(c.residencyId.bedId.roomId.buildingId?.toString())
    );
  }

  if (validContracts.length === 0) {
    return { totalInvoicesCreated: 0, invoices: [], message: 'Không có hợp đồng hiệu lực để lập hóa đơn' };
  }

  // 2. Gom nhóm các hợp đồng theo từng phòng để chia điện nước
  const roomContractsMap = new Map();
  for (const contract of validContracts) {
    const roomId = contract.residencyId.bedId.roomId._id.toString();
    if (!roomContractsMap.has(roomId)) {
      roomContractsMap.set(roomId, []);
    }
    roomContractsMap.get(roomId).push(contract);
  }

  const createdInvoices = [];

  // 3. Duyệt từng phòng để tính toán chi phí
  for (const [roomId, roomContracts] of roomContractsMap.entries()) {
    // Tìm chỉ số điện nước của phòng trong kỳ này
    const reading = await UtilityReading.findOne({ roomId, billingPeriod });

    const occupantsCount = roomContracts.length;
    let elecPerPerson = 0;
    let waterPerPerson = 0;
    let elecRemainder = 0;
    let waterRemainder = 0;

    if (reading && occupantsCount > 0) {
      // Chia nguyên cho từng người, phần dư cộng dồn vào người cuối cùng để tổng chính xác 100%
      elecPerPerson = Math.floor(reading.electricityAmount / occupantsCount);
      elecRemainder = reading.electricityAmount - (elecPerPerson * occupantsCount);

      waterPerPerson = Math.floor(reading.waterAmount / occupantsCount);
      waterRemainder = reading.waterAmount - (waterPerPerson * occupantsCount);
    }

    // Tạo hóa đơn cho từng sinh viên trong phòng
    for (let i = 0; i < occupantsCount; i++) {
      const contract = roomContracts[i];
      const isLast = i === occupantsCount - 1;

      // Kiểm tra nếu sinh viên đã có hóa đơn hàng tháng trong kỳ này thì bỏ qua
      const existingInv = await Invoice.findOne({
        studentId: contract.studentId,
        billingPeriod,
        type: 'monthly',
      });
      if (existingInv) {
        continue;
      }

      const items = [
        {
          name: 'Tiền phòng hàng tháng',
          quantity: 1,
          unit: 'tháng',
          unitPrice: contract.roomFeeSnapshot,
          amount: contract.roomFeeSnapshot,
        },
      ];

      // Nếu có chỉ số điện nước, bổ sung chi tiết chia đều vào hóa đơn
      if (reading) {
        const studentElecAmount = elecPerPerson + (isLast ? elecRemainder : 0);
        const studentWaterAmount = waterPerPerson + (isLast ? waterRemainder : 0);

        if (studentElecAmount > 0) {
          items.push({
            name: `Tiền điện kỳ ${billingPeriod} (chia đều ${occupantsCount} người)`,
            quantity: 1,
            unit: 'phần',
            unitPrice: studentElecAmount,
            amount: studentElecAmount,
          });
        }

        if (studentWaterAmount > 0) {
          items.push({
            name: `Tiền nước kỳ ${billingPeriod} (chia đều ${occupantsCount} người)`,
            quantity: 1,
            unit: 'phần',
            unitPrice: studentWaterAmount,
            amount: studentWaterAmount,
          });
        }
      }

      const totalAmount = items.reduce((sum, it) => sum + it.amount, 0);
      const invoiceCode = await generateInvoiceCode(billingPeriod);

      const invoice = await Invoice.create({
        invoiceCode,
        studentId: contract.studentId,
        contractId: contract._id,
        billingPeriod,
        type: 'monthly',
        items,
        totalAmount,
        paidAmount: 0,
        dueDate,
        status: 'unpaid',
        createdBy: actorId,
      });

      createdInvoices.push(invoice);
    }

    // Đánh dấu bản ghi điện nước đã được xuất hóa đơn
    if (reading) {
      reading.isInvoiced = true;
      await reading.save();
    }
  }

  return {
    totalInvoicesCreated: createdInvoices.length,
    invoices: createdInvoices,
  };
};

const getInvoices = async (query = {}, user = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.billingPeriod) filter.billingPeriod = query.billingPeriod;
  if (query.type) filter.type = query.type;

  // Quy tắc chính chủ cho sinh viên: chỉ xem hóa đơn của chính mình
  if (user && user.role === 'student') {
    filter.studentId = user.studentId;
  } else if (query.studentId) {
    filter.studentId = query.studentId;
  }

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .populate('studentId', 'fullName studentCode phone email className')
      .populate('contractId', 'contractNumber startDate endDate')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
  };
};

const getInvoiceById = async (id, user = null) => {
  const invoice = await Invoice.findById(id)
    .populate('studentId', 'fullName studentCode phone email className')
    .populate('contractId', 'contractNumber startDate endDate');

  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  if (user && user.role === 'student') {
    const ownerId = invoice.studentId?._id?.toString() || invoice.studentId?.toString();
    if (ownerId !== user.studentId?.toString()) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem hóa đơn của sinh viên khác');
    }
  }

  return invoice;
};

const createOneOffInvoice = async (data, actorId = null) => {
  const totalAmount = data.items.reduce((sum, it) => sum + it.amount, 0);
  const invoiceCode = await generateInvoiceCode(data.billingPeriod);

  const invoice = await Invoice.create({
    ...data,
    invoiceCode,
    totalAmount,
    paidAmount: 0,
    status: 'unpaid',
    createdBy: actorId,
  });

  return invoice;
};

const cancelInvoice = async (id, actorId = null) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  if (invoice.paidAmount > 0) {
    throw new ApiError(422, 'INVOICE_HAS_PAYMENTS', 'Hóa đơn đã có phát sinh thanh toán, không thể hủy');
  }

  invoice.status = 'cancelled';
  await invoice.save();

  return {
    id: invoice._id,
    invoiceCode: invoice.invoiceCode,
    status: 'cancelled',
    message: 'Hủy hóa đơn thành công',
  };
};

const getOverdueInvoices = async () => {
  const now = new Date();
  return Invoice.find({
    status: { $in: ['unpaid', 'partial'] },
    dueDate: { $lt: now },
  })
    .populate('studentId', 'fullName studentCode phone')
    .sort('dueDate');
};

module.exports = {
  // Fee Types
  getFeeTypes,
  createFeeType,
  updateFeeType,
  // Utility Readings
  getUtilityReadings,
  recordUtilityReading,
  updateUtilityReading,
  // Invoices
  generateInvoices,
  getInvoices,
  getInvoiceById,
  createOneOffInvoice,
  cancelInvoice,
  getOverdueInvoices,
};

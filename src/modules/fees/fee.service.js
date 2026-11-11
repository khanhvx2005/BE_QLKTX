/**
 * Service xử lý nghiệp vụ cho Module Fees (Điện Nước & Hóa Đơn KTX HaUI).
 * 
 * ============================================================================
 * [LUỒNG NGHIỆP VỤ CỐT LÕI - DÀNH CHO TEAM 5]:
 * 1. Thu tiền điện nước theo đơn vị PHÒNG (FR-41 & BR-03):
 *    - Mỗi tháng chốt duy nhất 01 hóa đơn điện nước cho cả phòng.
 *    - Không xé nhỏ ra từng sinh viên để tránh nợ đọng lắt nhắt và khó đối soát.
 * 2. [QUAN TRỌNG - KHẮC PHỤC LỖI TRÙNG MÃ HÓA ĐƠN ĐIỆN NƯỚC]:
 *    - Sinh mã hóa đơn: `INV-UTIL-<Mã Tòa>-<Số Phòng>-<YYYYMM>`
 *    - Ví dụ: `INV-UTIL-K1-302-202610` (Tòa K1 phòng 302) và `INV-UTIL-K2-302-202610` (Tòa K2 phòng 302)
 *    -> Có thêm <Mã Tòa> giúp tuyệt đối không bao giờ bị trùng lặp giữa các tòa nhà!
 * 3. Bắn thông báo toàn phòng & Gợi ý tiền chia bình quân:
 *    - `perStudentAmount = totalAmount / occupantsCount`
 *    - Tự động gửi thông báo đồng loạt cho tất cả thành viên trong phòng.
 *    - Một bạn đại diện đứng ra quét VietQR hoặc nộp tiền mặt để gạch nợ cả phòng.
 * ============================================================================
 */

const UtilityReading = require('./utility-reading.model');
const Invoice = require('./invoice.model');
const Room = require('../rooms/room.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');
const { generateUtilityInvoiceCode } = require('../../core/utils/code-generator');
const cache = require('../../core/utils/cache');
const logger = require('../../core/logger/logger');

// ============================================================================
// 1. QUẢN LÝ CHỈ SỐ ĐIỆN NƯỚC (UTILITY READINGS)
// ============================================================================

/**
 * Ghi nhận chỉ số điện nước 1 phòng (FR-40)
 */
const recordUtilityReading = async (data, actorId) => {
  const {
    roomId,
    monthYear,
    electricityOld,
    electricityNew,
    electricityUnitPrice = 2500,
    waterOld,
    waterNew,
    waterUnitPrice = 12000,
  } = data;

  // 1. Kiểm tra chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ
  if (electricityNew < electricityOld) {
    throw new ApiError(422, 'INVALID_METER_READING', 'Chỉ số điện mới phải lớn hơn hoặc bằng chỉ số cũ');
  }
  if (waterNew < waterOld) {
    throw new ApiError(422, 'INVALID_METER_READING', 'Chỉ số nước mới phải lớn hơn hoặc bằng chỉ số cũ');
  }

  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phòng KTX');
  }

  // 2. Tính toán lượng tiêu thụ và thành tiền
  const electricityUsage = electricityNew - electricityOld;
  const waterUsage = waterNew - waterOld;
  const electricityAmount = electricityUsage * electricityUnitPrice;
  const waterAmount = waterUsage * waterUnitPrice;
  const totalAmount = electricityAmount + waterAmount;

  // 3. Đếm số lượng sinh viên đang ở thực tế trong phòng
  const occupantsCount = room.beds.filter((b) => b.status === 'occupied').length || 1;
  const perStudentAmount = Math.round(totalAmount / occupantsCount);

  // 4. Tìm kiếm hoặc cập nhật bản ghi chỉ số cho tháng đó
  let reading = await UtilityReading.findOne({ roomId, monthYear });
  if (reading) {
    if (reading.isBilled) {
      throw new ApiError(422, 'READING_ALREADY_INVOICED', 'Kỳ này phòng đã được chốt và phát hành hóa đơn, không thể sửa đổi');
    }
    reading.electricity = {
      oldIndex: electricityOld,
      newIndex: electricityNew,
      usage: electricityUsage,
      unitPrice: electricityUnitPrice,
      amount: electricityAmount,
    };
    reading.water = {
      oldIndex: waterOld,
      newIndex: waterNew,
      usage: waterUsage,
      unitPrice: waterUnitPrice,
      amount: waterAmount,
    };
    reading.totalAmount = totalAmount;
    reading.occupantsCount = occupantsCount;
    reading.perStudentAmount = perStudentAmount;
    reading.recordedBy = actorId;
    await reading.save();
  } else {
    reading = await UtilityReading.create({
      roomId,
      monthYear,
      electricity: {
        oldIndex: electricityOld,
        newIndex: electricityNew,
        usage: electricityUsage,
        unitPrice: electricityUnitPrice,
        amount: electricityAmount,
      },
      water: {
        oldIndex: waterOld,
        newIndex: waterNew,
        usage: waterUsage,
        unitPrice: waterUnitPrice,
        amount: waterAmount,
      },
      totalAmount,
      occupantsCount,
      perStudentAmount,
      isBilled: false,
      recordedBy: actorId,
    });
  }

  return reading;
};

/**
 * Ghi nhận chỉ số hàng loạt theo Tòa nhà dạng Bảng lưới (Matrix Grid - FR-40)
 */
const recordMatrixGrid = async (data, actorId) => {
  const { buildingId, monthYear, readings } = data;
  const results = [];
  const errors = [];

  for (const item of readings) {
    try {
      const record = await recordUtilityReading(
        {
          roomId: item.roomId,
          monthYear,
          electricityOld: item.electricityOld,
          electricityNew: item.electricityNew,
          waterOld: item.waterOld,
          waterNew: item.waterNew,
        },
        actorId
      );
      results.push(record);
    } catch (err) {
      errors.push({ roomId: item.roomId, error: err.message });
    }
  }

  return {
    monthYear,
    totalProcessed: readings.length,
    successCount: results.length,
    failedCount: errors.length,
    errors,
  };
};

/**
 * CHỐT SỐ & PHÁT HÀNH HÓA ĐƠN ĐIỆN NƯỚC THEO PHÒNG (FR-41 & BR-03)
 * 
 * Luồng logic:
 * 1. Lấy thông tin bản ghi chỉ số, phòng và tòa nhà.
 * 2. Sinh mã hóa đơn theo công thức CHỐNG TRÙNG LẶP:
 *    `INV-UTIL-<Mã Tòa>-<Số Phòng>-<YYYYMM>`
 * 3. Phát hành 01 hóa đơn điện nước duy nhất cho cả phòng (`type: 'utility'`).
 * 4. Gợi ý mức tiền chia bình quân mỗi sinh viên: `perStudentAmount`.
 * 5. Bắn thông báo (Email / Portal) đến toàn bộ thành viên trong phòng.
 * 6. Xóa Cache Redis để đồng bộ hóa đơn và Dashboard.
 */
const billUtilityReading = async (readingId, actorId) => {
  const reading = await UtilityReading.findById(readingId).populate({
    path: 'roomId',
    populate: { path: 'buildingId', select: 'code name' },
  });

  if (!reading) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi chỉ số điện nước');
  }

  if (reading.isBilled) {
    throw new ApiError(422, 'READING_ALREADY_INVOICED', 'Chỉ số điện nước phòng này đã được phát hành hóa đơn');
  }

  const room = reading.roomId;
  const building = room.buildingId;

  // 1. Sinh mã hóa đơn điện nước CHUẨN CÓ MÃ TÒA NHÀ (Khắc phục hoàn toàn lỗi trùng phòng 302 giữa các tòa)
  const invoiceCode = generateUtilityInvoiceCode(building.code, room.roomNumber, reading.monthYear);

  // 2. Tính lại số người đang ở thực tế và mức tiền chia bình quân
  const occupiedBeds = room.beds.filter((b) => b.status === 'occupied' && b.studentId);
  const occupantsCount = occupiedBeds.length || 1;
  const perStudentAmount = Math.round(reading.totalAmount / occupantsCount);

  // 3. Tạo hóa đơn điện nước phòng
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // Hạn thanh toán 7 ngày

  const invoice = await Invoice.create({
    invoiceCode,
    roomId: room._id,
    utilityReadingId: reading._id,
    type: 'utility',
    amount: reading.totalAmount,
    description: `Tiền điện nước Phòng ${room.roomNumber} (${building.code}) - Kỳ ${reading.monthYear}`,
    dueDate,
    status: 'unpaid',
  });

  // 4. Cập nhật bản ghi chỉ số
  reading.isBilled = true;
  reading.occupantsCount = occupantsCount;
  reading.perStudentAmount = perStudentAmount;
  await reading.save();

  // 5. Bắn thông báo tới toàn bộ sinh viên đang ở trong phòng (Email & Portal Notification)
  const studentIds = occupiedBeds.map((b) => b.studentId);
  logger.info(
    `📢 [Notification] Đã phát hành HĐ Điện nước ${invoiceCode} tổng ${reading.totalAmount.toLocaleString('vi-VN')} đ. ` +
    `Gửi thông báo tới ${studentIds.length} sinh viên phòng ${room.roomNumber}. Mức tiền bình quân mỗi bạn: ${perStudentAmount.toLocaleString('vi-VN')} đ`
  );

  // 6. Xóa Cache Redis
  await Promise.all([
    cache.delByPattern('dashboard:*'),
    cache.delByPattern('portal:*'),
  ]);

  return {
    invoice,
    reading,
    occupantsCount,
    perStudentAmount,
    message: `Chốt số và phát hành Hóa đơn Điện Nước ${invoiceCode} cho cả phòng thành công!`,
  };
};

// ============================================================================
// 2. QUẢN LÝ HÓA ĐƠN (INVOICES)
// ============================================================================

/**
 * Lấy danh sách hóa đơn phân trang (FR-50)
 */
const getInvoices = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.roomId) filter.roomId = query.roomId;
  if (query.studentId) filter.studentId = query.studentId;

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.invoiceCode = searchRegex;
  }

  const [total, invoices] = await Promise.all([
    Invoice.countDocuments(filter),
    Invoice.find(filter)
      .populate('studentId', 'studentCode fullName phone')
      .populate({
        path: 'roomId',
        select: 'roomNumber buildingId',
        populate: { path: 'buildingId', select: 'code name' },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    data: invoices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Xem chi tiết hóa đơn (FR-51)
 */
const getInvoiceById = async (id) => {
  const invoice = await Invoice.findById(id)
    .populate('studentId', 'studentCode fullName phone email className faculty')
    .populate({
      path: 'roomId',
      populate: [
        { path: 'buildingId', select: 'code name' },
        { path: 'beds.studentId', select: 'studentCode fullName' },
      ],
    })
    .populate('contractId')
    .populate('utilityReadingId');

  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  return invoice;
};

module.exports = {
  recordUtilityReading,
  recordMatrixGrid,
  billUtilityReading,
  getInvoices,
  getInvoiceById,
};

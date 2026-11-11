/**
 * Service xử lý nghiệp vụ cho Module Payments (Thanh toán & Hoàn cọc KTX HaUI).
 * 
 * ============================================================================
 * [LUỒNG NGHIỆP VỤ CỐT LÕI - DÀNH CHO TEAM 5]:
 * 1. Thu tiền mặt tại KTX (FR-52):
 *    - Cá nhân nộp tiền phòng/cọc hoặc đại diện phòng nộp tiền điện nước.
 *    - Cán bộ bấm xác nhận -> Gạch nợ hóa đơn sang 'paid' và lập phiếu thu.
 *    - Nếu là hóa đơn cọc -> Cập nhật contract.depositStatus = 'paid'.
 * 2. Thanh toán qua VietQR động (FR-53):
 *    - Sinh mã VietQR ngân hàng có sẵn số tiền và cú pháp chuẩn:
 *      + HĐ cá nhân: `HAUI <Mã HĐ> <MSSV>`
 *      + HĐ điện nước phòng: `HAUI <Mã HĐ> <Số Phòng>`
 * 3. Xác nhận chuyển khoản ngân hàng (FR-54):
 *    - Cán bộ đối soát và bấm xác nhận hoàn tất giao dịch.
 * ============================================================================
 */

const Payment = require('./payment.model');
const Invoice = require('../fees/invoice.model');
const Contract = require('../contracts/contract.model');
const Room = require('../rooms/room.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');
const { generateTransactionRef } = require('../../core/utils/code-generator');
const cache = require('../../core/utils/cache');
const logger = require('../../core/logger/logger');

/**
 * 1. Thu tiền mặt tại văn phòng KTX HaUI (FR-52)
 */
const payCash = async (data, actorId) => {
  const { invoiceId, studentId, note } = data;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn cần thanh toán');
  }

  if (invoice.status === 'paid') {
    throw new ApiError(422, 'INVOICE_ALREADY_PAID', 'Hóa đơn này đã được thanh toán trước đó');
  }

  // Xác định người nộp tiền
  let payerId = invoice.studentId;
  if (invoice.type === 'utility') {
    if (!studentId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Cần cung cấp mã sinh viên của bạn đại diện nộp tiền cho cả phòng');
    }
    payerId = studentId;
    invoice.studentId = payerId; // Lưu lại ID bạn đại diện đã nộp tiền
  }

  const student = await Student.findById(payerId);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy thông tin sinh viên nộp tiền');
  }

  // 1. Cập nhật hóa đơn sang 'paid'
  invoice.status = 'paid';
  invoice.paidAt = new Date();
  await invoice.save();

  // 2. Nếu là hóa đơn tiền cọc: cập nhật trạng thái cọc trên hợp đồng
  if (invoice.type === 'deposit' && invoice.contractId) {
    await Contract.findByIdAndUpdate(invoice.contractId, {
      depositStatus: 'paid',
    });
  }

  // 3. Tạo phiếu thu tiền mặt trong collection payments
  const payment = await Payment.create({
    paymentCode: generateTransactionRef(),
    invoiceId: invoice._id,
    studentId: payerId,
    amount: invoice.amount,
    type: 'payment',
    method: 'cash',
    cashCollectedBy: actorId,
    status: 'success',
    note: note || `Thu tiền mặt tại KTX cho hóa đơn ${invoice.invoiceCode}`,
    paidAt: new Date(),
  });

  // 4. Xóa cache Redis để cập nhật công nợ và Dashboard
  await Promise.all([
    cache.delByPattern('dashboard:*'),
    cache.delByPattern('portal:*'),
  ]);

  logger.info(`💵 [Payment] Cán bộ đã thu tiền mặt ${invoice.amount.toLocaleString('vi-VN')} đ cho HĐ ${invoice.invoiceCode} từ SV ${student.studentCode}`);

  return {
    payment,
    invoice,
    message: `Thu tiền mặt cho hóa đơn ${invoice.invoiceCode} thành công!`,
  };
};

/**
 * 2. Sinh mã VietQR động chuẩn Ngân hàng (FR-53)
 */
const generateVietQR = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId)
    .populate('studentId', 'studentCode fullName')
    .populate({
      path: 'roomId',
      select: 'roomNumber buildingId',
      populate: { path: 'buildingId', select: 'code name' },
    });

  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn cần thanh toán');
  }

  // Tạo cú pháp chuyển khoản chuẩn ngân hàng
  let transferSyntax = '';
  if (invoice.type === 'utility' && invoice.roomId) {
    // Hóa đơn điện nước phòng: HAUI <Mã HĐ> P<Số phòng>
    transferSyntax = `HAUI ${invoice.invoiceCode} P${invoice.roomId.roomNumber}`;
  } else {
    // Hóa đơn tiền phòng / cọc cá nhân: HAUI <Mã HĐ> <MSSV>
    const mssv = invoice.studentId?.studentCode || 'HAUI';
    transferSyntax = `HAUI ${invoice.invoiceCode} ${mssv}`;
  }

  // Cấu hình tài khoản KTX HaUI (Mặc định MB Bank)
  const bankBin = '970422'; // Mã BIN ngân hàng MB Bank
  const accountNo = '0356789999';
  const accountName = 'KTX DAI HOC CONG NGHIEP HA NOI';

  // URL tạo ảnh VietQR tự động từ VietQR API chuẩn Napas
  const qrImageUrl = `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${invoice.amount}&addInfo=${encodeURIComponent(transferSyntax)}&accountName=${encodeURIComponent(accountName)}`;

  return {
    invoiceId: invoice._id,
    invoiceCode: invoice.invoiceCode,
    type: invoice.type,
    amount: invoice.amount,
    status: invoice.status,
    vietqr: {
      bankBin,
      bankName: 'MB Bank (Ngân hàng Quân Đội)',
      accountNo,
      accountName,
      amount: invoice.amount,
      syntax: transferSyntax,
      qrImageUrl,
    },
  };
};

/**
 * 3. Xác nhận chuyển khoản ngân hàng qua VietQR (FR-54)
 */
const confirmBankTransfer = async (data, actorId) => {
  const { invoiceId, studentId, transactionCode, note } = data;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  if (invoice.status === 'paid') {
    throw new ApiError(422, 'INVOICE_ALREADY_PAID', 'Hóa đơn này đã được thanh toán trước đó');
  }

  let payerId = invoice.studentId;
  if (invoice.type === 'utility') {
    if (!studentId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Cần cung cấp mã sinh viên của bạn đại diện thanh toán');
    }
    payerId = studentId;
    invoice.studentId = payerId;
  }

  invoice.status = 'paid';
  invoice.paidAt = new Date();
  await invoice.save();

  if (invoice.type === 'deposit' && invoice.contractId) {
    await Contract.findByIdAndUpdate(invoice.contractId, {
      depositStatus: 'paid',
    });
  }

  const payment = await Payment.create({
    paymentCode: generateTransactionRef(),
    invoiceId: invoice._id,
    studentId: payerId,
    amount: invoice.amount,
    type: 'payment',
    method: 'vietqr',
    cashCollectedBy: actorId,
    transactionCode: transactionCode.trim(),
    status: 'success',
    note: note || `Đối soát VietQR chuyển khoản thành công (Mã GD: ${transactionCode})`,
    paidAt: new Date(),
  });

  await Promise.all([
    cache.delByPattern('dashboard:*'),
    cache.delByPattern('portal:*'),
  ]);

  logger.info(`📱 [VietQR] Cán bộ đã đối soát giao dịch VietQR ${invoice.amount.toLocaleString('vi-VN')} đ cho HĐ ${invoice.invoiceCode}`);

  return {
    payment,
    invoice,
    message: `Xác nhận chuyển khoản VietQR cho hóa đơn ${invoice.invoiceCode} thành công!`,
  };
};

/**
 * 4. Lấy danh sách lịch sử giao dịch thanh toán và hoàn cọc
 */
const getPayments = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.studentId) filter.studentId = query.studentId;
  if (query.invoiceId) filter.invoiceId = query.invoiceId;
  if (query.type) filter.type = query.type;
  if (query.method) filter.method = query.method;

  const [total, payments] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.find(filter)
      .populate('studentId', 'studentCode fullName phone className')
      .populate('invoiceId', 'invoiceCode type amount')
      .populate('cashCollectedBy', 'fullName email')
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    data: payments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

module.exports = {
  payCash,
  generateVietQR,
  confirmBankTransfer,
  getPayments,
};

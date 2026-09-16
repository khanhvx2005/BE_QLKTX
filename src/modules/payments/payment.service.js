/**
 * Service xử lý logic nghiệp vụ cho Module Payments (Thanh toán).
 * Xử lý thu tiền mặt/chuyển khoản quầy và tích hợp cổng thanh toán trực tuyến VNPay Sandbox.
 * Tuân thủ theo API.md §8, 14-PHIEN-BAN-DON-GIAN-HOA.md §4.10 và DATA-SCHEMA.md §3.11.
 */

const mongoose = require('mongoose');
const Payment = require('./payment.model');
const Invoice = require('../fees/invoice.model');
const vnpayHelper = require('./vnpay.helper');
const ApiError = require('../../core/errors/api-error');
const { generateTransactionRef } = require('../../core/utils/code-generator');

/**
 * Luôn tính lại paidAmount và remainingAmount của hóa đơn từ tổng các Payment thành công (BR-43).
 * Nếu hóa đơn là 'supplies' và đã thanh toán đủ -> chuyển SupplyOrder sang 'ready' (BR-95).
 */
const recalculateInvoice = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return null;

  const agg = await Payment.aggregate([
    { $match: { invoiceId: invoice._id, type: 'payment', status: 'success' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  invoice.paidAmount = agg[0]?.total || 0;
  invoice.remainingAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);

  if (invoice.paidAmount >= invoice.totalAmount) {
    invoice.status = 'paid';
  } else if (invoice.paidAmount > 0) {
    invoice.status = 'partial';
  } else if (invoice.dueDate && invoice.dueDate < new Date()) {
    invoice.status = 'overdue';
  } else {
    invoice.status = 'unpaid';
  }

  await invoice.save();

  // Nếu là hóa đơn mua sắm nhu yếu phẩm và đã trả đủ tiền -> chuyển đơn hàng sang trạng thái 'ready'
  if (invoice.status === 'paid' && invoice.type === 'supplies') {
    try {
      const SupplyOrder = mongoose.models.SupplyOrder || require('../supplies/supply-order.model');
      await SupplyOrder.findOneAndUpdate(
        { invoiceId: invoice._id, status: 'pending_payment' },
        { status: 'ready' }
      );
    } catch (err) {
      // Bỏ qua nếu module supplies chưa nạp hoặc đơn không tồn tại
    }
  }

  return invoice;
};

/**
 * Thu tiền mặt hoặc chuyển khoản tại quầy do Nhân viên hoặc Admin thực hiện (API.md §8 POST /api/payments/offline).
 */
const recordOfflinePayment = async (data, actorId) => {
  const { invoiceId, amount, method = 'cash', note } = data;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn cần thanh toán');
  }

  if (invoice.status === 'paid') {
    throw new ApiError(422, 'INVOICE_ALREADY_PAID', 'Hóa đơn này đã được thanh toán đủ');
  }

  if (invoice.status === 'cancelled') {
    throw new ApiError(422, 'INVOICE_CANCELLED', 'Hóa đơn này đã bị hủy, không thể thu tiền');
  }

  const remainingDebt = invoice.totalAmount - invoice.paidAmount;
  if (amount > remainingDebt) {
    throw new ApiError(
      422,
      'PAYMENT_EXCEEDS_REMAINING',
      `Số tiền thanh toán (${amount.toLocaleString('vi-VN')} đ) vượt quá số nợ còn lại (${remainingDebt.toLocaleString('vi-VN')} đ)`
    );
  }

  // Tạo bản ghi thanh toán offline
  const payment = await Payment.create({
    transactionRef: generateTransactionRef(),
    invoiceId: invoice._id,
    studentId: invoice.studentId,
    amount,
    method: method === 'bank_transfer' ? 'bank_transfer' : 'cash',
    type: 'payment',
    gatewayTransactionId: `REC-${Date.now()}`,
    status: 'success',
    paidAt: new Date(),
    note: note || 'Thu tiền trực tiếp tại quầy quản lý KTX',
    recordedBy: actorId,
  });

  // Tính lại tổng số tiền đã trả của hóa đơn (BR-43)
  const updatedInvoice = await recalculateInvoice(invoice._id);

  return {
    payment,
    invoice: updatedInvoice,
  };
};

/**
 * Sinh link thanh toán trực tuyến qua cổng VNPay Sandbox (API.md §8 POST /api/payments/online/checkout).
 */
const createOnlineCheckout = async (data, clientIp = '127.0.0.1', user = null) => {
  const { invoiceId, gateway = 'vnpay', amount } = data;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  // Sinh viên chỉ được tạo link thanh toán hóa đơn của chính mình
  if (user && user.role === 'student') {
    const ownerId = invoice.studentId?._id?.toString() || invoice.studentId?.toString();
    if (ownerId !== user.studentId?.toString()) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thanh toán hóa đơn của sinh viên khác');
    }
  }

  if (invoice.status === 'paid') {
    throw new ApiError(422, 'INVOICE_ALREADY_PAID', 'Hóa đơn đã thanh toán đầy đủ');
  }

  if (invoice.status === 'cancelled') {
    throw new ApiError(422, 'INVOICE_CANCELLED', 'Hóa đơn đã bị hủy');
  }

  const remainingAmount = invoice.totalAmount - invoice.paidAmount;
  const payAmount = (amount && Number(amount) <= remainingAmount) ? Number(amount) : remainingAmount;

  if (payAmount <= 0) {
    throw new ApiError(422, 'INVOICE_ALREADY_PAID', 'Hóa đơn đã thanh toán đầy đủ');
  }

  const transactionRef = generateTransactionRef();

  // Tạo giao dịch ở trạng thái pending
  const payment = await Payment.create({
    invoiceId: invoice._id,
    studentId: invoice.studentId,
    amount: payAmount,
    method: gateway === 'zalopay' ? 'zalopay' : 'vnpay',
    type: 'payment',
    transactionRef,
    orderInfo: `Thanh toan hoa don KTX ${invoice.invoiceCode}`,
    status: 'pending',
  });

  const redirectUrl = vnpayHelper.createPaymentUrl({
    transactionRef,
    amount: payAmount,
    orderInfo: `Thanh toan hoa don ${invoice.invoiceCode}`,
    ipAddr: clientIp,
  });

  return {
    paymentId: payment._id,
    transactionRef,
    redirectUrl,
  };
};

/**
 * Xác thực kết quả thanh toán từ VNPay Webhook / Return URL (BR-61, BR-62, BR-63, TC-103, TC-104, TC-105).
 */
const verifyVNPayPayment = async (queryParams) => {
  // 1. Kiểm tra tính hợp lệ của chữ ký HMAC-SHA512 (TC-103, BR-61)
  const isValidSignature = vnpayHelper.verifySignature(queryParams);
  if (!isValidSignature) {
    throw new ApiError(400, 'GATEWAY_SIGNATURE_INVALID', 'Chữ ký giao dịch VNPay không hợp lệ (sai mã băm bí mật)');
  }

  const transactionRef = queryParams.vnp_TxnRef;
  const payment = await Payment.findOne({ transactionRef });
  if (!payment) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch thanh toán tương ứng');
  }

  // 2. Idempotent check (TC-104, BR-62): Nếu giao dịch đã thành công trước đó thì không cộng dồn lần hai
  if (payment.status === 'success') {
    const invoice = await Invoice.findById(payment.invoiceId);
    return {
      success: true,
      alreadyConfirmed: true,
      message: 'Giao dịch này đã được ghi nhận thanh toán thành công trước đó',
      payment,
      invoice,
    };
  }

  // 3. Kiểm tra số tiền nhận được so với số tiền cần thanh toán (TC-105, BR-63)
  if (queryParams.vnp_Amount) {
    const receivedAmount = Number(queryParams.vnp_Amount) / 100;
    if (receivedAmount !== payment.amount) {
      payment.status = 'failed';
      payment.gatewayRawResponse = queryParams;
      payment.note = `Lệch số tiền: yêu cầu ${payment.amount} đ nhưng cổng gửi ${receivedAmount} đ`;
      await payment.save();
      throw new ApiError(422, 'AMOUNT_MISMATCH', 'Số tiền thanh toán từ VNPay không khớp với số tiền của hóa đơn');
    }
  }

  // 4. Phân tích mã phản hồi vnp_ResponseCode
  // '00': Giao dịch thành công
  if (queryParams.vnp_ResponseCode === '00') {
    payment.status = 'success';
    payment.gatewayTransactionId = queryParams.vnp_TransactionNo || queryParams.vnp_BankTranNo || `VNP-${Date.now()}`;
    payment.gatewayRawResponse = queryParams;
    payment.paidAt = new Date();
    await payment.save();

    // Luôn tính lại hóa đơn từ các Payment thành công (BR-43)
    const invoice = await recalculateInvoice(payment.invoiceId);

    return {
      success: true,
      alreadyConfirmed: false,
      message: 'Thanh toán qua cổng VNPay thành công',
      payment,
      invoice,
    };
  } else {
    // Thanh toán bị hủy hoặc lỗi từ phía ngân hàng
    payment.status = 'failed';
    payment.gatewayRawResponse = queryParams;
    payment.note = `Giao dịch thất bại tại cổng thanh toán (Mã phản hồi: ${queryParams.vnp_ResponseCode})`;
    await payment.save();

    return {
      success: false,
      alreadyConfirmed: false,
      message: `Giao dịch thanh toán không thành công (Mã lỗi VNPay: ${queryParams.vnp_ResponseCode})`,
      payment,
    };
  }
};

/**
 * Đối soát giao dịch đang pending (API.md §8 POST /api/payments/:id/reconcile).
 */
const reconcilePayment = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch thanh toán');
  }

  if (payment.status !== 'pending') {
    return {
      payment,
      message: `Giao dịch đã ở trạng thái ${payment.status}, không cần đối soát lại`,
    };
  }

  // Kiểm tra thời gian chờ: nếu quá 30 phút mà chưa hoàn tất, chuyển thành expired
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (payment.createdAt < thirtyMinutesAgo) {
    payment.status = 'expired';
    payment.note = 'Giao dịch hết hạn thanh toán (quá 30 phút)';
    await payment.save();
  }

  return {
    payment,
    message: 'Đối soát trạng thái thanh toán hoàn tất',
  };
};

/**
 * Danh sách thanh toán có lọc và phân trang (API.md §8 GET /api/payments).
 */
const getPayments = async (query = {}, user = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.invoiceId) filter.invoiceId = query.invoiceId;
  if (query.method) filter.method = query.method;
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;

  if (user && user.role === 'student') {
    filter.studentId = user.studentId;
  } else if (query.studentId) {
    filter.studentId = query.studentId;
  }

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('studentId', 'fullName studentCode phone email')
      .populate('invoiceId', 'invoiceCode totalAmount paidAmount remainingAmount status type')
      .populate('recordedBy', 'fullName email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
  };
};

const getPaymentById = async (id, user = null) => {
  const payment = await Payment.findById(id)
    .populate('studentId', 'fullName studentCode phone email')
    .populate('invoiceId', 'invoiceCode totalAmount paidAmount remainingAmount status type')
    .populate('recordedBy', 'fullName email');

  if (!payment) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi thanh toán');
  }

  if (user && user.role === 'student') {
    const ownerId = payment.studentId?._id?.toString() || payment.studentId?.toString();
    if (ownerId !== user.studentId?.toString()) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem giao dịch của sinh viên khác');
    }
  }

  return payment;
};

module.exports = {
  recalculateInvoice,
  recordOfflinePayment,
  createOnlineCheckout,
  verifyVNPayPayment,
  reconcilePayment,
  getPayments,
  getPaymentById,
};

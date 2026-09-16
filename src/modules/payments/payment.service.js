/**
 * Service xử lý logic nghiệp vụ cho Module Payments (Thanh toán).
 * Xử lý thu tiền mặt/chuyển khoản quầy và tích hợp cổng thanh toán trực tuyến VNPay Sandbox.
 * Tuân thủ theo API.md §8 (v1.2.12 - v1.2.13), 14-PHIEN-BAN-DON-GIAN-HOA.md §4.10 và DATA-SCHEMA.md §3.11.
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

  // Nếu là hóa đơn mua sắm nhu yếu phẩm và đã trả đủ tiền -> chuyển đơn hàng sang trạng thái 'ready' (BR-95)
  let linkedSupplyOrder = null;
  if (invoice.type === 'supplies') {
    try {
      const SupplyOrder = mongoose.models.SupplyOrder || require('../supplies/supply-order.model');
      if (invoice.status === 'paid') {
        linkedSupplyOrder = await SupplyOrder.findOneAndUpdate(
          { invoiceId: invoice._id, status: 'pending_payment' },
          { status: 'ready' },
          { returnDocument: 'after' }
        );
      } else {
        linkedSupplyOrder = await SupplyOrder.findOne({ invoiceId: invoice._id });
      }
    } catch (err) {
      // Bỏ qua nếu module supplies chưa nạp
    }
  }

  return { invoice, supplyOrder: linkedSupplyOrder };
};

/**
 * Thu tiền mặt hoặc chuyển khoản tại quầy do Nhân viên hoặc Admin thực hiện (API.md §8 POST /api/payments/offline - v1.2.12).
 */
const recordOfflinePayment = async (data, actorId) => {
  const { invoiceId, amount, method = 'cash', paidAt, bankReference, note } = data;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn cần thanh toán');
  }

  if (invoice.status === 'cancelled') {
    throw new ApiError(422, 'INVOICE_CANCELLED', 'Hóa đơn này đã bị hủy, không thể thu tiền');
  }

  if (invoice.status === 'paid') {
    throw new ApiError(422, 'INVOICE_ALREADY_PAID', 'Hóa đơn này đã được thanh toán đủ');
  }

  const remainingDebt = invoice.totalAmount - (invoice.paidAmount || 0);
  if (amount > remainingDebt) {
    throw new ApiError(
      422,
      'PAYMENT_EXCEEDS_REMAINING',
      `Số tiền thanh toán (${amount.toLocaleString('vi-VN')} đ) vượt quá số nợ còn lại (${remainingDebt.toLocaleString('vi-VN')} đ)`
    );
  }

  // Bắt buộc bankReference khi chuyển khoản và chống trùng mã tham chiếu (API.md v1.2.12)
  let cleanBankRef = null;
  if (method === 'bank_transfer') {
    if (!bankReference || !bankReference.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Mã tham chiếu ngân hàng là bắt buộc khi chuyển khoản', {
        errors: [{ field: 'bankReference', message: 'Mã tham chiếu ngân hàng là bắt buộc khi chuyển khoản' }],
      });
    }
    cleanBankRef = bankReference.trim().toUpperCase();

    const existingBankRef = await Payment.findOne({
      bankReference: cleanBankRef,
      status: 'success',
    });

    if (existingBankRef) {
      throw new ApiError(
        409,
        'DUPLICATE_ENTRY',
        'Mã tham chiếu ngân hàng này đã được sử dụng',
        { errors: [{ field: 'bankReference', message: 'Mã tham chiếu ngân hàng này đã được sử dụng' }] }
      );
    }
  } else if (bankReference && bankReference.trim()) {
    cleanBankRef = bankReference.trim().toUpperCase();
  }

  const User = mongoose.models.User || require('../auth/user.model');
  const actor = actorId ? await User.findById(actorId).select('fullName') : null;

  // Tạo bản ghi thanh toán offline
  const payment = await Payment.create({
    transactionRef: generateTransactionRef(),
    invoiceId: invoice._id,
    studentId: invoice.studentId,
    amount,
    method: method === 'bank_transfer' ? 'bank_transfer' : 'cash',
    type: 'payment',
    bankReference: cleanBankRef,
    gatewayTransactionId: null,
    status: 'success',
    paidAt: paidAt ? new Date(paidAt) : new Date(),
    note: note || '',
    recordedBy: actorId,
  });

  // Tính lại tổng số tiền đã trả của hóa đơn (BR-43)
  const { invoice: updatedInvoice, supplyOrder } = await recalculateInvoice(invoice._id);

  const formattedPayment = {
    id: payment._id.toString(),
    transactionRef: payment.transactionRef,
    invoiceId: payment.invoiceId.toString(),
    amount: payment.amount,
    type: payment.type,
    method: payment.method,
    bankReference: payment.bankReference,
    status: payment.status,
    paidAt: payment.paidAt,
    recordedByName: actor?.fullName || 'Ban quản lý',
    note: payment.note,
  };

  return {
    payment: formattedPayment,
    invoice: {
      id: updatedInvoice._id.toString(),
      totalAmount: updatedInvoice.totalAmount,
      paidAmount: updatedInvoice.paidAmount,
      remainingAmount: Math.max(0, updatedInvoice.totalAmount - updatedInvoice.paidAmount),
      status: updatedInvoice.status,
    },
    supplyOrder: supplyOrder
      ? {
          id: supplyOrder._id.toString(),
          orderCode: supplyOrder.orderCode,
          status: supplyOrder.status,
        }
      : null,
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

  const remainingAmount = invoice.totalAmount - (invoice.paidAmount || 0);
  const payAmount = amount && Number(amount) <= remainingAmount ? Number(amount) : remainingAmount;

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
    status: 'pending',
  });

  const redirectUrl = vnpayHelper.createPaymentUrl({
    transactionRef,
    amount: payAmount,
    orderInfo: `Thanh toan hoa don ${invoice.invoiceCode}`,
    ipAddr: clientIp,
  });

  return {
    paymentId: payment._id.toString(),
    transactionRef,
    redirectUrl,
  };
};

/**
 * Xác thực kết quả thanh toán từ VNPay Webhook / Return URL (BR-61, BR-62, BR-63, TC-103, TC-104, TC-105).
 */
const verifyVNPayPayment = async (queryParams) => {
  const isValidSignature = vnpayHelper.verifySignature(queryParams);
  if (!isValidSignature) {
    throw new ApiError(400, 'GATEWAY_SIGNATURE_INVALID', 'Chữ ký giao dịch VNPay không hợp lệ (sai mã băm bí mật)');
  }

  const transactionRef = queryParams.vnp_TxnRef;
  const payment = await Payment.findOne({ transactionRef });
  if (!payment) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch thanh toán tương ứng');
  }

  // Idempotent check: Không cộng dồn 2 lần
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

  if (queryParams.vnp_ResponseCode === '00') {
    payment.status = 'success';
    payment.gatewayTransactionId = queryParams.vnp_TransactionNo || queryParams.vnp_BankTranNo || `VNP-${Date.now()}`;
    payment.gatewayRawResponse = queryParams;
    payment.paidAt = new Date();
    await payment.save();

    const { invoice } = await recalculateInvoice(payment.invoiceId);

    return {
      success: true,
      alreadyConfirmed: false,
      message: 'Thanh toán qua cổng VNPay thành công',
      payment,
      invoice,
    };
  } else {
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
 * Đối soát giao dịch đang pending (API.md §8 POST /api/payments/:id/reconcile - v1.2.13).
 */
const reconcilePayment = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch thanh toán');
  }

  if (['cash', 'bank_transfer'].includes(payment.method)) {
    throw new ApiError(
      422,
      'PAYMENT_NOT_ONLINE',
      'Đối soát chỉ áp dụng cho các giao dịch thanh toán trực tuyến qua cổng'
    );
  }

  if (payment.status !== 'pending') {
    throw new ApiError(
      422,
      'PAYMENT_NOT_PENDING',
      `Giao dịch đã ở trạng thái ${payment.status}, không thể đối soát`
    );
  }

  // Quá 15 phút không nhận được xác thực thành công -> expired (BR-64)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (payment.createdAt < fifteenMinutesAgo) {
    payment.status = 'expired';
    payment.note = 'Giao dịch hết hạn thanh toán (quá 15 phút)';
    await payment.save();

    const invoice = await Invoice.findById(payment.invoiceId);
    return {
      payment: {
        id: payment._id.toString(),
        status: payment.status,
        paidAt: payment.paidAt,
        gatewayTransactionId: payment.gatewayTransactionId,
      },
      invoice: invoice ? {
        id: invoice._id.toString(),
        paidAmount: invoice.paidAmount,
        remainingAmount: Math.max(0, invoice.totalAmount - (invoice.paidAmount || 0)),
        status: invoice.status,
      } : null,
      message: `Giao dịch ${payment.transactionRef} đã quá hạn 15 phút — đã đánh dấu hết hạn (expired)`,
    };
  }

  return {
    payment: {
      id: payment._id.toString(),
      status: payment.status,
      paidAt: payment.paidAt,
      gatewayTransactionId: payment.gatewayTransactionId,
    },
    invoice: null,
    message: `Giao dịch ${payment.transactionRef} vẫn đang trong thời gian chờ xử lý (chưa quá 15 phút)`,
  };
};

/**
 * Danh sách thanh toán phẳng có lọc và summary (API.md §8 GET /api/payments - v1.2.13).
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

  let payments = await Payment.find(filter)
    .populate('studentId', 'fullName studentCode phone email')
    .populate('invoiceId', 'invoiceCode totalAmount paidAmount remainingAmount status type')
    .populate('recordedBy', 'fullName email')
    .sort({ paidAt: -1, createdAt: -1 });

  // Lọc theo search (transactionRef, invoiceCode, studentName, studentCode, bankReference, gatewayId)
  if (query.search && query.search.trim()) {
    const s = query.search.trim().toLowerCase();
    payments = payments.filter((p) => {
      const ref = (p.transactionRef || '').toLowerCase();
      const inv = (p.invoiceId?.invoiceCode || '').toLowerCase();
      const stCode = (p.studentId?.studentCode || '').toLowerCase();
      const stName = (p.studentId?.fullName || '').toLowerCase();
      const bankRef = (p.bankReference || '').toLowerCase();
      const gateId = (p.gatewayTransactionId || '').toLowerCase();
      return ref.includes(s) || inv.includes(s) || stCode.includes(s) || stName.includes(s) || bankRef.includes(s) || gateId.includes(s);
    });
  }

  // Lọc theo from / to date
  if (query.from) {
    const fromDate = new Date(query.from);
    payments = payments.filter((p) => new Date(p.paidAt || p.createdAt) >= fromDate);
  }
  if (query.to) {
    const toDate = new Date(query.to);
    toDate.setHours(23, 59, 59, 999);
    payments = payments.filter((p) => new Date(p.paidAt || p.createdAt) <= toDate);
  }

  // Tính summary trên toàn bộ tập đã lọc
  let collectedAmount = 0;
  let refundedAmount = 0;
  let successCount = 0;
  let pendingCount = 0;
  let failedCount = 0;

  for (const p of payments) {
    if (p.status === 'success') {
      successCount += 1;
      if (p.type === 'payment') collectedAmount += p.amount;
      if (p.type === 'refund') refundedAmount += p.amount;
    } else if (p.status === 'pending') {
      pendingCount += 1;
    } else if (['failed', 'expired'].includes(p.status)) {
      failedCount += 1;
    }
  }

  const total = payments.length;
  const paginated = payments.slice(skip, skip + limit);

  const items = paginated.map((p) => ({
    id: p._id.toString(),
    transactionRef: p.transactionRef,
    studentId: p.studentId?._id?.toString() || null,
    studentName: p.studentId?.fullName || '',
    studentCode: p.studentId?.studentCode || '',
    invoiceId: p.invoiceId?._id?.toString() || null,
    invoiceCode: p.invoiceId?.invoiceCode || '',
    invoiceType: p.invoiceId?.type || '',
    amount: p.amount,
    type: p.type,
    method: p.method,
    status: p.status,
    bankReference: p.bankReference || null,
    gatewayTransactionId: p.gatewayTransactionId || null,
    createdAt: p.createdAt,
    paidAt: p.paidAt,
    recordedByName: p.recordedBy?.fullName || 'Ban quản lý',
    note: p.note || '',
  }));

  return {
    items,
    total,
    page,
    limit,
    summary: {
      collectedAmount,
      refundedAmount,
      successCount,
      pendingCount,
      failedCount,
    },
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

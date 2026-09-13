/**
 * Service xử lý logic nghiệp vụ cho Module Requests (Yêu cầu gia hạn & trả phòng).
 * Thực hiện:
 * 1. Sinh viên gửi yêu cầu trực tuyến (Gia hạn / Trả phòng).
 * 2. Nhân viên duyệt Gia hạn: Tự động kéo dài thời hạn Hợp đồng và Lưu trú.
 * 3. ⭐ Nhân viên duyệt Trả phòng: Tự động quyết toán cọc (PRD §2.9 A3), giải phóng giường, kết thúc lưu trú và thanh lý hợp đồng.
 * 4. Nhân viên từ chối: Ghi nhận lý do bắt buộc.
 * Tuân thủ theo API.md §9, §10 và DATA-SCHEMA.md §3.12, §4.
 */

const Request = require('./request.model');
const Contract = require('../contracts/contract.model');
const Residency = require('../residencies/residency.model');
const Bed = require('../rooms/bed.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const ApiError = require('../../core/errors/api-error');

/**
 * Sinh viên gửi yêu cầu Gia hạn hoặc Trả phòng (API.md §10 POST /api/portal/my-requests).
 */
const createRequest = async (data, user) => {
  let studentId = user.studentId;
  if (!studentId && user.role !== 'student' && data.studentId) {
    studentId = data.studentId;
  }

  if (!studentId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Không xác định được hồ sơ sinh viên');
  }

  // 1. Kiểm tra hợp đồng đang hiệu lực của sinh viên
  let contract;
  if (data.contractId) {
    contract = await Contract.findOne({ _id: data.contractId, studentId, status: 'active' });
  } else {
    contract = await Contract.findOne({ studentId, status: 'active' });
  }

  if (!contract) {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Bạn chưa có hợp đồng đang hiệu lực');
  }

  // 2. Chống gửi nhiều yêu cầu cùng loại đang pending (API.md §10)
  const existingPending = await Request.findOne({
    contractId: contract._id,
    type: data.type,
    status: 'pending',
  });

  if (existingPending) {
    throw new ApiError(409, 'DUPLICATE_PENDING_REQUEST', 'Bạn đã có một yêu cầu cùng loại đang chờ xử lý');
  }

  // 3. Tạo bản ghi Request
  const request = await Request.create({
    studentId,
    contractId: contract._id,
    type: data.type,
    reason: data.reason || '',
    requestedEndDate: new Date(data.requestedEndDate),
    status: 'pending',
  });

  return request;
};

/**
 * Danh sách yêu cầu cho Staff hoặc Sinh viên (API.md §9 GET /api/requests).
 */
const getRequests = async (query = {}, user = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};

  if (user && user.role === 'student') {
    filter.studentId = user.studentId;
  } else if (query.studentId) {
    filter.studentId = query.studentId;
  }

  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.contractId) filter.contractId = query.contractId;

  const [items, total] = await Promise.all([
    Request.find(filter)
      .populate('studentId', 'fullName studentCode phone email gender')
      .populate('contractId', 'contractNumber startDate endDate depositAmount status')
      .populate('reviewedBy', 'fullName email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Request.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
  };
};

/**
 * Lấy chi tiết 1 yêu cầu kèm tổng nợ hiện tại của sinh viên (API.md §9 GET /api/requests/:id).
 */
const getRequestById = async (id, user = null) => {
  const request = await Request.findById(id)
    .populate('studentId', 'fullName studentCode phone email gender')
    .populate({
      path: 'contractId',
      populate: { path: 'residencyId', populate: { path: 'bedId' } },
    })
    .populate('reviewedBy', 'fullName email');

  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu');
  }

  if (user && user.role === 'student') {
    const ownerId = request.studentId?._id?.toString() || request.studentId?.toString();
    if (ownerId !== user.studentId?.toString()) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem yêu cầu của sinh viên khác');
    }
  }

  // Tính tổng nợ chưa thanh toán của sinh viên
  const studentObjId = request.studentId?._id || request.studentId;
  const unpaidInvoices = await Invoice.find({
    studentId: studentObjId,
    status: { $in: ['unpaid', 'partial', 'overdue'] },
  });

  const outstandingDebt = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)),
    0
  );

  const requestObj = request.toJSON();
  requestObj.outstandingDebt = outstandingDebt;

  return requestObj;
};

/**
 * Sinh viên hủy yêu cầu của chính mình khi còn pending (API.md §10 DELETE /api/portal/my-requests/:id).
 */
const cancelRequest = async (id, user) => {
  const request = await Request.findById(id);
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu');
  }

  if (user && user.role === 'student') {
    const ownerId = request.studentId?._id?.toString() || request.studentId?.toString();
    if (ownerId !== user.studentId?.toString()) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền hủy yêu cầu của sinh viên khác');
    }
  }

  if (request.status !== 'pending') {
    throw new ApiError(422, 'REQUEST_NOT_PENDING', 'Chỉ có thể hủy yêu cầu đang ở trạng thái chờ xử lý (pending)');
  }

  request.status = 'cancelled';
  await request.save();

  return request;
};

/**
 * Nhân viên duyệt yêu cầu Gia hạn hoặc Trả phòng (API.md §9 PATCH /api/requests/:id/approve).
 */
const approveRequest = async (id, body = {}, actorId) => {
  const request = await Request.findById(id).populate('contractId');
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu cần duyệt');
  }

  if (request.status !== 'pending') {
    throw new ApiError(422, 'REQUEST_NOT_PENDING', 'Yêu cầu này đã được xử lý hoặc đã bị hủy');
  }

  const contract = await Contract.findById(request.contractId._id || request.contractId);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng liên quan');
  }

  // ========================================================
  // TRƯỜNG HỢP 1: DUYỆT GIA HẠN HỢP ĐỒNG (RENEWAL)
  // ========================================================
  if (request.type === 'renewal') {
    const newEndDate = body.requestedEndDate
      ? new Date(body.requestedEndDate)
      : new Date(request.requestedEndDate);

    if (newEndDate <= contract.endDate) {
      throw new ApiError(422, 'INVALID_END_DATE', 'Ngày kết thúc mới phải sau ngày kết thúc hợp đồng hiện tại');
    }

    // 1. Kéo dài ngày kết thúc của Contract
    contract.endDate = newEndDate;
    await contract.save();

    // 2. Kéo dài ngày kết thúc của Residency
    if (contract.residencyId) {
      const residency = await Residency.findById(contract.residencyId);
      if (residency) {
        residency.endDate = newEndDate;
        await residency.save();
      }
    }

    // 3. Cập nhật trạng thái Request
    request.status = 'approved';
    request.reviewedBy = actorId;
    request.reviewedAt = new Date();
    request.reviewNote = body.staffNote || 'Duyệt gia hạn hợp đồng thành công';
    await request.save();

    return {
      request,
      contract,
    };
  }

  // ========================================================
  // TRƯỜNG HỢP 2: DUYỆT TRẢ PHÒNG & QUYẾT TOÁN CỌC (CHECKOUT - PRD §2.9 A3, BR-33, BR-34)
  // ========================================================
  if (request.type === 'checkout') {
    // 1. Tính tổng nợ chưa thanh toán của sinh viên
    const unpaidInvoices = await Invoice.find({
      studentId: request.studentId,
      status: { $in: ['unpaid', 'partial', 'overdue'] },
    });

    const outstandingDebt = unpaidInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)),
      0
    );

    // Kiểm tra forceConfirm nếu sinh viên còn nợ tiền (API.md §9, BR-33)
    if (outstandingDebt > 0 && !body.forceConfirm) {
      throw new ApiError(
        422,
        'STUDENT_HAS_DEBT',
        `Sinh viên còn nợ ${outstandingDebt.toLocaleString('vi-VN')} đ. Xác nhận vẫn duyệt?`,
        { outstandingDebt }
      );
    }

    const residency = await Residency.findById(contract.residencyId);
    const depositAmount = contract.depositAmount || 0;
    const refund = depositAmount - outstandingDebt;
    const checkoutDate = body.actualCheckoutDate ? new Date(body.actualCheckoutDate) : new Date();

    let settlementInvoice = null;
    let refundPayment = null;

    if (refund > 0) {
      // Tiền cọc lớn hơn số nợ -> Hoàn lại phần chênh lệch cho sinh viên
      contract.depositRefunded = refund;
      contract.depositStatus = 'refunded';

      // Ghi nhận bản ghi thanh toán hoàn cọc (Payment type: 'refund') theo DATA-SCHEMA.md §4
      refundPayment = await Payment.create({
        studentId: request.studentId,
        amount: refund,
        paymentMethod: 'cash',
        type: 'refund',
        transactionId: `REFUND-${Date.now()}`,
        status: 'completed',
        paidAt: new Date(),
        note: `Hoàn trả cọc sau khi trừ nợ (Cọc: ${depositAmount.toLocaleString()}đ - Nợ: ${outstandingDebt.toLocaleString()}đ)`,
        recordedBy: actorId,
      });
    } else {
      // Tiền cọc bị trừ hết do nợ
      contract.depositRefunded = 0;
      contract.depositStatus = 'forfeited';

      if (refund < 0) {
        // Sinh viên còn thiếu tiền nợ sau khi đã cấn trừ hết cọc
        const studentStillOwes = Math.abs(refund);
        settlementInvoice = await Invoice.create({
          invoiceCode: `SETTLE-${Date.now()}`,
          studentId: request.studentId,
          contractId: contract._id,
          type: 'settlement',
          items: [
            {
              feeTypeCode: 'other',
              name: 'Công nợ còn lại sau khi khấu trừ tiền cọc',
              quantity: 1,
              unitPrice: studentStillOwes,
              amount: studentStillOwes,
            },
          ],
          totalAmount: studentStillOwes,
          paidAmount: 0,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          status: 'unpaid',
        });
      }
    }

    // 2. Cascade: Chấm dứt hợp đồng sang 'terminated'
    contract.status = 'terminated';
    await contract.save();

    // 3. Cascade: Đóng bản ghi lưu trú sang 'ended' / 'closed'
    if (residency) {
      residency.status = 'ended';
      residency.endDate = checkoutDate;
      await residency.save();

      // 4. Cascade: Giải phóng giường về 'available'
      if (residency.bedId) {
        await Bed.findByIdAndUpdate(residency.bedId, { status: 'available' });
      }
    }

    // 5. Lưu kết quả quyết toán vào Request
    const settlementData = {
      outstandingDebt,
      depositAmount,
      refundAmount: Math.max(0, refund),
      studentStillOwes: refund < 0 ? Math.abs(refund) : 0,
      settlementInvoiceId: settlementInvoice ? settlementInvoice._id : null,
      refundPaymentId: refundPayment ? refundPayment._id : null,
      settledAt: new Date(),
      settledBy: actorId,
    };

    request.status = 'approved';
    request.reviewedBy = actorId;
    request.reviewedAt = new Date();
    request.reviewNote = body.staffNote || 'Duyệt trả phòng và quyết toán cọc hoàn tất';
    request.settlement = settlementData;
    await request.save();

    return {
      request,
      settlement: settlementData,
    };
  }
};

/**
 * Nhân viên từ chối yêu cầu (API.md §9 PATCH /api/requests/:id/reject).
 */
const rejectRequest = async (id, body, actorId) => {
  const request = await Request.findById(id);
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu');
  }

  if (request.status !== 'pending') {
    throw new ApiError(422, 'REQUEST_NOT_PENDING', 'Yêu cầu này đã được xử lý hoặc đã bị hủy');
  }

  if (!body.reviewNote || !body.reviewNote.trim()) {
    throw new ApiError(400, 'BAD_REQUEST', 'Lý do từ chối là bắt buộc');
  }

  request.status = 'rejected';
  request.reviewNote = body.reviewNote.trim();
  request.reviewedBy = actorId;
  request.reviewedAt = new Date();
  await request.save();

  return request;
};

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  cancelRequest,
  approveRequest,
  rejectRequest,
};

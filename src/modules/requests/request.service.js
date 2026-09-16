/**
 * Service xử lý logic nghiệp vụ cho Module Requests (Gia hạn / Trả phòng).
 * Tuân thủ theo API.md §9, §10, DATA-SCHEMA.md §3.12, §4 và PRD §2.9 A3.
 */

const mongoose = require('mongoose');
const Request = require('./request.model');
const Contract = require('../contracts/contract.model');
const Student = require('../students/student.model');
const Residency = require('../residencies/residency.model');
const Bed = require('../rooms/bed.model');
const Room = require('../rooms/room.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const FeeType = require('../fees/fee-type.model');
const ApiError = require('../../core/errors/api-error');
const {
  generateRequestCode,
  generateInvoiceCode,
  generateTransactionRef,
} = require('../../core/utils/code-generator');

/**
 * Tính tổng công nợ chưa thanh toán của sinh viên
 */
const calculateStudentDebt = async (studentId) => {
  const invoices = await Invoice.find({
    studentId,
    status: { $in: ['unpaid', 'partial', 'overdue'] },
  });
  return invoices.reduce((sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)), 0);
};

/**
 * Lấy danh sách yêu cầu hàng đợi nhân viên (admin, staff, viewer)
 */
const getRequests = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.studentId) filter.studentId = query.studentId;
  if (query.contractId) filter.contractId = query.contractId;

  // Thống kê summary
  const summaryFilter = query.status ? { status: query.status } : {};
  const [pendingCount, approvedCount, rejectedCount, byTypeRenewal, byTypeCheckout] = await Promise.all([
    Request.countDocuments({ status: 'pending' }),
    Request.countDocuments({ status: 'approved' }),
    Request.countDocuments({ status: 'rejected' }),
    Request.countDocuments({ ...summaryFilter, type: 'renewal' }),
    Request.countDocuments({ ...summaryFilter, type: 'checkout' }),
  ]);

  const summary = {
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
    byType: {
      all: byTypeRenewal + byTypeCheckout,
      renewal: byTypeRenewal,
      checkout: byTypeCheckout,
    },
  };

  const sort = query.status === 'pending'
    ? { createdAt: -1 }
    : { reviewedAt: -1, createdAt: -1 };

  let requests = await Request.find(filter)
    .populate('studentId', 'studentCode fullName phone className')
    .populate({
      path: 'contractId',
      select: 'contractCode startDate endDate monthlyPrice depositAmount bedId',
      populate: {
        path: 'bedId',
        select: 'bedCode roomId',
        populate: {
          path: 'roomId',
          select: 'roomNumber buildingId',
          populate: { path: 'buildingId', select: 'name code' },
        },
      },
    })
    .sort(sort);

  if (query.search) {
    const s = query.search.trim().toLowerCase();
    requests = requests.filter((r) => {
      const reqCode = r.requestCode?.toLowerCase() || '';
      const stuCode = r.studentId?.studentCode?.toLowerCase() || '';
      const stuName = r.studentId?.fullName?.toLowerCase() || '';
      const cCode = r.contractId?.contractCode?.toLowerCase() || '';
      const bedCode = r.contractId?.bedId?.bedCode?.toLowerCase() || '';
      return reqCode.includes(s) || stuCode.includes(s) || stuName.includes(s) || cCode.includes(s) || bedCode.includes(s);
    });
  }

  const total = requests.length;
  const paginated = requests.slice(skip, skip + limit);

  const items = await Promise.all(
    paginated.map(async (r) => {
      const studentDebt = r.studentId ? await calculateStudentDebt(r.studentId._id) : 0;
      const contract = r.contractId;
      const bed = contract?.bedId;
      const room = bed?.roomId;
      const building = room?.buildingId;

      return {
        id: r._id.toString(),
        requestCode: r.requestCode,
        studentId: r.studentId?._id?.toString() || null,
        studentCode: r.studentId?.studentCode || '',
        studentName: r.studentId?.fullName || '',
        contractId: contract?._id?.toString() || null,
        contractCode: contract?.contractCode || '',
        bedCode: bed?.bedCode || '',
        roomNumber: room?.roomNumber || '',
        buildingName: building?.name || '',
        buildingCode: building?.code || '',
        type: r.type,
        reason: r.reason,
        requestedEndDate: r.requestedEndDate,
        contractEndDate: contract?.endDate || null,
        status: r.status,
        outstandingDebt: studentDebt,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        settlement: r.settlement,
        renewal: r.renewal,
      };
    })
  );

  return {
    items,
    total,
    page,
    limit,
    summary,
  };
};

/**
 * Lấy chi tiết một yêu cầu gia hạn/trả phòng
 */
const getRequestById = async (id) => {
  const request = await Request.findById(id)
    .populate('studentId')
    .populate({
      path: 'contractId',
      populate: {
        path: 'bedId',
        populate: {
          path: 'roomId',
          populate: [
            { path: 'buildingId' },
            { path: 'roomTypeId' },
          ],
        },
      },
    });

  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu');
  }

  const student = request.studentId;
  const contract = request.contractId;
  const bed = contract?.bedId;
  const room = bed?.roomId;
  const roomType = room?.roomTypeId;

  // Lấy các hóa đơn chưa thanh toán của sinh viên
  const unpaidInvoices = await Invoice.find({
    studentId: student?._id,
    status: { $in: ['unpaid', 'partial', 'overdue'] },
  }).sort({ dueDate: 1 });

  const outstandingDebt = unpaidInvoices.reduce(
    (sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)),
    0
  );

  let unpaidSupplyOrders = 0;
  let readySupplyOrders = 0;
  if (mongoose.models.SupplyOrder) {
    unpaidSupplyOrders = await mongoose.models.SupplyOrder.countDocuments({
      studentId: student?._id,
      status: 'pending_payment',
    });
    readySupplyOrders = await mongoose.models.SupplyOrder.countDocuments({
      studentId: student?._id,
      status: 'ready',
    });
  }

  const result = {
    id: request._id.toString(),
    requestCode: request.requestCode,
    type: request.type,
    status: request.status,
    reason: request.reason,
    requestedEndDate: request.requestedEndDate,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    reviewNote: request.reviewNote,
    student: student ? {
      id: student._id.toString(),
      studentCode: student.studentCode,
      fullName: student.fullName,
      gender: student.gender,
      className: student.className,
      phone: student.phone,
    } : null,
    contract: contract ? {
      id: contract._id.toString(),
      contractCode: contract.contractCode,
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      monthlyPrice: contract.monthlyPrice,
      depositAmount: contract.depositAmount,
      bedCode: bed?.bedCode || '',
      roomTypeName: roomType?.name || '',
    } : null,
    unpaidInvoices: unpaidInvoices.map((inv) => ({
      id: inv._id.toString(),
      invoiceCode: inv.invoiceCode,
      type: inv.type,
      billingPeriod: inv.billingPeriod,
      dueDate: inv.dueDate.toISOString().slice(0, 10),
      remainingAmount: inv.totalAmount - (inv.paidAmount || 0),
    })),
    unpaidSupplyOrders,
    readySupplyOrders,
  };

  // Nếu là pending checkout -> kèm settlementPreview & checklist
  if (request.status === 'pending' && request.type === 'checkout') {
    const depositAmount = contract?.depositAmount || 0;
    const refundAmount = Math.max(0, depositAmount - outstandingDebt);
    const studentStillOwes = Math.max(0, outstandingDebt - depositAmount);

    result.settlementPreview = {
      checkoutDate: request.requestedEndDate.toISOString().slice(0, 10),
      depositAmount,
      outstandingDebt,
      proratedRent: 0,
      proratedDays: 0,
      daysInMonth: 30,
      proratedPeriod: null,
      refundAmount,
      studentStillOwes,
      cancelledSupplyOrders: unpaidSupplyOrders,
    };

    result.checklist = {
      utilityPeriod: new Date().toISOString().slice(0, 7),
      utilityReadingRecorded: true,
      readySupplyOrders,
    };
  }

  // Nếu là pending renewal -> kèm renewalPreview
  if (request.status === 'pending' && request.type === 'renewal' && contract) {
    const currEnd = new Date(contract.endDate);
    const reqEnd = new Date(request.requestedEndDate);
    const extraMonths = Math.max(
      1,
      (reqEnd.getFullYear() - currEnd.getFullYear()) * 12 + (reqEnd.getMonth() - currEnd.getMonth())
    );

    result.renewalPreview = {
      currentEndDate: currEnd.toISOString().slice(0, 10),
      requestedEndDate: reqEnd.toISOString().slice(0, 10),
      extraMonths,
    };
  }

  // Nếu đã xử lý -> kèm kết quả lưu trữ
  if (request.status === 'approved') {
    result.settlement = request.settlement;
    result.renewal = request.renewal;
  }

  return result;
};

/**
 * Sinh viên nộp yêu cầu gia hạn hoặc trả phòng
 */
const createRequest = async ({ type, requestedEndDate, reason, contractId }, studentId) => {
  let targetContractId = contractId;

  if (!targetContractId) {
    const activeContract = await Contract.findOne({ studentId, status: 'active' });
    if (!activeContract) {
      throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Bạn chưa có hợp đồng đang hiệu lực');
    }
    targetContractId = activeContract._id;
  }

  const contract = await Contract.findOne({ _id: targetContractId, studentId, status: 'active' });
  if (!contract) {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Hợp đồng không tồn tại hoặc không ở trạng thái hiệu lực');
  }

  const reqDate = new Date(requestedEndDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // BR-72: Gia hạn thì ngày mới phải sau ngày kết thúc hiện tại
  if (type === 'renewal') {
    if (reqDate <= new Date(contract.endDate)) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Ngày gia hạn phải sau ngày kết thúc hợp đồng hiện tại',
        { errors: [{ field: 'requestedEndDate', message: 'Ngày gia hạn phải sau ngày kết thúc hợp đồng' }] }
      );
    }
  }

  // Trả phòng thì ngày trả phòng phải từ hôm nay tới ngày kết thúc hợp đồng, lý do bắt buộc
  if (type === 'checkout') {
    if (reqDate < now || reqDate > new Date(contract.endDate)) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Ngày trả phòng phải nằm trong khoảng từ hôm nay đến ngày kết thúc hợp đồng',
        { errors: [{ field: 'requestedEndDate', message: 'Ngày trả phòng không hợp lệ' }] }
      );
    }
    if (!reason || reason.trim() === '') {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Lý do trả phòng là bắt buộc',
        { errors: [{ field: 'reason', message: 'Lý do trả phòng là bắt buộc' }] }
      );
    }
  }

  // BR-pending: Không được gửi trùng loại yêu cầu đang pending
  const existingPending = await Request.findOne({
    contractId: contract._id,
    type,
    status: 'pending',
  });
  if (existingPending) {
    throw new ApiError(
      409,
      'DUPLICATE_PENDING_REQUEST',
      'Bạn đã có một yêu cầu cùng loại đang chờ xử lý'
    );
  }

  const requestCode = generateRequestCode();

  const request = await Request.create({
    requestCode,
    studentId,
    contractId: contract._id,
    type,
    reason: reason || '',
    requestedEndDate: reqDate,
    status: 'pending',
  });

  return {
    id: request._id.toString(),
    requestCode: request.requestCode,
    type: request.type,
    status: request.status,
    requestedEndDate: request.requestedEndDate,
  };
};

/**
 * Duyệt yêu cầu (Renewal hoặc Checkout)
 */
const approveRequest = async (requestId, body = {}, reviewerUserId) => {
  const request = await Request.findById(requestId);
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu');
  }

  if (request.status !== 'pending') {
    throw new ApiError(422, 'REQUEST_NOT_PENDING', 'Yêu cầu đã được xử lý hoặc bị hủy');
  }

  const contract = await Contract.findById(request.contractId);
  if (!contract || contract.status !== 'active') {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Hợp đồng liên quan không còn ở trạng thái hiệu lực');
  }

  const now = new Date();

  // ==========================================
  // 1. Duyệt Gia hạn hợp đồng (Renewal)
  // ==========================================
  if (request.type === 'renewal') {
    const previousEndDate = new Date(contract.endDate);
    const newEndDate = new Date(request.requestedEndDate);

    if (newEndDate <= previousEndDate) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Ngày gia hạn phải lớn hơn ngày kết thúc hợp đồng hiện tại');
    }

    const extraMonths = Math.max(
      1,
      (newEndDate.getFullYear() - previousEndDate.getFullYear()) * 12 + (newEndDate.getMonth() - previousEndDate.getMonth())
    );

    contract.endDate = newEndDate;
    contract.history.push({
      at: now,
      type: 'request_renewal',
      title: 'Duyệt gia hạn hợp đồng',
      description: `Gia hạn thêm ${extraMonths} tháng đến ${newEndDate.toISOString().slice(0, 10)}`,
    });
    await contract.save();

    // Sinh hóa đơn tháng cho các kỳ gia hạn (BR-73)
    const rentFeeType = await FeeType.findOne({ code: 'rent' });
    let periodCursor = new Date(previousEndDate);
    periodCursor.setMonth(periodCursor.getMonth() + 1);

    while (periodCursor <= newEndDate) {
      const periodStr = `${periodCursor.getFullYear()}-${String(periodCursor.getMonth() + 1).padStart(2, '0')}`;
      const dueDate = new Date(periodCursor.getFullYear(), periodCursor.getMonth(), 10);

      const existingInv = await Invoice.findOne({
        studentId: contract.studentId,
        billingPeriod: periodStr,
        type: 'monthly',
      });

      if (!existingInv) {
        await Invoice.create({
          invoiceCode: generateInvoiceCode(now),
          studentId: contract.studentId,
          contractId: contract._id,
          type: 'monthly',
          billingPeriod: periodStr,
          lineItems: [
            {
              feeTypeId: rentFeeType?._id || null,
              description: `Tiền phòng kỳ gia hạn (${periodStr})`,
              quantity: 1,
              unitPrice: contract.monthlyPrice,
              amount: contract.monthlyPrice,
            },
          ],
          totalAmount: contract.monthlyPrice,
          paidAmount: 0,
          dueDate,
          status: 'unpaid',
          createdBy: reviewerUserId,
        });
      }

      periodCursor.setMonth(periodCursor.getMonth() + 1);
    }

    request.status = 'approved';
    request.reviewedBy = reviewerUserId;
    request.reviewedAt = now;
    request.renewal = {
      previousEndDate,
      newEndDate,
      extraMonths,
    };
    await request.save();

    return {
      request: {
        id: request._id.toString(),
        status: request.status,
      },
      renewal: request.renewal,
      settlement: null,
    };
  }

  // ==========================================
  // 2. Duyệt Trả phòng (Checkout) & Quyết toán Cọc
  // ==========================================
  if (request.type === 'checkout') {
    const checkoutDate = body.actualCheckoutDate ? new Date(body.actualCheckoutDate) : new Date(request.requestedEndDate);

    // 1. Hủy các đơn nhu yếu phẩm chưa thanh toán (BR-97)
    let cancelledSupplyOrders = 0;
    if (mongoose.models.SupplyOrder) {
      const cancelRes = await mongoose.models.SupplyOrder.updateMany(
        { studentId: contract.studentId, status: 'pending_payment' },
        { status: 'cancelled', cancelReason: 'Trả phòng KTX' }
      );
      cancelledSupplyOrders = cancelRes.modifiedCount || 0;
    }

    // 2. Tính công nợ chưa trả (sau khi hủy đơn hàng chưa nhận)
    const outstandingDebt = await calculateStudentDebt(contract.studentId);

    // 3. Kiểm tra nợ chưa trả: nếu còn nợ mà không có forceConfirm: true thì chặn (PRD §2.9 A3)
    if (outstandingDebt > 0 && !body.forceConfirm) {
      throw new ApiError(
        422,
        'STUDENT_HAS_DEBT',
        `Sinh viên còn nợ ${outstandingDebt.toLocaleString('vi-VN')} đ. Xác nhận vẫn duyệt?`,
        { outstandingDebt }
      );
    }

    // 4. Quyết toán cọc (A3 settlement)
    const depositAmount = contract.depositAmount || 0;
    const refundAmount = Math.max(0, depositAmount - outstandingDebt);
    const studentStillOwes = Math.max(0, outstandingDebt - depositAmount);
    const refundMethod = body.refundMethod || 'cash';

    let settlementInvoiceId = null;
    let refundPaymentId = null;

    // Nếu có tiền hoàn cọc -> ghi nhận Payment refund (BR-77)
    if (refundAmount > 0) {
      const refundPayment = await Payment.create({
        studentId: contract.studentId,
        amount: refundAmount,
        type: 'refund',
        method: refundMethod,
        transactionRef: generateTransactionRef(),
        status: 'success',
        paidAt: now,
        recordedBy: reviewerUserId,
        note: 'Hoàn trả tiền cọc khi trả phòng KTX',
      });
      refundPaymentId = refundPayment._id;
    }

    // Nếu nợ vượt quá cọc -> tạo hóa đơn settlement cho khoản chênh lệch
    if (studentStillOwes > 0) {
      const settleFeeType = await FeeType.findOne({ code: 'other' });
      const settleInvoice = await Invoice.create({
        invoiceCode: generateInvoiceCode(now),
        studentId: contract.studentId,
        contractId: contract._id,
        type: 'settlement',
        billingPeriod: null,
        lineItems: [
          {
            feeTypeId: settleFeeType?._id || null,
            description: 'Quyết toán công nợ còn thiếu sau khi trừ tiền cọc',
            quantity: 1,
            unitPrice: studentStillOwes,
            amount: studentStillOwes,
          },
        ],
        totalAmount: studentStillOwes,
        paidAmount: 0,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'unpaid',
        createdBy: reviewerUserId,
      });
      settlementInvoiceId = settleInvoice._id;
    }

    // Nếu tiền cọc đủ trừ nợ, tất toán các hóa đơn cũ chưa thanh toán
    if (depositAmount >= outstandingDebt && outstandingDebt > 0) {
      const unpaidInvoices = await Invoice.find({
        studentId: contract.studentId,
        status: { $in: ['unpaid', 'partial', 'overdue'] },
      });
      for (const inv of unpaidInvoices) {
        inv.paidAmount = inv.totalAmount;
        inv.status = 'paid';
        await inv.save();
      }
    }

    // 5. Cập nhật hợp đồng Contract -> terminated
    contract.status = 'terminated';
    contract.terminatedAt = checkoutDate;
    contract.terminationReason = `Trả phòng theo yêu cầu ${request.requestCode}`;
    contract.depositRefunded = refundAmount;
    contract.history.push({
      at: now,
      type: 'request_checkout',
      title: 'Duyệt trả phòng',
      description: `Quyết toán cọc hoàn: ${refundAmount.toLocaleString('vi-VN')} đ`,
    });
    await contract.save();

    // 6. Đóng lưu trú Residency
    await Residency.findByIdAndUpdate(contract.residencyId, {
      status: 'closed',
      endDate: checkoutDate,
    });

    // 7. Giải phóng giường về available
    await Bed.findByIdAndUpdate(contract.bedId, {
      status: 'available',
      note: null,
    });

    // 8. Hủy các yêu cầu khác đang pending của hợp đồng
    await Request.updateMany(
      { contractId: contract._id, _id: { $ne: request._id }, status: 'pending' },
      { status: 'cancelled', reviewNote: 'Hợp đồng đã kết thúc do duyệt trả phòng' }
    );

    // 9. Cập nhật yêu cầu
    const settlementData = {
      outstandingDebt,
      depositAmount,
      refundAmount,
      studentStillOwes,
      proratedRent: 0,
      refundMethod,
      settlementInvoiceId,
      refundPaymentId,
      cancelledSupplyOrders,
      settledAt: now,
      settledBy: reviewerUserId,
    };

    request.status = 'approved';
    request.reviewedBy = reviewerUserId;
    request.reviewedAt = now;
    request.settlement = settlementData;
    await request.save();

    return {
      request: {
        id: request._id.toString(),
        status: request.status,
      },
      settlement: {
        outstandingDebt,
        depositAmount,
        refundAmount,
        studentStillOwes,
        proratedRent: 0,
        refundMethod,
        settlementInvoiceId: settlementInvoiceId ? settlementInvoiceId.toString() : null,
        cancelledSupplyOrders,
      },
    };
  }
};

/**
 * Từ chối yêu cầu
 */
const rejectRequest = async (requestId, { reviewNote }, reviewerUserId) => {
  const request = await Request.findById(requestId);
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu');
  }

  if (request.status !== 'pending') {
    throw new ApiError(422, 'REQUEST_NOT_PENDING', 'Yêu cầu đã được xử lý hoặc bị hủy');
  }

  request.status = 'rejected';
  request.reviewNote = reviewNote;
  request.reviewedBy = reviewerUserId;
  request.reviewedAt = new Date();
  await request.save();

  return {
    id: request._id.toString(),
    status: request.status,
    reviewNote: request.reviewNote,
    reviewedAt: request.reviewedAt,
  };
};

/**
 * Sinh viên hủy yêu cầu của chính mình (chỉ khi còn pending)
 */
const cancelRequest = async (requestId, studentId) => {
  const request = await Request.findOne({ _id: requestId, studentId });
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu');
  }

  if (request.status !== 'pending') {
    throw new ApiError(
      422,
      'REQUEST_NOT_PENDING',
      'Yêu cầu đã được xử lý hoặc bị hủy, không thể hủy tiếp'
    );
  }

  request.status = 'cancelled';
  await request.save();

  return { message: 'Đã hủy yêu cầu thành công' };
};

/**
 * Lấy danh sách yêu cầu của sinh viên cho cổng sinh viên
 */
const getMyRequests = async (studentId) => {
  const requests = await Request.find({ studentId })
    .populate({
      path: 'contractId',
      select: 'contractCode startDate endDate monthlyPrice depositAmount bedId',
      populate: {
        path: 'bedId',
        select: 'bedCode roomId',
        populate: {
          path: 'roomId',
          select: 'roomNumber buildingId',
          populate: { path: 'buildingId', select: 'name code' },
        },
      },
    })
    .sort({ createdAt: -1 });

  return requests.map((r) => {
    const contract = r.contractId;
    const bed = contract?.bedId;
    const room = bed?.roomId;
    const building = room?.buildingId;

    return {
      id: r._id.toString(),
      requestCode: r.requestCode,
      type: r.type,
      reason: r.reason,
      requestedEndDate: r.requestedEndDate,
      contractCode: contract?.contractCode || '',
      bedCode: bed?.bedCode || '',
      roomNumber: room?.roomNumber || '',
      buildingName: building?.name || '',
      buildingCode: building?.code || '',
      contractEndDate: contract?.endDate || null,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      renewal: r.renewal,
      settlement: r.settlement,
    };
  });
};

module.exports = {
  getRequests,
  getRequestById,
  createRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getMyRequests,
};

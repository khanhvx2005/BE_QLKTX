/**
 * Service xử lý nghiệp vụ cho Module Contracts (Hợp đồng thuê phòng).
 * Tuân thủ theo API.md §6 và DATA-SCHEMA.md §3.7 (Chuẩn v1.2).
 */

const mongoose = require('mongoose');
const Contract = require('./contract.model');
const Residency = require('../residencies/residency.model');
const Bed = require('../rooms/bed.model');
const Room = require('../rooms/room.model');
const Student = require('../students/student.model');
const Invoice = require('../fees/invoice.model');
const Request = require('../requests/request.model');
const ApiError = require('../../core/errors/api-error');

/**
 * Tính tổng công nợ chưa trả của sinh viên
 */
const calculateStudentDebt = async (studentId) => {
  const invoices = await Invoice.find({
    studentId,
    status: { $in: ['unpaid', 'partial', 'overdue'] },
  });
  return invoices.reduce((sum, inv) => sum + (inv.totalAmount - (inv.paidAmount || 0)), 0);
};

/**
 * Lấy danh sách hợp đồng (admin, staff, viewer)
 */
const getContracts = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;

  const now = new Date();

  // Summary counts bỏ qua bộ lọc filter
  const allContracts = await Contract.find({});
  const summary = {
    all: allContracts.length,
    active: 0,
    expiring: 0,
    expired: 0,
    terminated: 0,
  };

  allContracts.forEach((c) => {
    if (c.status === 'active') {
      summary.active += 1;
      const diffDays = Math.ceil((new Date(c.endDate) - now) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        summary.expiring += 1;
      }
    } else if (c.status === 'expired') {
      summary.expired += 1;
    } else if (c.status === 'terminated') {
      summary.terminated += 1;
    }
  });

  // Xử lý sắp xếp theo query
  let sort = { startDate: -1 };
  if (query.expiringInDays) {
    const days = parseInt(query.expiringInDays, 10);
    const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    filter.status = 'active';
    filter.endDate = { $gte: now, $lte: targetDate };
    sort = { endDate: 1 };
  }

  let contracts = await Contract.find(filter)
    .populate('studentId', 'studentCode fullName phone className')
    .populate({
      path: 'bedId',
      select: 'bedCode roomId',
      populate: {
        path: 'roomId',
        select: 'roomNumber buildingId roomTypeId',
        populate: [
          { path: 'buildingId', select: 'name code' },
          { path: 'roomTypeId', select: 'name tier' },
        ],
      },
    })
    .sort(sort);

  // Lọc theo buildingId hoặc roomTypeId
  if (query.buildingId) {
    contracts = contracts.filter(
      (c) => c.bedId?.roomId?.buildingId?._id?.toString() === query.buildingId
    );
  }
  if (query.roomTypeId) {
    contracts = contracts.filter(
      (c) => c.bedId?.roomId?.roomTypeId?._id?.toString() === query.roomTypeId
    );
  }

  // Lọc theo search
  if (query.search) {
    const s = query.search.trim().toLowerCase();
    contracts = contracts.filter((c) => {
      const code = c.contractCode?.toLowerCase() || '';
      const stuCode = c.studentId?.studentCode?.toLowerCase() || '';
      const stuName = c.studentId?.fullName?.toLowerCase() || '';
      const bedCode = c.bedId?.bedCode?.toLowerCase() || '';
      return code.includes(s) || stuCode.includes(s) || stuName.includes(s) || bedCode.includes(s);
    });
  }

  const total = contracts.length;
  const paginated = contracts.slice(skip, skip + limit);

  const items = await Promise.all(
    paginated.map(async (c) => {
      const studentDebt = c.studentId ? await calculateStudentDebt(c.studentId._id) : 0;
      const bed = c.bedId;
      const room = bed?.roomId;
      const building = room?.buildingId;
      const roomType = room?.roomTypeId;

      const diffDays = Math.ceil((new Date(c.endDate) - now) / (1000 * 60 * 60 * 24));
      const isExpiring = c.status === 'active' && diffDays >= 0 && diffDays <= 30;

      return {
        id: c._id.toString(),
        contractCode: c.contractCode,
        studentId: c.studentId?._id?.toString() || null,
        studentCode: c.studentId?.studentCode || '',
        studentName: c.studentId?.fullName || '',
        bedId: bed?._id?.toString() || null,
        bedCode: bed?.bedCode || '',
        roomNumber: room?.roomNumber || '',
        buildingId: building?._id?.toString() || null,
        buildingCode: building?.code || '',
        buildingName: building?.name || '',
        roomTypeId: roomType?._id?.toString() || null,
        roomTypeName: roomType?.name || '',
        tier: roomType?.tier || 'standard',
        startDate: c.startDate,
        endDate: c.endDate,
        monthlyPrice: c.monthlyPrice,
        depositAmount: c.depositAmount,
        status: c.status,
        isExpiring,
        totalDebt: studentDebt,
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
 * Lấy chi tiết một hợp đồng
 */
const getContractById = async (id, user = null) => {
  const contract = await Contract.findById(id)
    .populate('studentId')
    .populate({
      path: 'bedId',
      populate: {
        path: 'roomId',
        populate: [
          { path: 'buildingId' },
          { path: 'roomTypeId' },
        ],
      },
    });

  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng');
  }

  // Bảo mật: sinh viên chỉ được xem hợp đồng của chính mình
  if (user?.role === 'student' && user?.studentId && contract.studentId?._id.toString() !== user.studentId.toString()) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem hợp đồng của sinh viên khác');
  }

  const now = new Date();
  const diffDays = Math.ceil((new Date(contract.endDate) - now) / (1000 * 60 * 60 * 24));
  const isExpiring = contract.status === 'active' && diffDays >= 0 && diffDays <= 30;
  const studentDebt = contract.studentId ? await calculateStudentDebt(contract.studentId._id) : 0;

  // Lấy danh sách hóa đơn liên quan đến hợp đồng
  const invoices = await Invoice.find({ contractId: contract._id }).sort({ createdAt: -1 });

  // Xác định trạng thái tiền cọc
  let depositStatus = 'pending';
  const depositInv = invoices.find((inv) => inv.type === 'deposit');
  if (contract.depositRefunded > 0) {
    depositStatus = 'refunded';
  } else if (depositInv && depositInv.status === 'paid') {
    depositStatus = 'paid';
  }

  // Lấy các yêu cầu đang chờ xử lý của hợp đồng
  const pendingRequests = await Request.find({
    contractId: contract._id,
    status: 'pending',
  }).select('type requestedEndDate createdAt');

  // Đếm đơn nhu yếu phẩm chưa thanh toán
  let unpaidSupplyOrders = 0;
  if (mongoose.models.SupplyOrder) {
    unpaidSupplyOrders = await mongoose.models.SupplyOrder.countDocuments({
      studentId: contract.studentId._id,
      status: 'pending_payment',
    });
  }

  const bed = contract.bedId;
  const room = bed?.roomId;
  const building = room?.buildingId;
  const roomType = room?.roomTypeId;

  return {
    id: contract._id.toString(),
    contractCode: contract.contractCode,
    studentId: contract.studentId?._id?.toString() || null,
    studentCode: contract.studentId?.studentCode || '',
    studentName: contract.studentId?.fullName || '',
    student: contract.studentId ? {
      id: contract.studentId._id.toString(),
      studentCode: contract.studentId.studentCode,
      fullName: contract.studentId.fullName,
      gender: contract.studentId.gender,
      className: contract.studentId.className,
      phone: contract.studentId.phone,
    } : null,
    bedId: bed?._id?.toString() || null,
    bedCode: bed?.bedCode || '',
    roomNumber: room?.roomNumber || '',
    buildingId: building?._id?.toString() || null,
    buildingCode: building?.code || '',
    buildingName: building?.name || '',
    roomTypeId: roomType?._id?.toString() || null,
    roomTypeName: roomType?.name || '',
    tier: roomType?.tier || 'standard',
    startDate: contract.startDate,
    endDate: contract.endDate,
    monthlyPrice: contract.monthlyPrice,
    depositAmount: contract.depositAmount,
    depositRefunded: contract.depositRefunded,
    depositStatus,
    terms: contract.terms,
    status: contract.status,
    isExpiring,
    totalDebt: studentDebt,
    terminatedAt: contract.terminatedAt,
    terminationReason: contract.terminationReason,
    invoices: invoices.map((inv) => ({
      id: inv._id.toString(),
      invoiceCode: inv.invoiceCode,
      type: inv.type,
      billingPeriod: inv.billingPeriod,
      totalAmount: inv.totalAmount,
      remainingAmount: inv.totalAmount - (inv.paidAmount || 0),
      status: inv.status,
      issueDate: inv.createdAt.toISOString().slice(0, 10),
    })),
    pendingRequests: pendingRequests.map((r) => ({
      id: r._id.toString(),
      type: r.type,
      createdAt: r.createdAt,
      requestedEndDate: r.requestedEndDate,
    })),
    unpaidSupplyOrders,
    history: (contract.history || []).sort((a, b) => new Date(b.at) - new Date(a.at)),
  };
};

/**
 * Cập nhật điều khoản hợp đồng (admin, staff)
 */
const updateContract = async (id, { terms }) => {
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng');
  }

  contract.terms = terms;
  await contract.save();
  return contract;
};

/**
 * Chấm dứt hợp đồng sớm (admin, staff) kèm quyết toán cọc
 */
const terminateContract = async (id, { reason, terminationDate }) => {
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng');
  }

  if (contract.status !== 'active') {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Chỉ có thể chấm dứt hợp đồng đang hiệu lực');
  }

  const now = new Date();
  const termDate = terminationDate ? new Date(terminationDate) : now;

  // 1. Hủy các đơn nhu yếu phẩm chưa thanh toán (BR-97)
  let cancelledSupplyOrders = 0;
  if (mongoose.models.SupplyOrder) {
    const cancelRes = await mongoose.models.SupplyOrder.updateMany(
      { studentId: contract.studentId, status: 'pending_payment' },
      { status: 'cancelled', cancelReason: 'Chấm dứt hợp đồng' }
    );
    cancelledSupplyOrders = cancelRes.modifiedCount || 0;
  }

  // 2. Tính công nợ chưa trả (sau khi hủy đơn hàng chưa nhận)
  const outstandingDebt = await calculateStudentDebt(contract.studentId);

  // 3. Tính tiền cọc hoàn trả và tiền sinh viên còn phải đóng thêm (A3 settlement)
  const refundAmount = Math.max(0, contract.depositAmount - outstandingDebt);
  const studentStillOwes = Math.max(0, outstandingDebt - contract.depositAmount);

  // 4. Cập nhật hợp đồng sang terminated
  contract.status = 'terminated';
  contract.terminationReason = reason;
  contract.terminatedAt = termDate;
  contract.depositRefunded = refundAmount;
  contract.history.push({
    at: now,
    type: 'terminated',
    title: 'Chấm dứt hợp đồng',
    description: reason,
  });
  await contract.save();

  // 5. Đóng lưu trú Residency
  await Residency.findByIdAndUpdate(contract.residencyId, {
    status: 'closed',
    endDate: termDate,
  });

  // 6. Giải phóng giường về available
  await Bed.findByIdAndUpdate(contract.bedId, {
    status: 'available',
    note: null,
  });

  // 7. Hủy các yêu cầu gia hạn/trả phòng đang pending của hợp đồng
  await Request.updateMany(
    { contractId: contract._id, status: 'pending' },
    { status: 'cancelled', reviewNote: 'Hợp đồng đã bị chấm dứt' }
  );

  return {
    contract: {
      id: contract._id.toString(),
      contractCode: contract.contractCode,
      status: contract.status,
      terminatedAt: contract.terminatedAt,
    },
    settlement: {
      outstandingDebt,
      depositAmount: contract.depositAmount,
      refundAmount,
      studentStillOwes,
      cancelledSupplyOrders,
    },
  };
};

module.exports = {
  getContracts,
  getContractById,
  updateContract,
  terminateContract,
};

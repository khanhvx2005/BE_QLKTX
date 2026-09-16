/**
 * Service xử lý nghiệp vụ cho Cổng sinh viên (Student Portal - /api/portal/*).
 * Tuân thủ theo API.md §10 và DATA-SCHEMA.md.
 */

const Student = require('../students/student.model');
const Contract = require('../contracts/contract.model');
const Residency = require('../residencies/residency.model');
const Bed = require('../rooms/bed.model');
const Room = require('../rooms/room.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
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
 * Lấy hồ sơ cá nhân sinh viên
 * GET /api/portal/profile
 */
const getProfile = async (studentId) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  return {
    id: student._id.toString(),
    studentCode: student.studentCode,
    fullName: student.fullName,
    gender: student.gender,
    faculty: student.faculty || '',
    className: student.className || '',
    phone: student.phone,
    email: student.email || '',
    dob: student.dob,
    emergencyContact: student.emergencyContact || null,
    status: student.status,
  };
};

/**
 * Lấy thông tin chỗ ở hiện tại của sinh viên (v1.2.8)
 * GET /api/portal/my-residence
 */
const getMyResidence = async (studentId) => {
  const contract = await Contract.findOne({ studentId, status: 'active' })
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
    return { hasResidence: false };
  }

  const bed = contract.bedId;
  const room = bed?.roomId;
  const building = room?.buildingId;
  const roomType = room?.roomTypeId;

  // Lấy danh sách bạn cùng phòng (roommates) - không để lộ thông tin nhạy cảm (BR-86)
  const roomBeds = await Bed.find({ roomId: room?._id });
  const bedIds = roomBeds.map((b) => b._id).filter((id) => id.toString() !== bed?._id?.toString());

  const activeResidencies = await Residency.find({
    bedId: { $in: bedIds },
    status: 'active',
  }).populate('studentId', 'studentCode fullName');

  const roommates = activeResidencies
    .filter((r) => r.studentId)
    .map((r) => ({
      studentCode: r.studentId.studentCode,
      fullName: r.studentId.fullName,
    }));

  const includedInRoom = Array.from(
    new Set([...(roomType?.amenities || []), ...(roomType?.includedSupplies || [])])
  );

  const totalDebt = await calculateStudentDebt(studentId);
  const unpaidInvoiceCount = await Invoice.countDocuments({
    studentId,
    status: { $in: ['unpaid', 'partial', 'overdue'] },
  });

  return {
    hasResidence: true,
    contract: {
      id: contract._id.toString(),
      contractCode: contract.contractCode,
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      monthlyPrice: contract.monthlyPrice,
      depositAmount: contract.depositAmount,
      bedCode: bed?.bedCode || '',
      roomId: room?._id?.toString() || '',
      roomNumber: room?.roomNumber || '',
      buildingName: building?.name || '',
      roomTypeId: roomType?._id?.toString() || '',
      roomTypeName: roomType?.name || '',
    },
    roomType: {
      id: roomType?._id?.toString() || '',
      name: roomType?.name || '',
      tier: roomType?.tier || 'standard',
      pricePerMonth: roomType?.pricePerMonth || 0,
    },
    includedInRoom,
    roommates,
    debtSummary: {
      totalDebt,
      unpaidInvoiceCount,
    },
  };
};

/**
 * Lấy danh sách hợp đồng của sinh viên
 * GET /api/portal/my-contracts
 */
const getMyContracts = async (studentId) => {
  const contracts = await Contract.find({ studentId })
    .populate({
      path: 'bedId',
      populate: {
        path: 'roomId',
        populate: [
          { path: 'buildingId' },
          { path: 'roomTypeId' },
        ],
      },
    })
    .sort({ startDate: -1 });

  return contracts.map((c) => {
    const bed = c.bedId;
    const room = bed?.roomId;
    const building = room?.buildingId;
    const roomType = room?.roomTypeId;

    return {
      id: c._id.toString(),
      contractCode: c.contractCode,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      monthlyPrice: c.monthlyPrice,
      depositAmount: c.depositAmount,
      bedCode: bed?.bedCode || '',
      roomNumber: room?.roomNumber || '',
      buildingName: building?.name || '',
      roomTypeName: roomType?.name || '',
      tier: roomType?.tier || 'standard',
    };
  });
};

/**
 * Lấy danh sách hóa đơn của sinh viên
 * GET /api/portal/my-invoices
 */
const getMyInvoices = async (studentId, query = {}) => {
  const filter = { studentId };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;

  const invoices = await Invoice.find(filter).sort({ createdAt: -1 });

  return invoices.map((inv) => ({
    id: inv._id.toString(),
    invoiceCode: inv.invoiceCode,
    type: inv.type,
    billingPeriod: inv.billingPeriod,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount || 0,
    remainingAmount: inv.totalAmount - (inv.paidAmount || 0),
    dueDate: inv.dueDate.toISOString().slice(0, 10),
    status: inv.status,
    lineItems: inv.lineItems,
    createdAt: inv.createdAt,
  }));
};

/**
 * Lấy chi tiết hóa đơn của sinh viên
 * GET /api/portal/my-invoices/:id
 */
const getMyInvoiceById = async (studentId, invoiceId) => {
  const invoice = await Invoice.findOne({ _id: invoiceId, studentId }).populate(
    'lineItems.feeTypeId',
    'name unit defaultAmount'
  );

  if (!invoice) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hóa đơn');
  }

  const payments = await Payment.find({ invoiceId: invoice._id, status: 'success' }).sort({
    paidAt: -1,
  });

  return {
    id: invoice._id.toString(),
    invoiceCode: invoice.invoiceCode,
    type: invoice.type,
    billingPeriod: invoice.billingPeriod,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount || 0,
    remainingAmount: invoice.totalAmount - (invoice.paidAmount || 0),
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    status: invoice.status,
    lineItems: invoice.lineItems,
    payments: payments.map((p) => ({
      id: p._id.toString(),
      transactionRef: p.transactionRef,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt,
    })),
    createdAt: invoice.createdAt,
  };
};

/**
 * Lấy lịch sử thanh toán của sinh viên
 * GET /api/portal/my-payments
 */
const getMyPayments = async (studentId) => {
  const payments = await Payment.find({ studentId }).populate('invoiceId', 'invoiceCode type').sort({ createdAt: -1 });

  return payments.map((p) => ({
    id: p._id.toString(),
    transactionRef: p.transactionRef,
    invoiceCode: p.invoiceId?.invoiceCode || '',
    type: p.type,
    amount: p.amount,
    method: p.method,
    status: p.status,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  }));
};

/**
 * Danh mục mua sắm nhu yếu phẩm cho sinh viên (API.md §10 GET /api/portal/supply-items).
 * Lọc bỏ những món đã được cấp sẵn theo loại phòng.
 */
const getSupplyItems = async (studentId) => {
  const contract = await Contract.findOne({ studentId, status: 'active' }).populate({
    path: 'bedId',
    populate: {
      path: 'roomId',
      populate: { path: 'roomTypeId' },
    },
  });
  if (!contract) {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Bạn chưa có hợp đồng đang hiệu lực');
  }

  const roomType = contract.bedId?.roomId?.roomTypeId;
  const SupplyItem = require('../supplies/supply-item.model');
  const allActiveSupplies = await SupplyItem.find({ isActive: true });

  const roomTypeIdStr = roomType?._id?.toString();

  // Vật phẩm đã cấp kèm phòng
  const includedItems = allActiveSupplies.filter((item) =>
    item.includedInRoomTypes && item.includedInRoomTypes.some((rt) => rt.toString() === roomTypeIdStr)
  );

  // Vật phẩm bán trong shop (chưa được cấp theo phòng)
  const shopItems = allActiveSupplies.filter((item) =>
    !item.includedInRoomTypes || !item.includedInRoomTypes.some((rt) => rt.toString() === roomTypeIdStr)
  );

  const includedInRoom = [
    ...(roomType?.amenities || []),
    ...includedItems.map((i) => i.name),
  ];

  return {
    roomType: {
      name: roomType?.name || '',
    },
    includedInRoom,
    items: shopItems.map((i) => ({
      id: i._id.toString(),
      name: i.name,
      category: i.category,
      unit: i.unit,
      price: i.price,
      imageUrl: i.imageUrl,
    })),
  };
};

/**
 * Lấy danh sách đơn hàng nhu yếu phẩm của sinh viên
 * GET /api/portal/my-supply-orders
 */
const getMySupplyOrders = async (studentId, query = {}) => {
  const supplyService = require('../supplies/supply.service');
  return await supplyService.getStudentSupplyOrders(studentId, query);
};

/**
 * Đặt mua nhu yếu phẩm
 * POST /api/portal/my-supply-orders
 */
const placeMySupplyOrder = async (studentId, items) => {
  const supplyService = require('../supplies/supply.service');
  return await supplyService.placeSupplyOrder(studentId, items);
};

/**
 * Hủy đơn hàng nhu yếu phẩm khi còn pending_payment
 * PATCH /api/portal/my-supply-orders/:id/cancel
 */
const cancelMySupplyOrder = async (studentId, orderId) => {
  const supplyService = require('../supplies/supply.service');
  return await supplyService.cancelStudentSupplyOrder(orderId, studentId);
};

module.exports = {
  getProfile,
  getMyResidence,
  getMyContracts,
  getMyInvoices,
  getMyInvoiceById,
  getMyPayments,
  getSupplyItems,
  getMySupplyOrders,
  placeMySupplyOrder,
  cancelMySupplyOrder,
};

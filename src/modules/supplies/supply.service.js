/**
 * Service xử lý logic nghiệp vụ cho Module Supplies (Nhu yếu phẩm).
 * Tuân thủ theo API.md §11, 03-PHAN-TICH-NGHIEP-VU.md BR-90 → BR-97 và DATA-SCHEMA.md §3.15–3.16.
 */

const SupplyItem = require('./supply-item.model');
const SupplyOrder = require('./supply-order.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const FeeType = require('../fees/fee-type.model');
const ApiError = require('../../core/errors/api-error');
const { generateOrderCode, generateInvoiceCode } = require('../../core/utils/code-generator');

/**
 * Lấy danh mục vật phẩm nhu yếu phẩm.
 */
const getSupplyItems = async (query = {}) => {
  const filter = {};
  if (query.category) filter.category = query.category;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    SupplyItem.find(filter)
      .populate('includedInRoomTypes', 'name tier capacity')
      .sort('category name')
      .skip(skip)
      .limit(limit),
    SupplyItem.countDocuments(filter),
  ]);

  return { items, total, page, limit };
};

/**
 * Tạo mới vật phẩm nhu yếu phẩm (Admin, Staff).
 */
const createSupplyItem = async (data) => {
  return await SupplyItem.create(data);
};

/**
 * Cập nhật thông tin vật phẩm (Admin, Staff).
 */
const updateSupplyItem = async (id, data) => {
  const item = await SupplyItem.findById(id);
  if (!item) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy vật phẩm nhu yếu phẩm');
  }

  Object.assign(item, data);
  await item.save();
  return item;
};

/**
 * Lấy danh sách đơn đặt hàng nhu yếu phẩm (Admin, Staff, Viewer).
 * Bổ sung thống kê summary: pendingPayment, ready, deliveredToday.
 */
const getSupplyOrders = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  // Tìm kiếm theo mã đơn hoặc thông tin sinh viên
  if (query.search && query.search.trim()) {
    const searchRegex = { $regex: query.search.trim(), $options: 'i' };
    const Student = require('../students/student.model');
    const matchedStudents = await Student.find({
      $or: [{ fullName: searchRegex }, { studentCode: searchRegex }],
    }).select('_id');

    const studentIds = matchedStudents.map((s) => s._id);

    filter.$or = [
      { orderCode: searchRegex },
      { studentId: { $in: studentIds } },
    ];
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [items, total, pendingPaymentCount, readyCount, deliveredTodayCount] = await Promise.all([
    SupplyOrder.find(filter)
      .populate('studentId', 'studentCode fullName phone className')
      .populate('contractId', 'contractCode bedCode')
      .populate('invoiceId', 'invoiceCode totalAmount paidAmount status dueDate')
      .populate('deliveredBy', 'fullName email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    SupplyOrder.countDocuments(filter),
    SupplyOrder.countDocuments({ status: 'pending_payment' }),
    SupplyOrder.countDocuments({ status: 'ready' }),
    SupplyOrder.countDocuments({
      status: 'delivered',
      deliveredAt: { $gte: todayStart, $lte: todayEnd },
    }),
  ]);

  // Chuẩn hóa format list item theo API.md §11
  const formattedItems = items.map((order) => {
    const doc = order.toObject();
    return {
      id: doc._id,
      orderCode: doc.orderCode,
      status: doc.status,
      totalAmount: doc.totalAmount,
      student: doc.studentId
        ? {
            id: doc.studentId._id,
            studentCode: doc.studentId.studentCode,
            fullName: doc.studentId.fullName,
            phone: doc.studentId.phone,
          }
        : null,
      roomNumber: doc.contractId?.bedCode ? doc.contractId.bedCode.split('-')[0] : null,
      bedCode: doc.contractId?.bedCode || null,
      items: doc.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        amount: i.amount,
      })),
      invoice: doc.invoiceId,
      deliveredAt: doc.deliveredAt,
      deliveredBy: doc.deliveredBy,
      createdAt: doc.createdAt,
    };
  });

  return {
    items: formattedItems,
    total,
    page,
    limit,
    summary: {
      pendingPayment: pendingPaymentCount,
      ready: readyCount,
      deliveredToday: deliveredTodayCount,
    },
  };
};

/**
 * Chi tiết đơn hàng nhu yếu phẩm.
 */
const getSupplyOrderById = async (id) => {
  const order = await SupplyOrder.findById(id)
    .populate('studentId', 'studentCode fullName phone className email')
    .populate({
      path: 'contractId',
      populate: { path: 'roomTypeId', select: 'name tier' },
    })
    .populate('invoiceId', 'invoiceCode totalAmount paidAmount status dueDate')
    .populate('deliveredBy', 'fullName email')
    .populate('items.supplyItemId', 'name unit price imageUrl category');

  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng nhu yếu phẩm');
  }

  return order;
};

/**
 * Bàn giao nhu yếu phẩm cho sinh viên (ready → delivered).
 */
const deliverSupplyOrder = async (id, actorId) => {
  const order = await SupplyOrder.findById(id);
  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng nhu yếu phẩm');
  }

  if (order.status !== 'ready') {
    throw new ApiError(422, 'INVALID_ORDER_STATUS', 'Chỉ giao được đơn đang chờ nhận hàng');
  }

  order.status = 'delivered';
  order.deliveredAt = new Date();
  order.deliveredBy = actorId;
  await order.save();

  return order;
};

/**
 * Hủy đơn hàng nhu yếu phẩm (pending_payment → cancelled) do Admin/Nhân viên thực hiện.
 */
const cancelSupplyOrder = async (id, cancelReason) => {
  const order = await SupplyOrder.findById(id);
  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng nhu yếu phẩm');
  }

  if (order.status !== 'pending_payment') {
    throw new ApiError(422, 'ORDER_NOT_CANCELLABLE', 'Đơn hàng đã thanh toán, không thể hủy');
  }

  order.status = 'cancelled';
  order.cancelReason = cancelReason || 'Ban quản lý hủy đơn hàng';
  await order.save();

  // Hủy kèm hóa đơn supplies tương ứng
  await Invoice.findByIdAndUpdate(order.invoiceId, { status: 'cancelled' });

  return order;
};

/**
 * Sinh viên đặt mua nhu yếu phẩm từ Cổng sinh viên (API.md §10 POST /api/portal/my-supply-orders).
 */
const placeSupplyOrder = async (studentId, requestedItems) => {
  // 1. Kiểm tra hợp đồng đang hiệu lực
  const contract = await Contract.findOne({ studentId, status: 'active' }).populate({
    path: 'bedId',
    populate: { path: 'roomId' },
  });
  if (!contract) {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Bạn chưa có hợp đồng đang hiệu lực');
  }

  const studentRoomTypeId = contract.bedId?.roomId?.roomTypeId?.toString();

  // 2. Kiểm tra danh mục vật phẩm và tính tiền
  const orderItems = [];
  let totalAmount = 0;

  for (const item of requestedItems) {
    const supplyItem = await SupplyItem.findById(item.supplyItemId);
    if (!supplyItem || !supplyItem.isActive) {
      throw new ApiError(
        422,
        'SUPPLY_ITEM_INACTIVE',
        `Sản phẩm ${supplyItem ? supplyItem.name : 'đã chọn'} đã ngừng bán`
      );
    }

    // Kiểm tra xem sản phẩm đã có sẵn trong loại phòng của sinh viên chưa
    if (
      studentRoomTypeId &&
      supplyItem.includedInRoomTypes &&
      supplyItem.includedInRoomTypes.some(
        (rtId) => rtId.toString() === studentRoomTypeId
      )
    ) {
      throw new ApiError(
        422,
        'SUPPLY_ALREADY_INCLUDED',
        `Sản phẩm ${supplyItem.name} đã được cấp sẵn trong phòng của bạn`
      );
    }

    const itemAmount = supplyItem.price * item.quantity;
    totalAmount += itemAmount;

    orderItems.push({
      supplyItemId: supplyItem._id,
      name: supplyItem.name,
      unit: supplyItem.unit,
      price: supplyItem.price,
      quantity: item.quantity,
      amount: itemAmount,
    });
  }

  // 3. Tra cứu FeeType loại 'supplies'
  const suppliesFeeType = await FeeType.findOne({ code: 'supplies' });

  // 4. Sinh hóa đơn supplies
  const orderDate = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const billingPeriod = `${orderDate.getFullYear()}-${pad(orderDate.getMonth() + 1)}`;
  const dueDate = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate() + 3, 23, 59, 59, 999);

  const invoice = await Invoice.create({
    invoiceCode: generateInvoiceCode(),
    studentId,
    contractId: contract._id,
    billingPeriod,
    type: 'supplies',
    lineItems: orderItems.map((oi) => ({
      feeTypeId: suppliesFeeType?._id || null,
      description: `${oi.name} (${oi.unit})`,
      quantity: oi.quantity,
      unitPrice: oi.price,
      amount: oi.amount,
    })),
    totalAmount,
    paidAmount: 0,
    remainingAmount: totalAmount,
    dueDate,
    status: 'unpaid',
  });

  // 5. Tạo đơn đặt hàng ở trạng thái pending_payment
  const order = await SupplyOrder.create({
    orderCode: generateOrderCode(),
    studentId,
    contractId: contract._id,
    invoiceId: invoice._id,
    items: orderItems,
    totalAmount,
    status: 'pending_payment',
  });

  return {
    id: order._id,
    orderCode: order.orderCode,
    status: order.status,
    totalAmount: order.totalAmount,
    invoice: {
      id: invoice._id,
      invoiceCode: invoice.invoiceCode,
      type: invoice.type,
      totalAmount: invoice.totalAmount,
      dueDate: invoice.dueDate,
    },
  };
};

/**
 * Sinh viên tự hủy đơn hàng nhu yếu phẩm khi còn pending_payment (API.md §10 PATCH /api/portal/my-supply-orders/:id/cancel).
 */
const cancelStudentSupplyOrder = async (orderId, studentId) => {
  const order = await SupplyOrder.findOne({ _id: orderId, studentId });
  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng của bạn');
  }

  if (order.status !== 'pending_payment') {
    throw new ApiError(422, 'ORDER_NOT_CANCELLABLE', 'Đơn hàng đã thanh toán, không thể hủy');
  }

  order.status = 'cancelled';
  order.cancelReason = 'Sinh viên tự hủy trên cổng thông tin';
  await order.save();

  // Hủy hóa đơn
  await Invoice.findByIdAndUpdate(order.invoiceId, { status: 'cancelled' });

  return order;
};

/**
 * Lấy danh sách đơn hàng của sinh viên (Portal).
 */
const getStudentSupplyOrders = async (studentId, query = {}) => {
  const filter = { studentId };
  if (query.status) filter.status = query.status;

  return await SupplyOrder.find(filter)
    .populate('invoiceId', 'invoiceCode totalAmount paidAmount status dueDate')
    .sort('-createdAt');
};

module.exports = {
  getSupplyItems,
  createSupplyItem,
  updateSupplyItem,
  getSupplyOrders,
  getSupplyOrderById,
  deliverSupplyOrder,
  cancelSupplyOrder,
  placeSupplyOrder,
  cancelStudentSupplyOrder,
  getStudentSupplyOrders,
};

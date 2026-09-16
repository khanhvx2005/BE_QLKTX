/**
 * Service xử lý logic nghiệp vụ cho Module Supplies (Nhu yếu phẩm).
 * Tuân thủ theo API.md §11 (v1.2.14, v1.2.17), 03-PHAN-TICH-NGHIEP-VU.md BR-90 → BR-97 và DATA-SCHEMA.md §3.15–3.16.
 */

const mongoose = require('mongoose');
const SupplyItem = require('./supply-item.model');
const SupplyOrder = require('./supply-order.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const FeeType = require('../fees/fee-type.model');
const Student = require('../students/student.model');
const Room = require('../rooms/room.model');
const ApiError = require('../../core/errors/api-error');
const { generateOrderCode, generateInvoiceCode } = require('../../core/utils/code-generator');

/**
 * Lấy danh mục vật phẩm nhu yếu phẩm (API.md §11 v1.2.14).
 * Kèm includedRoomTypeNames để frontend hiển thị tag loại phòng cấp sẵn.
 */
const getSupplyItems = async (query = {}) => {
  const filter = {};
  if (query.category) filter.category = query.category;
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === true || query.isActive === 'true';
  }
  if (query.search && query.search.trim()) {
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

  const formattedItems = items.map((item) => {
    const includedRoomTypeNames = (item.includedInRoomTypes || []).map((rt) => rt.name || '');
    return {
      id: item._id.toString(),
      name: item.name,
      category: item.category,
      unit: item.unit,
      price: item.price,
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      includedInRoomTypes: (item.includedInRoomTypes || []).map((rt) => rt._id.toString()),
      includedRoomTypeNames,
      isActive: item.isActive,
      createdAt: item.createdAt,
    };
  });

  return { items: formattedItems, total, page, limit };
};

/**
 * Tạo mới vật phẩm nhu yếu phẩm (Admin, Staff).
 */
const createSupplyItem = async (data) => {
  const item = await SupplyItem.create(data);
  return item;
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
 * Lấy danh sách đơn đặt hàng nhu yếu phẩm cho cán bộ (API.md §11 v1.2.14 - SCR-71).
 * Bổ sung thống kê summary đủ 6 số đếm: { all, pendingPayment, ready, delivered, cancelled, deliveredToday }.
 * Trả dữ liệu phẳng: studentName, studentCode, roomCode, buildingName, deliveredByName...
 */
const getSupplyOrders = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;

  let allOrders = await SupplyOrder.find(filter)
    .populate('studentId', 'studentCode fullName phone className')
    .populate({
      path: 'contractId',
      populate: {
        path: 'bedId',
        populate: {
          path: 'roomId',
          populate: { path: 'buildingId' },
        },
      },
    })
    .populate('deliveredBy', 'fullName email')
    .sort({ createdAt: -1 });

  // Lọc theo search (orderCode, studentCode, studentName, roomNumber)
  if (query.search && query.search.trim()) {
    const s = query.search.trim().toLowerCase();
    allOrders = allOrders.filter((order) => {
      const oCode = (order.orderCode || '').toLowerCase();
      const sCode = (order.studentId?.studentCode || '').toLowerCase();
      const sName = (order.studentId?.fullName || '').toLowerCase();
      const roomNum = (order.contractId?.bedId?.roomId?.roomNumber || '').toLowerCase();
      const bed = (order.contractId?.bedId?.bedCode || '').toLowerCase();
      return oCode.includes(s) || sCode.includes(s) || sName.includes(s) || roomNum.includes(s) || bed.includes(s);
    });
  }

  // Lọc theo from / to
  if (query.from) {
    const fromDate = new Date(query.from);
    allOrders = allOrders.filter((o) => new Date(o.createdAt) >= fromDate);
  }
  if (query.to) {
    const toDate = new Date(query.to);
    toDate.setHours(23, 59, 59, 999);
    allOrders = allOrders.filter((o) => new Date(o.createdAt) <= toDate);
  }

  // Tính summary đủ 6 trạng thái
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Tra cứu toàn bộ bảng để có summary chính xác
  const [allCount, pendingPaymentCount, readyCount, deliveredCount, cancelledCount, deliveredTodayCount] =
    await Promise.all([
      SupplyOrder.countDocuments({}),
      SupplyOrder.countDocuments({ status: 'pending_payment' }),
      SupplyOrder.countDocuments({ status: 'ready' }),
      SupplyOrder.countDocuments({ status: 'delivered' }),
      SupplyOrder.countDocuments({ status: 'cancelled' }),
      SupplyOrder.countDocuments({
        status: 'delivered',
        deliveredAt: { $gte: todayStart, $lte: todayEnd },
      }),
    ]);

  const total = allOrders.length;
  const paginated = allOrders.slice(skip, skip + limit);

  const items = paginated.map((order) => {
    const contract = order.contractId;
    const bed = contract?.bedId;
    const room = bed?.roomId;
    const building = room?.buildingId;

    const roomCode = room?.roomNumber || (bed?.bedCode ? bed.bedCode.split('-')[0] : '');

    return {
      id: order._id.toString(),
      orderCode: order.orderCode,
      studentName: order.studentId?.fullName || '',
      studentCode: order.studentId?.studentCode || '',
      roomCode,
      buildingName: building?.name || '',
      items: (order.items || []).map((i) => ({
        supplyItemId: i.supplyItemId?.toString(),
        name: i.name,
        unitPrice: i.price,
        quantity: i.quantity,
        amount: i.amount,
      })),
      totalAmount: order.totalAmount,
      invoiceId: order.invoiceId?.toString() || null,
      status: order.status,
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt || null,
      deliveredByName: order.deliveredBy?.fullName || null,
      cancelledAt: order.cancelledAt || null,
      cancelReason: order.cancelReason || null,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    summary: {
      all: allCount,
      pendingPayment: pendingPaymentCount,
      ready: readyCount,
      delivered: deliveredCount,
      cancelled: cancelledCount,
      deliveredToday: deliveredTodayCount,
    },
  };
};

/**
 * Chi tiết đơn hàng nhu yếu phẩm (API.md §11 v1.2.14).
 * Bổ sung invoice: { id, invoiceCode, remainingAmount, dueDate }.
 */
const getSupplyOrderById = async (id) => {
  const order = await SupplyOrder.findById(id)
    .populate('studentId', 'studentCode fullName phone className email')
    .populate({
      path: 'contractId',
      populate: {
        path: 'bedId',
        populate: {
          path: 'roomId',
          populate: { path: 'buildingId' },
        },
      },
    })
    .populate('invoiceId')
    .populate('deliveredBy', 'fullName email')
    .populate('items.supplyItemId', 'name unit price imageUrl category');

  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng nhu yếu phẩm');
  }

  const invoice = order.invoiceId;
  const contract = order.contractId;
  const bed = contract?.bedId;
  const room = bed?.roomId;
  const building = room?.buildingId;

  return {
    id: order._id.toString(),
    orderCode: order.orderCode,
    studentName: order.studentId?.fullName || '',
    studentCode: order.studentId?.studentCode || '',
    roomCode: room?.roomNumber || '',
    buildingName: building?.name || '',
    items: (order.items || []).map((i) => ({
      supplyItemId: i.supplyItemId?._id ? i.supplyItemId._id.toString() : (i.supplyItemId?.toString() || ''),
      name: i.name,
      unitPrice: i.price,
      quantity: i.quantity,
      amount: i.amount,
      imageUrl: i.supplyItemId?.imageUrl || '',
      unit: i.unit,
    })),
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt || null,
    deliveredByName: order.deliveredBy?.fullName || null,
    cancelledAt: order.cancelledAt || null,
    cancelReason: order.cancelReason || null,
    invoice: invoice
      ? {
          id: invoice._id.toString(),
          invoiceCode: invoice.invoiceCode,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount || 0,
          remainingAmount: Math.max(0, invoice.totalAmount - (invoice.paidAmount || 0)),
          dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
          status: invoice.status,
        }
      : null,
  };
};

/**
 * Bàn giao nhu yếu phẩm cho sinh viên (ready → delivered) (API.md §11 v1.2.14).
 * Lưu người bàn giao và trả về deliveredByName.
 */
const deliverSupplyOrder = async (id, actorId) => {
  const order = await SupplyOrder.findById(id);
  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng nhu yếu phẩm');
  }

  if (order.status !== 'ready') {
    throw new ApiError(422, 'INVALID_ORDER_STATUS', 'Chỉ giao được đơn đang chờ nhận hàng');
  }

  const User = mongoose.models.User || require('../auth/user.model');
  const actor = actorId ? await User.findById(actorId).select('fullName') : null;

  order.status = 'delivered';
  order.deliveredAt = new Date();
  order.deliveredBy = actorId;
  await order.save();

  return {
    id: order._id.toString(),
    orderCode: order.orderCode,
    status: order.status,
    deliveredAt: order.deliveredAt,
    deliveredByName: actor?.fullName || 'Ban quản lý',
  };
};

/**
 * Hủy đơn hàng nhu yếu phẩm (pending_payment → cancelled) do Admin/Nhân viên thực hiện (API.md §11 v1.2.14).
 * Yêu cầu lý do hủy >= 5 ký tự và hủy luôn hóa đơn liên kết.
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
  order.cancelledAt = new Date();
  await order.save();

  // Hủy kèm hóa đơn supplies tương ứng
  await Invoice.findByIdAndUpdate(order.invoiceId, { status: 'cancelled' });

  return order;
};

/**
 * Sinh viên đặt mua nhu yếu phẩm từ Cổng sinh viên (API.md §10 v1.2.17 - SCR-67, SCR-68).
 */
const placeSupplyOrder = async (studentId, requestedItems) => {
  const contract = await Contract.findOne({ studentId, status: 'active' }).populate({
    path: 'bedId',
    populate: { path: 'roomId' },
  });
  if (!contract) {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Bạn chưa có hợp đồng đang hiệu lực');
  }

  const studentRoomTypeId = contract.bedId?.roomId?.roomTypeId?.toString();

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

  const suppliesFeeType = await FeeType.findOne({ code: 'supplies' });

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
    id: order._id.toString(),
    orderCode: order.orderCode,
    status: order.status,
    totalAmount: order.totalAmount,
    invoice: {
      id: invoice._id.toString(),
      invoiceCode: invoice.invoiceCode,
      type: invoice.type,
      totalAmount: invoice.totalAmount,
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
    },
  };
};

/**
 * Sinh viên tự hủy đơn hàng nhu yếu phẩm khi còn pending_payment (API.md §10 v1.2.17).
 * Không cần body lý do, hủy luôn cả hóa đơn đi kèm.
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
  order.cancelReason = 'Sinh viên tự hủy đơn hàng';
  order.cancelledAt = new Date();
  await order.save();

  // Hủy hóa đơn liên kết
  await Invoice.findByIdAndUpdate(order.invoiceId, { status: 'cancelled' });

  return {
    id: order._id.toString(),
    orderCode: order.orderCode,
    status: order.status,
    message: 'Đã hủy đơn hàng thành công',
  };
};

/**
 * Lấy danh sách đơn hàng nhu yếu phẩm của sinh viên (Cổng sinh viên)
 */
const getStudentSupplyOrders = async (studentId, query = {}) => {
  const filter = { studentId };
  if (query.status) filter.status = query.status;

  const orders = await SupplyOrder.find(filter).sort({ createdAt: -1 });

  return orders.map((o) => ({
    id: o._id.toString(),
    orderCode: o.orderCode,
    status: o.status,
    totalAmount: o.totalAmount,
    invoiceId: o.invoiceId?.toString() || null,
    items: (o.items || []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.price,
      amount: i.amount,
      unit: i.unit,
    })),
    cancelReason: o.cancelReason || null,
    createdAt: o.createdAt,
    deliveredAt: o.deliveredAt || null,
  }));
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

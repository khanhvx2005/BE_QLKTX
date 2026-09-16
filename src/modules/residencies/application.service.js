/**
 * Service xử lý nghiệp vụ cho Đơn đăng ký thuê phòng (Applications).
 * Tuân thủ theo API.md §5.1, §10 và 03-PHAN-TICH-NGHIEP-VU.md BR-33 -> BR-38.
 */

const Application = require('./application.model');
const Residency = require('./residency.model');
const Student = require('../students/student.model');
const Room = require('../rooms/room.model');
const RoomType = require('../rooms/room-type.model');
const Bed = require('../rooms/bed.model');
const Building = require('../rooms/building.model');
const Contract = require('../contracts/contract.model');
const Invoice = require('../fees/invoice.model');
const FeeType = require('../fees/fee-type.model');
const ApiError = require('../../core/errors/api-error');
const {
  generateApplicationCode,
  generateContractCode,
  generateInvoiceCode,
} = require('../../core/utils/code-generator');

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
 * Lấy danh sách hàng đợi đơn đăng ký (admin, staff, viewer)
 */
const getApplications = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.roomTypeId) filter.roomTypeId = query.roomTypeId;

  // Xử lý sort theo quy tắc: pending cũ nhất lên đầu; đã xử lý gần nhất lên đầu
  const sort = query.status === 'pending'
    ? { createdAt: 1 }
    : { reviewedAt: -1, createdAt: -1 };

  // Đếm thống kê summary độc lập với filter.status
  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    Application.countDocuments({ status: 'pending' }),
    Application.countDocuments({ status: 'approved' }),
    Application.countDocuments({ status: 'rejected' }),
  ]);

  let applications = await Application.find(filter)
    .populate('studentId', 'studentCode fullName gender className phone')
    .populate('roomTypeId', 'name tier capacity pricePerMonth depositAmount')
    .populate({
      path: 'roomId',
      select: 'roomNumber floor buildingId',
      populate: { path: 'buildingId', select: 'name code' },
    })
    .populate({
      path: 'assignedRoomId',
      select: 'roomNumber buildingId',
      populate: { path: 'buildingId', select: 'name code' },
    })
    .populate('assignedBedId', 'bedCode')
    .populate('contractId', 'contractCode')
    .sort(sort);

  // Lọc theo search (mã đơn, mã sinh viên, tên sinh viên, số phòng)
  if (query.search) {
    const s = query.search.trim().toLowerCase();
    applications = applications.filter((app) => {
      const appCode = app.applicationCode?.toLowerCase() || '';
      const stuCode = app.studentId?.studentCode?.toLowerCase() || '';
      const stuName = app.studentId?.fullName?.toLowerCase() || '';
      const roomNum = app.roomId?.roomNumber?.toLowerCase() || '';
      return appCode.includes(s) || stuCode.includes(s) || stuName.includes(s) || roomNum.includes(s);
    });
  }

  const total = applications.length;
  const paginated = applications.slice(skip, skip + limit);

  const items = await Promise.all(
    paginated.map(async (app) => {
      const studentDebt = app.studentId ? await calculateStudentDebt(app.studentId._id) : 0;
      const room = app.roomId;
      const roomType = app.roomTypeId;

      let availableSlots = 0;
      if (room) {
        availableSlots = await Bed.countDocuments({ roomId: room._id, status: 'available' });
      }

      const assigned = app.assignedRoomId && app.assignedBedId ? {
        roomId: app.assignedRoomId._id.toString(),
        roomNumber: app.assignedRoomId.roomNumber,
        buildingName: app.assignedRoomId.buildingId?.name || '',
        buildingCode: app.assignedRoomId.buildingId?.code || '',
        bedCode: app.assignedBedId.bedCode,
      } : null;

      return {
        id: app._id.toString(),
        applicationCode: app.applicationCode,
        status: app.status,
        createdAt: app.createdAt,
        note: app.note,
        student: app.studentId ? {
          id: app.studentId._id.toString(),
          studentCode: app.studentId.studentCode,
          fullName: app.studentId.fullName,
          gender: app.studentId.gender,
          className: app.studentId.className,
          phone: app.studentId.phone,
          totalDebt: studentDebt,
        } : null,
        roomType: roomType ? {
          id: roomType._id.toString(),
          name: roomType.name,
          tier: roomType.tier,
          capacity: roomType.capacity,
          pricePerMonth: roomType.pricePerMonth,
          depositAmount: roomType.depositAmount,
        } : null,
        requestedRoom: room ? {
          id: room._id.toString(),
          roomNumber: room.roomNumber,
          buildingName: room.buildingId?.name || '',
          buildingCode: room.buildingId?.code || '',
          floor: room.floor,
          availableSlots,
        } : null,
        startDate: app.startDate,
        endDate: app.endDate,
        estimatedInvoices: roomType ? {
          deposit: roomType.depositAmount,
          firstMonth: roomType.pricePerMonth,
          total: roomType.depositAmount + roomType.pricePerMonth,
        } : null,
        reviewedAt: app.reviewedAt,
        reviewNote: app.reviewNote,
        assigned,
        contractCode: app.contractId?.contractCode || null,
      };
    })
  );

  return {
    items,
    total,
    page,
    limit,
    summary: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  };
};

/**
 * Lấy chi tiết một đơn đăng ký kèm danh sách giường của phòng
 */
const getApplicationById = async (id) => {
  const app = await Application.findById(id)
    .populate('studentId')
    .populate('roomTypeId')
    .populate({
      path: 'roomId',
      populate: { path: 'buildingId' },
    })
    .populate({
      path: 'assignedRoomId',
      populate: { path: 'buildingId' },
    })
    .populate('assignedBedId')
    .populate('contractId');

  if (!app) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn đăng ký');
  }

  const studentDebt = app.studentId ? await calculateStudentDebt(app.studentId._id) : 0;
  const room = app.roomId;
  const roomType = app.roomTypeId;

  let beds = [];
  let availableSlots = 0;
  if (room) {
    const bedDocs = await Bed.find({ roomId: room._id }).sort('bedNumber');
    availableSlots = bedDocs.filter((b) => b.status === 'available').length;

    beds = await Promise.all(
      bedDocs.map(async (b) => {
        let occupantName = null;
        if (b.status === 'occupied') {
          const res = await Residency.findOne({ bedId: b._id, status: 'active' }).populate(
            'studentId',
            'fullName'
          );
          if (res?.studentId) occupantName = res.studentId.fullName;
        }
        return {
          bedNumber: b.bedNumber,
          bedCode: b.bedCode,
          status: b.status,
          occupantName,
        };
      })
    );
  }

  const assigned = app.assignedRoomId && app.assignedBedId ? {
    roomId: app.assignedRoomId._id.toString(),
    roomNumber: app.assignedRoomId.roomNumber,
    buildingName: app.assignedRoomId.buildingId?.name || '',
    buildingCode: app.assignedRoomId.buildingId?.code || '',
    bedCode: app.assignedBedId.bedCode,
  } : null;

  return {
    id: app._id.toString(),
    applicationCode: app.applicationCode,
    status: app.status,
    createdAt: app.createdAt,
    note: app.note,
    student: app.studentId ? {
      id: app.studentId._id.toString(),
      studentCode: app.studentId.studentCode,
      fullName: app.studentId.fullName,
      gender: app.studentId.gender,
      className: app.studentId.className,
      phone: app.studentId.phone,
      totalDebt: studentDebt,
    } : null,
    roomType: roomType ? {
      id: roomType._id.toString(),
      name: roomType.name,
      tier: roomType.tier,
      capacity: roomType.capacity,
      pricePerMonth: roomType.pricePerMonth,
      depositAmount: roomType.depositAmount,
    } : null,
    requestedRoom: room ? {
      id: room._id.toString(),
      roomNumber: room.roomNumber,
      buildingName: room.buildingId?.name || '',
      buildingCode: room.buildingId?.code || '',
      floor: room.floor,
      availableSlots,
      beds,
    } : null,
    startDate: app.startDate,
    endDate: app.endDate,
    estimatedInvoices: roomType ? {
      deposit: roomType.depositAmount,
      firstMonth: roomType.pricePerMonth,
      total: roomType.depositAmount + roomType.pricePerMonth,
    } : null,
    reviewedAt: app.reviewedAt,
    reviewNote: app.reviewNote,
    assigned,
    contractCode: app.contractId?.contractCode || null,
  };
};

/**
 * Nộp đơn đăng ký (Cán bộ lập hộ hoặc Sinh viên tự nộp qua Cổng SV)
 */
const createApplication = async ({ studentId, roomId, startDate, endDate, note }) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  // BR-33: Sinh viên đã có hợp đồng active không được nộp đơn mới
  const activeContract = await Contract.findOne({ studentId, status: 'active' });
  if (activeContract) {
    throw new ApiError(
      422,
      'STUDENT_HAS_ACTIVE_CONTRACT',
      'Sinh viên đã có hợp đồng đang hiệu lực'
    );
  }

  // BR-34: Sinh viên chỉ được có tối đa 1 đơn pending
  const existingPending = await Application.findOne({ studentId, status: 'pending' });
  if (existingPending) {
    throw new ApiError(
      409,
      'DUPLICATE_PENDING_APPLICATION',
      'Sinh viên đã có một đơn đăng ký đang chờ duyệt'
    );
  }

  const room = await Room.findById(roomId).populate('roomTypeId buildingId');
  if (!room || room.status !== 'active') {
    throw new ApiError(404, 'NOT_FOUND', 'Phòng không tồn tại hoặc không ở trạng thái hoạt động');
  }

  // PRD §2.9 A1: Kiểm tra giới tính phòng và sinh viên (GENDER_MISMATCH, 422)
  if (room.gender !== student.gender) {
    const msg = room.gender === 'female'
      ? 'Phòng này chỉ dành cho sinh viên nữ'
      : 'Phòng này chỉ dành cho sinh viên nam';
    throw new ApiError(422, 'GENDER_MISMATCH', msg);
  }

  // Kiểm tra phòng còn slot trống
  const availableBedsCount = await Bed.countDocuments({ roomId: room._id, status: 'available' });
  if (availableBedsCount === 0) {
    throw new ApiError(409, 'ROOM_FULL', `Phòng ${room.roomNumber} vừa hết chỗ. Vui lòng chọn phòng khác cùng loại`);
  }

  const applicationCode = generateApplicationCode();

  // Đảm bảo lấy được roomType đầy đủ ngay cả khi room cũ chưa gắn roomTypeId
  let roomType = room.roomTypeId && room.roomTypeId._id ? room.roomTypeId : null;
  if (!roomType && room.roomTypeId) {
    roomType = await RoomType.findById(room.roomTypeId);
  }
  if (!roomType) {
    // Fallback nếu phòng cũ chưa gắn loại phòng: lấy loại tiêu chuẩn mặc định
    roomType = await RoomType.findOne({ tier: 'standard' }) || {
      _id: new mongoose.Types.ObjectId(),
      depositAmount: 500000,
      pricePerMonth: 320000,
    };
  }

  const application = await Application.create({
    applicationCode,
    studentId,
    roomTypeId: roomType._id,
    roomId: room._id,
    startDate,
    endDate,
    status: 'pending',
    note: note || '',
  });

  return {
    id: application._id.toString(),
    applicationCode: application.applicationCode,
    status: application.status,
    estimatedInvoices: {
      deposit: roomType.depositAmount || 500000,
      firstMonth: roomType.pricePerMonth || 320000,
      total: (roomType.depositAmount || 500000) + (roomType.pricePerMonth || 320000),
    },
  };
};

/**
 * Duyệt đơn đăng ký và tự động gán giường (BR-36, BR-25, BR-26, API.md §5.1)
 */
const approveApplication = async (applicationId, { roomId } = {}, reviewerUserId) => {
  const application = await Application.findById(applicationId);
  if (!application) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn đăng ký');
  }

  if (application.status !== 'pending') {
    throw new ApiError(422, 'APPLICATION_NOT_PENDING', 'Đơn đăng ký đã được xử lý');
  }

  const student = await Student.findById(application.studentId);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  const activeContract = await Contract.findOne({ studentId: student._id, status: 'active' });
  if (activeContract) {
    throw new ApiError(422, 'STUDENT_HAS_ACTIVE_CONTRACT', 'Sinh viên đã có hợp đồng đang hiệu lực');
  }

  // Xác định phòng được xếp (mặc định là phòng sinh viên chọn, hoặc phòng nhân viên chỉ định)
  const targetRoomId = roomId || application.roomId;
  const targetRoom = await Room.findById(targetRoomId).populate('roomTypeId buildingId');

  if (!targetRoom || targetRoom.status !== 'active') {
    throw new ApiError(404, 'NOT_FOUND', 'Phòng không tồn tại hoặc đã ngừng hoạt động');
  }

  // Xác định loại phòng của targetRoom
  let roomType = targetRoom.roomTypeId && targetRoom.roomTypeId._id ? targetRoom.roomTypeId : null;
  if (!roomType && targetRoom.roomTypeId) {
    roomType = await RoomType.findById(targetRoom.roomTypeId);
  }
  if (!roomType) {
    roomType = await RoomType.findOne({ tier: 'standard' }) || {
      _id: new mongoose.Types.ObjectId(),
      depositAmount: 500000,
      pricePerMonth: 320000,
      name: 'Tiêu chuẩn',
    };
  }

  // BR-36: Nếu đổi phòng, bắt buộc phải cùng loại phòng với đơn
  const targetRoomTypeId = roomType._id.toString();
  const appRoomTypeId = application.roomTypeId?._id ? application.roomTypeId._id.toString() : application.roomTypeId?.toString();
  if (appRoomTypeId && targetRoomTypeId !== appRoomTypeId) {
    throw new ApiError(422, 'ROOM_TYPE_MISMATCH', 'Chỉ được đổi sang phòng cùng loại với đơn đăng ký');
  }

  // Kiểm tra lại giới tính phòng
  if (targetRoom.gender !== student.gender) {
    const msg = targetRoom.gender === 'female'
      ? 'Phòng này chỉ dành cho sinh viên nữ'
      : 'Phòng này chỉ dành cho sinh viên nam';
    throw new ApiError(422, 'GENDER_MISMATCH', msg);
  }

  // Gán giường nguyên tử (Atomic conditional update - ARCHITECTURE.md §3.5)
  // Lấy giường số nhỏ nhất đang available
  const assignedBed = await Bed.findOneAndUpdate(
    { roomId: targetRoom._id, status: 'available' },
    { status: 'occupied' },
    { sort: { bedNumber: 1 }, new: true }
  );

  if (!assignedBed) {
    throw new ApiError(
      409,
      'ROOM_FULL',
      `Phòng ${targetRoom.roomNumber} vừa hết chỗ. Vui lòng chọn phòng khác cùng loại`
    );
  }

  // Đảm bảo giường luôn có bedCode
  if (!assignedBed.bedCode) {
    assignedBed.bedCode = `${targetRoom.roomNumber}-${String(assignedBed.bedNumber || 1).padStart(2, '0')}`;
    await assignedBed.save();
  }

  let residency = null;
  let contract = null;
  let invoices = [];

  try {
    // 1. Tạo bản ghi lưu trú Residency
    residency = await Residency.create({
      studentId: student._id,
      bedId: assignedBed._id,
      startDate: application.startDate,
      endDate: application.endDate,
      status: 'active',
      createdBy: reviewerUserId,
    });

    // 2. Tạo Hợp đồng Contract (active ngay, giá đóng băng từ RoomType)
    const contractCode = generateContractCode();

    contract = await Contract.create({
      contractCode,
      residencyId: residency._id,
      studentId: student._id,
      bedId: assignedBed._id,
      startDate: application.startDate,
      endDate: application.endDate,
      monthlyPrice: roomType.pricePerMonth,
      depositAmount: roomType.depositAmount,
      depositRefunded: 0,
      status: 'active',
      terms: `Hợp đồng thuê chỗ ở KTX phòng ${targetRoom.roomNumber}, giường ${assignedBed.bedCode}`,
    });

    // 3. Tính hạn nộp: max(startDate, ngày duyệt) + 7 ngày (BR-26)
    const now = new Date();
    const appStart = new Date(application.startDate);
    const baseDate = appStart > now ? appStart : now;
    const dueDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 4. Lấy FeeType cho cọc và tiền phòng (nếu có)
    const depositFeeType = await FeeType.findOne({ code: 'deposit' });
    const rentFeeType = await FeeType.findOne({ code: 'rent' });

    // 5. Tạo 2 hóa đơn riêng biệt (BR-25, DATA-SCHEMA §3.10)
    // Hóa đơn 1: Tiền cọc
    const depositInvoice = await Invoice.create({
      invoiceCode: generateInvoiceCode(now),
      studentId: student._id,
      contractId: contract._id,
      type: 'deposit',
      billingPeriod: null,
      lineItems: [
        {
          feeTypeId: depositFeeType?._id || null,
          description: 'Tiền đặt cọc chỗ ở',
          quantity: 1,
          unitPrice: roomType.depositAmount,
          amount: roomType.depositAmount,
        },
      ],
      totalAmount: roomType.depositAmount,
      paidAmount: 0,
      dueDate,
      status: 'unpaid',
      createdBy: reviewerUserId,
    });

    // Hóa đơn 2: Tiền phòng tháng đầu
    const firstPeriod = `${appStart.getFullYear()}-${String(appStart.getMonth() + 1).padStart(2, '0')}`;
    const rentInvoice = await Invoice.create({
      invoiceCode: generateInvoiceCode(now),
      studentId: student._id,
      contractId: contract._id,
      type: 'monthly',
      billingPeriod: firstPeriod,
      lineItems: [
        {
          feeTypeId: rentFeeType?._id || null,
          description: `Tiền phòng tháng đầu (${firstPeriod})`,
          quantity: 1,
          unitPrice: roomType.pricePerMonth,
          amount: roomType.pricePerMonth,
        },
      ],
      totalAmount: roomType.pricePerMonth,
      paidAmount: 0,
      dueDate,
      status: 'unpaid',
      createdBy: reviewerUserId,
    });

    invoices = [depositInvoice, rentInvoice];

    // 6. Cập nhật đơn đăng ký sang approved
    application.status = 'approved';
    application.reviewedBy = reviewerUserId;
    application.reviewedAt = now;
    application.assignedRoomId = targetRoom._id;
    application.assignedBedId = assignedBed._id;
    application.contractId = contract._id;
    await application.save();
  } catch (err) {
    // Rollback giường nếu phát sinh lỗi giữa chừng
    await Bed.findByIdAndUpdate(assignedBed._id, { status: 'available' });
    if (residency) await Residency.findByIdAndDelete(residency._id);
    if (contract) await Contract.findByIdAndDelete(contract._id);
    for (const inv of invoices) {
      await Invoice.findByIdAndDelete(inv._id);
    }
    throw err;
  }

  const building = targetRoom.buildingId;

  return {
    application: {
      id: application._id.toString(),
      status: 'approved',
    },
    assigned: {
      roomNumber: targetRoom.roomNumber,
      buildingName: building?.name || '',
      buildingCode: building?.code || '',
      bedCode: assignedBed.bedCode,
    },
    contract: {
      id: contract._id.toString(),
      contractCode: contract.contractCode,
      status: contract.status,
      monthlyPrice: contract.monthlyPrice,
      depositAmount: contract.depositAmount,
      bedCode: assignedBed.bedCode,
    },
    invoices: invoices.map((inv) => ({
      id: inv._id.toString(),
      invoiceCode: inv.invoiceCode,
      type: inv.type,
      billingPeriod: inv.billingPeriod,
      totalAmount: inv.totalAmount,
      dueDate: inv.dueDate.toISOString().slice(0, 10),
    })),
  };
};

/**
 * Từ chối đơn đăng ký (yêu cầu reviewNote >= 10 ký tự)
 */
const rejectApplication = async (applicationId, { reviewNote }, reviewerUserId) => {
  const application = await Application.findById(applicationId);
  if (!application) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn đăng ký');
  }

  if (application.status !== 'pending') {
    throw new ApiError(422, 'APPLICATION_NOT_PENDING', 'Đơn đăng ký đã được xử lý');
  }

  application.status = 'rejected';
  application.reviewNote = reviewNote;
  application.reviewedBy = reviewerUserId;
  application.reviewedAt = new Date();
  await application.save();

  return {
    id: application._id.toString(),
    status: 'rejected',
    reviewNote: application.reviewNote,
    reviewedAt: application.reviewedAt,
  };
};

/**
 * Sinh viên hủy đơn đăng ký của chính mình (chỉ khi còn pending)
 */
const cancelApplication = async (applicationId, studentId) => {
  const application = await Application.findOne({ _id: applicationId, studentId });
  if (!application) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn đăng ký');
  }

  if (application.status !== 'pending') {
    throw new ApiError(
      422,
      'APPLICATION_NOT_PENDING',
      'Đơn đăng ký đã được xử lý, không thể hủy'
    );
  }

  application.status = 'cancelled';
  await application.save();

  return { message: 'Đã hủy đơn đăng ký thành công' };
};

/**
 * Lấy danh sách đơn đăng ký của sinh viên (cho cổng sinh viên)
 */
const getMyApplications = async (studentId) => {
  const applications = await Application.find({ studentId })
    .populate('roomTypeId', 'name tier capacity pricePerMonth depositAmount')
    .populate({
      path: 'roomId',
      populate: { path: 'buildingId', select: 'name code' },
    })
    .populate({
      path: 'assignedRoomId',
      populate: { path: 'buildingId', select: 'name code' },
    })
    .populate('assignedBedId', 'bedCode')
    .populate('contractId', 'contractCode')
    .sort({ createdAt: -1 });

  return applications.map((app) => {
    const room = app.roomId;
    const roomType = app.roomTypeId;

    const assigned = app.assignedRoomId && app.assignedBedId ? {
      roomId: app.assignedRoomId._id.toString(),
      roomNumber: app.assignedRoomId.roomNumber,
      buildingName: app.assignedRoomId.buildingId?.name || '',
      buildingCode: app.assignedRoomId.buildingId?.code || '',
      bedCode: app.assignedBedId.bedCode,
    } : null;

    return {
      id: app._id.toString(),
      applicationCode: app.applicationCode,
      status: app.status,
      createdAt: app.createdAt,
      note: app.note,
      roomType: roomType ? {
        id: roomType._id.toString(),
        name: roomType.name,
        tier: roomType.tier,
        capacity: roomType.capacity,
        pricePerMonth: roomType.pricePerMonth,
        depositAmount: roomType.depositAmount,
      } : null,
      requestedRoom: room ? {
        id: room._id.toString(),
        roomNumber: room.roomNumber,
        buildingName: room.buildingId?.name || '',
        buildingCode: room.buildingId?.code || '',
        floor: room.floor,
      } : null,
      startDate: app.startDate,
      endDate: app.endDate,
      estimatedInvoices: roomType ? {
        deposit: roomType.depositAmount,
        firstMonth: roomType.pricePerMonth,
        total: roomType.depositAmount + roomType.pricePerMonth,
      } : null,
      reviewedAt: app.reviewedAt,
      reviewNote: app.reviewNote,
      assigned,
      contractCode: app.contractId?.contractCode || null,
    };
  });
};

module.exports = {
  getApplications,
  getApplicationById,
  createApplication,
  approveApplication,
  rejectApplication,
  cancelApplication,
  getMyApplications,
};

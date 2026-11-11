/**
 * Service xử lý nghiệp vụ cho Module Contracts (Hợp đồng & Đăng ký KTX HaUI).
 * 
 * ============================================================================
 * [LUỒNG NGHIỆP VỤ CỐT LÕI - DÀNH CHO TEAM 5]:
 * 1. Nộp đơn Online (FR-30):
 *    - Sinh viên chưa có tài khoản truy cập cổng công khai, chọn phòng theo ngăn xếp, nộp đơn.
 *    - Hệ thống lưu hồ sơ `Student` và tạo `Contract` ở trạng thái 'pending'.
 * 2. Phê duyệt đơn & Khóa giường nguyên tử (FR-32 & BR-05 & BR-06):
 *    - Khóa giường bằng lệnh nguyên tử một bước `findOneAndUpdate` (Chống trùng giường 100%).
 *    - Tự động sinh tài khoản User (TK=MSSV, MK=MSSV, mustChangePassword=true).
 *    - Tự động phát hành 02 hóa đơn: Tiền cọc & Tiền phòng trọn gói kỳ.
 * 3. Trả phòng & Thanh lý Hợp đồng - HOÀN TIỀN CỌC (FR-34 & BR-04):
 *    - Kiểm tra sạch nợ 100% (cả hóa đơn cá nhân lẫn hóa đơn điện nước phòng).
 *    - Hoàn trả tiền cọc cho sinh viên (khấu trừ đền bù tài sản nếu làm hỏng hóc).
 *    - Nhả giường về trạng thái 'available' và cập nhật hợp đồng sang 'terminated'.
 * ============================================================================
 */

const bcrypt = require('bcryptjs');
const Contract = require('./contract.model');
const Room = require('../rooms/room.model');
const Student = require('../students/student.model');
const User = require('../auth/user.model');
const Invoice = require('../fees/invoice.model');
const Payment = require('../payments/payment.model');
const ApiError = require('../../core/errors/api-error');
const { generateContractCode, generateInvoiceCode, generateTransactionRef } = require('../../core/utils/code-generator');
const cache = require('../../core/utils/cache');
const logger = require('../../core/logger/logger');

/**
 * 1. Nộp đơn đăng ký KTX Online công khai (FR-30)
 * Sinh viên chưa có tài khoản có thể nộp đơn trực tiếp
 */
const registerOnline = async (data) => {
  const {
    studentCode,
    fullName,
    gender,
    phone,
    email,
    dob,
    faculty,
    className,
    emergencyContact,
    roomId,
    bedNumber,
    term,
  } = data;

  // 1. Kiểm tra phòng KTX chỉ định
  const room = await Room.findById(roomId).populate('buildingId', 'code name');
  if (!room || room.status !== 'active') {
    throw new ApiError(404, 'NOT_FOUND', 'Phòng KTX được chọn không tồn tại hoặc đang bảo trì');
  }

  // 2. Kiểm tra giới tính phòng (BR-01)
  if (room.gender !== gender) {
    throw new ApiError(
      422,
      'GENDER_MISMATCH',
      `Phòng này dành cho sinh viên ${room.gender === 'male' ? 'Nam' : 'Nữ'}, không phù hợp với giới tính của bạn`
    );
  }

  // 3. Kiểm tra vị trí giường có hợp lệ và còn trống không
  const targetBed = room.beds.find((b) => b.bedNumber === Number(bedNumber));
  if (!targetBed) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Phòng chỉ có tối đa ${room.capacity} giường`);
  }
  if (targetBed.status !== 'available') {
    throw new ApiError(409, 'BED_ALREADY_OCCUPIED', 'Vị trí giường này đã có người đăng ký, vui lòng chọn giường khác');
  }

  // 4. Tìm kiếm hoặc tạo mới hồ sơ sinh viên
  let student = await Student.findOne({ studentCode: studentCode.toUpperCase().trim() });
  if (student) {
    // Nếu sinh viên đã có hợp đồng đang active hoặc đang chờ duyệt (pending)
    const existingContract = await Contract.findOne({
      studentId: student._id,
      status: { $in: ['pending', 'active'] },
    });
    if (existingContract) {
      if (existingContract.status === 'pending') {
        throw new ApiError(409, 'DUPLICATE_PENDING_APPLICATION', 'Bạn đã có một đơn đăng ký KTX đang chờ xét duyệt');
      }
      throw new ApiError(409, 'STUDENT_HAS_ACTIVE_CONTRACT', 'Bạn hiện đang cư trú tại KTX theo một hợp đồng khác');
    }

    // Cập nhật thông tin mới nhất nếu có thay đổi
    student.fullName = fullName;
    student.gender = gender;
    student.phone = phone;
    student.email = email;
    if (faculty) student.faculty = faculty;
    if (className) student.className = className;
    if (dob) student.dob = dob;
    if (emergencyContact) student.emergencyContact = emergencyContact;
    await student.save();
  } else {
    // Tạo mới hồ sơ sinh viên (chưa gán userId)
    student = await Student.create({
      studentCode: studentCode.toUpperCase().trim(),
      fullName,
      gender,
      phone,
      email,
      dob,
      faculty,
      className,
      emergencyContact,
      status: 'active',
    });
  }

  // 5. Tính toán tài chính hợp đồng
  const monthsCount = term === '6_months' ? 6 : 12;
  const pricePerMonth = room.pricePerMonth || 500000;
  const totalRoomFee = pricePerMonth * monthsCount;
  const depositAmount = room.depositAmount || 500000;

  // 6. Tạo hợp đồng ở trạng thái 'pending'
  const contract = await Contract.create({
    contractCode: generateContractCode(),
    studentId: student._id,
    roomId: room._id,
    bedNumber: Number(bedNumber),
    term,
    pricePerMonth,
    totalRoomFee,
    depositAmount,
    depositStatus: 'unpaid',
    status: 'pending',
  });

  return {
    contractCode: contract.contractCode,
    studentCode: student.studentCode,
    fullName: student.fullName,
    building: room.buildingId.name,
    roomNumber: room.roomNumber,
    bedNumber: contract.bedNumber,
    term: contract.term,
    totalRoomFee: contract.totalRoomFee,
    depositAmount: contract.depositAmount,
    status: contract.status,
    message: 'Nộp đơn đăng ký thành công! Vui lòng theo dõi email để nhận thông báo duyệt từ Ban Quản lý KTX.',
  };
};

/**
 * 2. Lấy danh sách hợp đồng / đơn đăng ký (FR-31)
 */
const getContracts = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.buildingId) filter.buildingId = query.buildingId;
  if (query.roomId) filter.roomId = query.roomId;

  // Tìm kiếm theo MSSV hoặc họ tên
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    const matchedStudents = await Student.find({
      $or: [{ studentCode: searchRegex }, { fullName: searchRegex }],
    }).select('_id');
    const studentIds = matchedStudents.map((s) => s._id);
    filter.studentId = { $in: studentIds };
  }

  // Thống kê nhanh số lượng theo trạng thái
  const [totalAll, pendingCount, activeCount, terminatedCount] = await Promise.all([
    Contract.countDocuments({}),
    Contract.countDocuments({ status: 'pending' }),
    Contract.countDocuments({ status: 'active' }),
    Contract.countDocuments({ status: 'terminated' }),
  ]);

  const [total, contracts] = await Promise.all([
    Contract.countDocuments(filter),
    Contract.find(filter)
      .populate('studentId', 'studentCode fullName phone email className faculty')
      .populate({
        path: 'roomId',
        select: 'roomNumber floor capacity gender buildingId',
        populate: { path: 'buildingId', select: 'code name' },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    data: contracts,
    summary: {
      all: totalAll,
      pending: pendingCount,
      active: activeCount,
      terminated: terminatedCount,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * 3. Xem chi tiết hợp đồng
 */
const getContractById = async (id) => {
  const contract = await Contract.findById(id)
    .populate('studentId')
    .populate({
      path: 'roomId',
      populate: { path: 'buildingId', select: 'code name description' },
    })
    .populate('approvedBy', 'fullName email')
    .populate('depositRefundedBy', 'fullName email');

  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng KTX');
  }

  return contract;
};

/**
 * 4. Phê duyệt đơn đăng ký KTX (FR-32 & BR-05 & BR-06)
 * 
 * Luồng xử lý:
 * 1. Khóa giường bằng Atomic Query: `Room.findOneAndUpdate(...)`
 *    -> Nếu trả về null: báo lỗi 409 BED_ALREADY_OCCUPIED (Race condition)
 * 2. Cập nhật hợp đồng sang 'active', tính startDate và endDate (6 hoặc 12 tháng)
 * 3. Tự động sinh tài khoản User (Tên đăng nhập = MSSV, Mật khẩu = MSSV, mustChangePassword = true)
 * 4. Tự động phát hành 02 hóa đơn:
 *    - Hóa đơn cọc (type: 'deposit')
 *    - Hóa đơn tiền phòng cả kỳ (type: 'room_semester')
 * 5. Xóa Cache Redis để đồng bộ số giường trống thời gian thực
 */
const approveContract = async (id, actorId) => {
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn đăng ký');
  }

  if (contract.status !== 'pending') {
    throw new ApiError(422, 'CONTRACT_NOT_PENDING', 'Đơn đăng ký này không ở trạng thái chờ duyệt');
  }

  // 1. Khóa giường nguyên tử (Atomic Query - BR-05)
  const updatedRoom = await Room.findOneAndUpdate(
    {
      _id: contract.roomId,
      'beds.bedNumber': contract.bedNumber,
      'beds.status': 'available', // Đảm bảo giường phải đang trống ở tầng CSDL
    },
    {
      $set: {
        'beds.$.status': 'occupied',
        'beds.$.studentId': contract.studentId,
      },
    },
    { new: true }
  );

  if (!updatedRoom) {
    throw new ApiError(
      409,
      'BED_ALREADY_OCCUPIED',
      'Vị trí giường này vừa được người khác đăng ký hoặc không còn trống!'
    );
  }

  // 2. Tính ngày bắt đầu và kết thúc
  const startDate = new Date();
  const monthsToAdd = contract.term === '6_months' ? 6 : 12;
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + monthsToAdd);

  contract.startDate = startDate;
  contract.endDate = endDate;
  contract.status = 'active';
  contract.approvedBy = actorId;
  contract.approvedAt = new Date();
  await contract.save();

  // 3. Tự động cấp tài khoản sinh viên (FR-02 & BR-06)
  const student = await Student.findById(contract.studentId);
  if (student && !student.userId) {
    const defaultPassword = student.studentCode; // Mật khẩu ban đầu = MSSV
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const userEmail = student.email || `${student.studentCode.toLowerCase()}@st.haui.edu.vn`;

    // Kiểm tra xem User đã tồn tại chưa
    let user = await User.findOne({ email: userEmail });
    if (!user) {
      user = await User.create({
        email: userEmail,
        passwordHash,
        fullName: student.fullName,
        role: 'student',
        studentId: student._id,
        isActive: true,
        mustChangePassword: true, // Bắt buộc đổi MK lần đầu
      });
    }

    student.userId = user._id;
    await student.save();
    logger.info(`[Auth] Đã tự động cấp tài khoản User cho sinh viên: ${student.studentCode}`);
  }

  // 4. Tự động phát hành 02 hóa đơn tài chính (FR-32)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // Hạn nộp 7 ngày

  // 4.1 Hóa đơn tiền cọc
  await Invoice.create({
    invoiceCode: generateInvoiceCode(),
    contractId: contract._id,
    studentId: contract.studentId,
    type: 'deposit',
    amount: contract.depositAmount,
    description: `Tiền đặt cọc phòng KTX ${updatedRoom.roomNumber}`,
    dueDate,
    status: 'unpaid',
  });

  // 4.2 Hóa đơn tiền phòng cả kỳ
  await Invoice.create({
    invoiceCode: generateInvoiceCode(),
    contractId: contract._id,
    studentId: contract.studentId,
    type: 'room_semester',
    amount: contract.totalRoomFee,
    description: `Tiền thuê phòng KTX ${updatedRoom.roomNumber} kỳ ${contract.term === '6_months' ? '6 tháng' : '12 tháng'}`,
    dueDate,
    status: 'unpaid',
  });

  // 5. Xóa Cache Redis liên quan đến phòng và dashboard
  await Promise.all([
    cache.delByPattern('rooms:*'),
    cache.delByPattern('dashboard:*'),
    cache.delByPattern(`portal:*`),
  ]);

  return {
    contract,
    message: 'Phê duyệt hợp đồng KTX, khóa giường và phát hành hóa đơn thành công!',
  };
};

/**
 * 5. Từ chối đơn đăng ký KTX (FR-33)
 */
const rejectContract = async (id, reason, actorId) => {
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn đăng ký');
  }

  if (contract.status !== 'pending') {
    throw new ApiError(422, 'CONTRACT_NOT_PENDING', 'Đơn đăng ký này không ở trạng thái chờ duyệt');
  }

  contract.status = 'terminated';
  contract.rejectionReason = reason;
  contract.approvedBy = actorId;
  contract.approvedAt = new Date();
  await contract.save();

  return {
    contract,
    message: 'Đã từ chối đơn đăng ký KTX thành công',
  };
};

/**
 * 6. Trả phòng & Thanh lý Hợp đồng KTX — KÈM HOÀN TIỀN CỌC (FR-34)
 * 
 * Luồng logic:
 * 1. Kiểm tra điều kiện sạch nợ 100% (BR-04):
 *    - Cá nhân: Không còn hóa đơn tiền phòng/cọc nào unpaid.
 *    - Phòng: Không còn hóa đơn điện nước chung nào unpaid.
 * 2. Nghiệp vụ Hoàn tiền cọc (Deposit Refund):
 *    - Kiểm tra xem sinh viên đã nộp tiền cọc chưa (hóa đơn cọc đã paid).
 *    - Nếu đã nộp cọc:
 *      + Tính: refundAmount = depositAmount - deductionAmount (nếu làm hỏng đồ đạc).
 *      + Cập nhật contract: depositRefundAmount, depositDeductionAmount, depositRefundReason, depositStatus = 'refunded'.
 *      + Tạo phiếu chi trong collection `payments` (type: 'refund').
 * 3. Giải phóng giường về trạng thái 'available' (xóa studentId).
 * 4. Chuyển hợp đồng sang trạng thái 'terminated'.
 * 5. Xóa Cache Redis để đồng bộ số giường trống thời gian thực.
 */
const terminateContract = async (id, data = {}, actorId) => {
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng KTX');
  }

  if (contract.status !== 'active') {
    throw new ApiError(422, 'CONTRACT_NOT_ACTIVE', 'Chỉ có thể thanh lý hợp đồng đang hoạt động (active)');
  }

  // 1. Kiểm tra điều kiện công nợ của cá nhân sinh viên (BR-04)
  const unpaidPersonalInvoices = await Invoice.find({
    studentId: contract.studentId,
    status: 'unpaid',
  });
  if (unpaidPersonalInvoices.length > 0) {
    throw new ApiError(
      422,
      'STUDENT_HAS_DEBT',
      `Sinh viên còn ${unpaidPersonalInvoices.length} hóa đơn cá nhân chưa thanh toán. Không thể thanh lý hợp đồng!`
    );
  }

  // 2. Kiểm tra điều kiện công nợ tiền điện nước của cả phòng (BR-04)
  const unpaidRoomUtilityInvoices = await Invoice.find({
    roomId: contract.roomId,
    type: 'utility',
    status: 'unpaid',
  });
  if (unpaidRoomUtilityInvoices.length > 0) {
    throw new ApiError(
      422,
      'ROOM_HAS_DEBT',
      'Phòng KTX hiện còn hóa đơn điện nước chưa thanh toán dứt điểm. Vui lòng thanh toán trước khi trả phòng!'
    );
  }

  // 3. Xử lý Hoàn trả tiền cọc cho sinh viên (Deposit Refund)
  // Kiểm tra xem sinh viên đã hoàn thành nghĩa vụ nộp cọc ban đầu chưa
  const depositInvoice = await Invoice.findOne({
    contractId: contract._id,
    type: 'deposit',
  });

  const isDepositPaid = depositInvoice?.status === 'paid' || contract.depositStatus === 'paid';

  let refundAmount = 0;
  let deductionAmount = 0;

  if (isDepositPaid) {
    const depositAmount = contract.depositAmount || 500000;
    deductionAmount = Math.min(depositAmount, Math.max(0, Number(data.deductionAmount || 0)));
    refundAmount = Math.max(0, depositAmount - deductionAmount);

    contract.depositRefundAmount = refundAmount;
    contract.depositDeductionAmount = deductionAmount;
    contract.depositRefundReason = data.deductionReason || data.note || 'Hoàn tiền cọc khi sinh viên out KTX';
    contract.depositRefundedAt = new Date();
    contract.depositRefundedBy = actorId;
    contract.depositStatus = deductionAmount >= depositAmount ? 'forfeited' : 'refunded';

    // Tạo bản ghi giao dịch hoàn tiền trong collection payments (type: 'refund')
    if (refundAmount > 0) {
      await Payment.create({
        paymentCode: generateTransactionRef(),
        invoiceId: depositInvoice?._id || null,
        studentId: contract.studentId,
        amount: refundAmount,
        type: 'refund',
        method: data.refundMethod || 'cash',
        cashCollectedBy: actorId,
        note: `Hoàn cọc KTX cho sinh viên (Khấu trừ hư hỏng: ${deductionAmount.toLocaleString('vi-VN')} đ)`,
        paidAt: new Date(),
        status: 'success',
      });
    }
  } else {
    // Nếu sinh viên chưa từng nộp cọc
    contract.depositStatus = 'unpaid';
  }

  // 4. Giải phóng vị trí giường trong phòng KTX về trạng thái 'available'
  await Room.findOneAndUpdate(
    {
      _id: contract.roomId,
      'beds.bedNumber': contract.bedNumber,
    },
    {
      $set: {
        'beds.$.status': 'available',
        'beds.$.studentId': null,
      },
    },
    { new: true }
  );

  // 5. Chuyển trạng thái hợp đồng sang 'terminated'
  contract.status = 'terminated';
  await contract.save();

  // 6. Xóa Cache Redis liên quan
  await Promise.all([
    cache.delByPattern('rooms:*'),
    cache.delByPattern('dashboard:*'),
    cache.delByPattern(`portal:*`),
  ]);

  return {
    contract,
    refundSummary: {
      depositAmount: contract.depositAmount,
      deductionAmount,
      refundAmount,
      depositStatus: contract.depositStatus,
    },
    message: 'Thanh lý hợp đồng KTX, hoàn tiền cọc và giải phóng giường thành công!',
  };
};

module.exports = {
  registerOnline,
  getContracts,
  getContractById,
  approveContract,
  rejectContract,
  terminateContract,
};

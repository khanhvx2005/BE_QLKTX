/**
 * Service xử lý nghiệp vụ cho Module Contracts (Hợp đồng).
 * Tuân thủ theo API.md §6 và DATA-SCHEMA.md §3.7.
 */

const Contract = require('./contract.model');
const Residency = require('../residencies/residency.model');
const Student = require('../students/student.model');
const residencyService = require('../residencies/residency.service');
const ApiError = require('../../core/errors/api-error');

/**
 * Sinh mã hợp đồng tự động theo quy tắc: HD-YYYYMM-XXXX
 */
const generateContractNumber = async () => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `HD-${yearMonth}`;

  // Đếm số lượng hợp đồng đã sinh trong tháng hiện tại
  const count = await Contract.countDocuments({
    contractNumber: { $regex: `^${prefix}` },
  });

  const sequence = String(count + 1).padStart(4, '0');
  return `${prefix}-${sequence}`;
};

const getContracts = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.studentId) {
    filter.studentId = query.studentId;
  }

  if (query.search) {
    filter.contractNumber = { $regex: query.search.trim(), $options: 'i' };
  }

  // Lọc hợp đồng sắp hết hạn trong N ngày (expiringInDays)
  if (query.expiringInDays) {
    const days = parseInt(query.expiringInDays, 10);
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    filter.status = 'active';
    filter.endDate = { $gte: now, $lte: futureDate };
  }

  const [items, total] = await Promise.all([
    Contract.find(filter)
      .populate('studentId', 'fullName studentCode phone email gender className')
      .populate({
        path: 'residencyId',
        populate: {
          path: 'bedId',
          select: 'bedNumber status roomId',
          populate: {
            path: 'roomId',
            select: 'roomNumber gender pricePerBed buildingId',
            populate: { path: 'buildingId', select: 'code name' },
          },
        },
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    Contract.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
  };
};

const getContractById = async (id, user = null) => {
  const contract = await Contract.findById(id)
    .populate('studentId', 'fullName studentCode phone email gender className')
    .populate({
      path: 'residencyId',
      populate: {
        path: 'bedId',
        select: 'bedNumber status roomId',
        populate: {
          path: 'roomId',
          select: 'roomNumber gender pricePerBed buildingId',
          populate: { path: 'buildingId', select: 'code name address' },
        },
      },
    });

  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng');
  }

  // Quy tắc dữ liệu chính chủ cho sinh viên (API.md §1.4)
  if (user && user.role === 'student') {
    const studentOwnerId = contract.studentId?._id?.toString() || contract.studentId?.toString();
    if (studentOwnerId !== user.studentId?.toString()) {
      throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem hợp đồng của sinh viên khác');
    }
  }

  return contract;
};

const createContract = async (data, actorId = null) => {
  const { residencyId, studentId, startDate, endDate, roomFeeSnapshot, depositAmount } = data;

  // 1. Kiểm tra tồn tại Residency
  const residency = await Residency.findById(residencyId);
  if (!residency) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bản ghi lưu trú');
  }

  // 2. Kiểm tra bản ghi lưu trú đã có hợp đồng chưa
  const existingContract = await Contract.findOne({ residencyId });
  if (existingContract) {
    throw new ApiError(409, 'CONTRACT_ALREADY_EXISTS', 'Bản ghi lưu trú này đã được tạo hợp đồng');
  }

  // 3. Kiểm tra sinh viên
  const student = await Student.findById(studentId);
  if (!student) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sinh viên');
  }

  // 4. Sinh mã hợp đồng tự động
  const contractNumber = await generateContractNumber();

  const contract = await Contract.create({
    contractNumber,
    residencyId,
    studentId,
    startDate,
    endDate,
    roomFeeSnapshot,
    depositAmount: depositAmount || 0,
    depositStatus: 'pending',
    status: 'pending',
    createdBy: actorId,
  });

  return contract;
};

const updateContract = async (id, data) => {
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng');
  }

  Object.assign(contract, data);
  await contract.save();
  return contract;
};

/**
 * Kích hoạt hợp đồng: pending -> active (API.md §6)
 */
const activateContract = async (id, actorId = null) => {
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng');
  }

  if (contract.status === 'active') {
    return { contract, message: 'Hợp đồng đã ở trạng thái hiệu lực' };
  }

  contract.status = 'active';
  contract.depositStatus = 'paid'; // Đánh dấu đã đóng cọc
  await contract.save();

  // Đảm bảo residency cũng active
  await Residency.findByIdAndUpdate(contract.residencyId, { status: 'active' });

  return {
    contract,
    message: 'Kích hoạt hợp đồng thành công',
  };
};

/**
 * Thanh lý hợp đồng: active -> terminated (API.md §6)
 * Tự động kết thúc lưu trú và giải phóng giường.
 */
const terminateContract = async (id, actorId = null) => {
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng');
  }

  contract.status = 'terminated';
  contract.depositStatus = 'refunded';
  await contract.save();

  // Cascade: Kết thúc lưu trú và giải phóng giường
  if (contract.residencyId) {
    await residencyService.closeResidency(contract.residencyId, actorId);
  }

  return {
    id: contract._id,
    contractNumber: contract.contractNumber,
    status: 'terminated',
    message: 'Đã thanh lý hợp đồng và giải phóng giường',
  };
};

module.exports = {
  getContracts,
  getContractById,
  createContract,
  updateContract,
  activateContract,
  terminateContract,
};

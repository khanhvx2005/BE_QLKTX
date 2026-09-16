/**
 * Service xử lý nghiệp vụ Quản lý tài khoản (/api/users).
 * Tuân thủ theo API.md §2.1 (v1.2.6) và các quy tắc BR-80 -> BR-85.
 */

const User = require('./user.model');
const Student = require('../students/student.model');
const ApiError = require('../../core/errors/api-error');
const { generateTemporaryPassword } = require('./auth.service');

const roleWeight = {
  admin: 1,
  staff: 2,
  viewer: 3,
  student: 4,
};

/**
 * Lấy danh sách tài khoản kèm tóm tắt summary (Chỉ dành cho Admin)
 */
const getUsers = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // Tính toán summary trên toàn bộ users (bỏ qua filter)
  const allUsers = await User.find({}).select('role isActive');
  const summary = {
    all: allUsers.length,
    admin: 0,
    staff: 0,
    viewer: 0,
    student: 0,
    locked: 0,
  };

  allUsers.forEach((u) => {
    if (u.isActive === false) summary.locked += 1;
    if (summary[u.role] !== undefined) summary[u.role] += 1;
  });

  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === true || query.isActive === 'true';
  }

  let users = await User.find(filter)
    .populate('studentId', 'studentCode fullName')
    .sort({ createdAt: -1 });

  // Tìm kiếm theo email, fullName, studentCode
  if (query.search) {
    const s = query.search.trim().toLowerCase();
    users = users.filter((u) => {
      const email = u.email?.toLowerCase() || '';
      const name = u.fullName?.toLowerCase() || '';
      const stuCode = u.studentId?.studentCode?.toLowerCase() || '';
      return email.includes(s) || name.includes(s) || stuCode.includes(s);
    });
  }

  // Sắp xếp admin -> staff -> viewer -> student, sau đó theo tên
  users.sort((a, b) => {
    const wA = roleWeight[a.role] || 99;
    const wB = roleWeight[b.role] || 99;
    if (wA !== wB) return wA - wB;
    return (a.fullName || '').localeCompare(b.fullName || '');
  });

  const total = users.length;
  const paginated = users.slice(skip, skip + limit);

  const items = paginated.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: Boolean(u.mustChangePassword),
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    student: u.studentId ? {
      id: u.studentId._id.toString(),
      studentCode: u.studentId.studentCode,
      fullName: u.studentId.fullName,
    } : null,
  }));

  return {
    items,
    total,
    page,
    limit,
    summary,
  };
};

/**
 * Tạo tài khoản mới (Chỉ dành cho Admin)
 */
const createUser = async (data) => {
  const emailLower = data.email.trim().toLowerCase();

  // Kiểm tra trùng email (BR-80)
  const existing = await User.findOne({ email: emailLower });
  if (existing) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email đã được sử dụng', {
      errors: [{ field: 'email', message: 'Email đã tồn tại trên hệ thống' }],
    });
  }

  let fullName = data.fullName;
  let studentDoc = null;

  if (data.role === 'student') {
    studentDoc = await Student.findById(data.studentId);
    if (!studentDoc) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Sinh viên không tồn tại', {
        errors: [{ field: 'studentId', message: 'Sinh viên không tồn tại' }],
      });
    }

    // BR-82: Sinh viên đã có tài khoản
    if (studentDoc.userId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Sinh viên này đã có tài khoản', {
        errors: [{ field: 'studentId', message: 'Sinh viên này đã có tài khoản' }],
      });
    }

    fullName = studentDoc.fullName;
  }

  // Sinh mật khẩu tạm thời tuân thủ BR-85
  const temporaryPassword = generateTemporaryPassword(10);
  const passwordHash = await User.hashPassword(temporaryPassword);

  const user = await User.create({
    email: emailLower,
    passwordHash,
    fullName,
    role: data.role,
    studentId: studentDoc ? studentDoc._id : null,
    isActive: true,
    mustChangePassword: true,
  });

  // Nếu là sinh viên, liên kết ngược lại Student.userId
  if (studentDoc) {
    studentDoc.userId = user._id;
    await studentDoc.save();
  }

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: true,
    },
    temporaryPassword,
  };
};

/**
 * Cập nhật thông tin tài khoản (Chỉ dành cho Admin)
 */
const updateUser = async (id, data, actorUserId) => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  }

  // Không đổi vai trò giữa student ↔ cán bộ
  if (data.role && data.role !== user.role) {
    if (user.role === 'student' || data.role === 'student') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Không thể đổi vai trò giữa sinh viên và cán bộ', {
        errors: [{ field: 'role', message: 'Không thể đổi vai trò giữa sinh viên và cán bộ' }],
      });
    }

    // Không tự đổi vai trò của chính mình
    if (actorUserId && actorUserId.toString() === id.toString()) {
      throw new ApiError(422, 'CANNOT_MODIFY_SELF', 'Không thể tự đổi vai trò của chính mình');
    }

    // BR-83: Không hạ quyền admin cuối cùng đang hoạt động
    if (user.role === 'admin') {
      const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdmins <= 1) {
        throw new ApiError(
          422,
          'LAST_ACTIVE_ADMIN',
          'Không thể thay đổi vai trò của quản trị viên cuối cùng đang hoạt động'
        );
      }
    }
  }

  if (data.email) {
    const emailLower = data.email.trim().toLowerCase();
    const dup = await User.findOne({ email: emailLower, _id: { $ne: id } });
    if (dup) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Email đã được sử dụng', {
        errors: [{ field: 'email', message: 'Email đã được sử dụng' }],
      });
    }
    user.email = emailLower;
  }

  if (data.fullName && user.role !== 'student') {
    user.fullName = data.fullName.trim();
  }

  if (data.role) {
    user.role = data.role;
  }

  await user.save();

  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
};

/**
 * Khóa / mở khóa tài khoản
 */
const updateStatus = async (id, { isActive }, actorUserId) => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  }

  if (isActive === false) {
    // Không tự khóa mình
    if (actorUserId && actorUserId.toString() === id.toString()) {
      throw new ApiError(422, 'CANNOT_MODIFY_SELF', 'Không thể tự khóa tài khoản của chính mình');
    }

    // BR-83: Không khóa admin cuối
    if (user.role === 'admin') {
      const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdmins <= 1) {
        throw new ApiError(
          422,
          'LAST_ACTIVE_ADMIN',
          'Không thể khóa quản trị viên cuối cùng đang hoạt động'
        );
      }
    }
  }

  user.isActive = isActive;
  await user.save();

  return {
    id: user._id.toString(),
    email: user.email,
    isActive: user.isActive,
  };
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  updateStatus,
};

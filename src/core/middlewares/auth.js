/**
 * Middleware xác thực JWT và phân quyền RBAC.
 * Tuân thủ nghiêm ngặt 07-PHAN-QUYEN-BAO-MAT.md §3.2 và 02 FR-08.
 * Lưu ý: Sử dụng 1 JWT hạn 7 ngày, KHÔNG có refresh token.
 */

const ApiError = require('../errors/api-error');
const { verifyToken } = require('../utils/jwt');
const asyncHandler = require('../utils/async-handler');
const User = require('../../modules/auth/user.model');

/**
 * Middleware xác thực Bearer Token
 * Gán req.user = { id, role, studentId, mustChangePassword }
 * G3: Kiểm tra trạng thái isActive của User trong DB (chống dùng token khi đã bị khóa)
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập');
  }

  const token = authHeader.slice(7).trim();

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn');
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'Mã xác thực không hợp lệ');
  }

  const userId = payload.userId || payload.id;

  // G3: Tra cứu trạng thái người dùng trong DB
  const user = await User.findById(userId).select('isActive role studentId mustChangePassword');
  if (!user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Tài khoản không tồn tại trên hệ thống');
  }

  if (user.isActive === false) {
    throw new ApiError(
      403,
      'ACCOUNT_LOCKED',
      'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ ban quản lý'
    );
  }

  // Gắn thông tin người dùng vào request
  req.user = {
    id: user._id.toString(),
    role: user.role,
    studentId: user.studentId ? user.studentId.toString() : (payload.studentId || null),
    mustChangePassword: Boolean(user.mustChangePassword),
  };

  next();
});

/**
 * Middleware phân quyền RBAC theo danh sách các vai trò được phép
 * @param {...string} allowedRoles - Danh sách vai trò: 'admin', 'staff', 'student', 'viewer'
 * @example router.post('/students', authenticate, authorize('admin', 'staff'), studentController.create);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Chưa xác thực danh tính'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này')
      );
    }

    next();
  };
};

/**
 * Middleware bảo vệ các route cổng sinh viên (/portal/*)
 * Đảm bảo tài khoản sinh viên đã được liên kết với hồ sơ Student (07 §3.2)
 */
const requireLinkedStudent = (req, res, next) => {
  if (req.user?.role === 'student' && !req.user?.studentId) {
    return next(
      new ApiError(
        403,
        'STUDENT_NOT_LINKED',
        'Tài khoản chưa được liên kết với hồ sơ sinh viên'
      )
    );
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
  requireLinkedStudent,
};

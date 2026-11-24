/**
 * Middleware xác thực JWT và phân quyền RBAC 3 vai trò (admin, staff, student).
 * Sử dụng 1 JWT hạn 7 ngày, kiểm tra trạng thái khóa tài khoản và cờ bắt buộc đổi mật khẩu lần đầu.
 */

const ApiError = require('../errors/api-error');
const { verifyToken } = require('../utils/jwt');
const asyncHandler = require('../utils/async-handler');
const User = require('../../modules/auth/user.model');

const ALLOWED_WHILE_FORCED = ['/api/auth/me', '/api/auth/logout', '/api/auth/change-password'];

/**
 * Xác thực Bearer Token và gắn `req.user` = `{ id, role, fullName, email, studentId, mustChangePassword }`
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
  const user = await User.findById(userId).select('isActive role studentId mustChangePassword fullName email');
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

  // BR-06: còn cờ buộc đổi mật khẩu thì chỉ được xem mình, đăng xuất, đổi mật khẩu
  if (user.mustChangePassword && !ALLOWED_WHILE_FORCED.includes(req.originalUrl.split('?')[0])) {
    throw new ApiError(403, 'MUST_CHANGE_PASSWORD', 'Bạn cần đổi mật khẩu trước khi tiếp tục');
  }

  req.user = {
    id: user._id.toString(),
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    studentId: user.studentId ? user.studentId.toString() : null,
    mustChangePassword: Boolean(user.mustChangePassword),
  };

  next();
});

/**
 * Phân quyền RBAC theo danh sách vai trò được phép ('admin', 'staff', 'student')
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

module.exports = {
  authenticate,
  authorize,
};

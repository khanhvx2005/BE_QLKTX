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

  // API.md §1.4 (FR-01, BR-06): còn cờ buộc đổi mật khẩu thì chỉ được xem mình, đăng xuất, đổi mật khẩu.
  // ⚠️ Không chặn ở đây thì tài khoản vừa cấp (mật khẩu = MSSV) dùng được mọi chức năng mà chưa đổi mật khẩu.
  const ALLOWED_WHILE_FORCED = ['/api/auth/me', '/api/auth/logout', '/api/auth/change-password'];
  if (user.mustChangePassword && !ALLOWED_WHILE_FORCED.includes(req.originalUrl.split('?')[0])) {
    throw new ApiError(403, 'MUST_CHANGE_PASSWORD', 'Bạn cần đổi mật khẩu trước khi tiếp tục');
  }

  // Gắn thông tin người dùng vào request. Danh tính sinh viên luôn lấy từ CSDL, không từ query/body (API.md §1.4)
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

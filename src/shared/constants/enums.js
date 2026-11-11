/**
 * Định nghĩa toàn bộ hằng số Enum dùng chung trong hệ thống HaUI - DMS (v2.0-HaUI).
 * Quy ước: Tất cả giá trị enum đều viết thường (lowercase) theo EDIT_DOCS_DATA_SCHEMA.md.
 */

// Vai trò người dùng trong hệ thống (RBAC 3 cấp, đã loại bỏ viewer)
const ROLES = ['admin', 'staff', 'student'];

// Giới tính (dùng cho Student và kiểm tra xếp phòng nam/nữ BR-01)
const GENDER = ['male', 'female'];

// Trạng thái hồ sơ sinh viên
const STUDENT_STATUS = ['active', 'inactive'];

// Trạng thái phòng KTX
const ROOM_STATUS = ['active', 'maintenance'];

// Sức chứa phòng KTX (cố định 3 mức tiêu chuẩn)
const ROOM_CAPACITY = [4, 6, 8];

// Trạng thái vị trí giường nhúng trong phòng
const BED_STATUS = ['available', 'occupied', 'maintenance'];

// Thời hạn hợp đồng KTX trọn gói theo kỳ
const CONTRACT_TERMS = ['6_months', '12_months'];

// Trạng thái hợp đồng KTX (Hợp nhất Đơn đăng ký và Hợp đồng lưu trú)
const CONTRACT_STATUS = ['pending', 'active', 'expired', 'terminated'];

// Trạng thái tiền cọc phòng (Hỗ trợ nghiệp vụ Hoàn tiền cọc khi trả phòng)
const DEPOSIT_STATUS = ['unpaid', 'paid', 'refunded', 'forfeited'];

// 3 loại hóa đơn cố định trong hệ thống HaUI DMS (đã bỏ FeeType động)
const INVOICE_TYPE = ['room_semester', 'deposit', 'utility'];

// Trạng thái hóa đơn
const INVOICE_STATUS = ['unpaid', 'paid'];

// Phương thức thanh toán (Hỗ trợ Tiền mặt tại KTX & Quét VietQR)
const PAYMENT_METHOD = ['cash', 'vietqr', 'bank_transfer'];

// Trạng thái giao dịch thanh toán
const PAYMENT_STATUS = ['pending', 'success', 'failed'];

// Loại giao dịch tài chính: Thu tiền hóa đơn hoặc Hoàn cọc cho sinh viên
const PAYMENT_TYPE = ['payment', 'refund'];

module.exports = {
  ROLES,
  GENDER,
  STUDENT_STATUS,
  ROOM_STATUS,
  ROOM_CAPACITY,
  BED_STATUS,
  CONTRACT_TERMS,
  CONTRACT_STATUS,
  DEPOSIT_STATUS,
  INVOICE_TYPE,
  INVOICE_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
};

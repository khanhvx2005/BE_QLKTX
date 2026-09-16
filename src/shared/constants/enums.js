/**
 * Định nghĩa toàn bộ hằng số Enum dùng chung trong hệ thống DMS-KTX.
 * Quy ước: Tất cả giá trị enum đều viết thường (lowercase) theo DATA-SCHEMA.md §1.
 */

// Vai trò người dùng (DATA-SCHEMA.md §3.1, 07-PHAN-QUYEN-BAO-MAT.md §1)
const ROLES = ['admin', 'staff', 'student', 'viewer'];

// Giới tính (dùng cho Student và Room gender check - A1, PRD §2.9)
const GENDER = ['male', 'female'];

// Trạng thái sinh viên (DATA-SCHEMA.md §3.2)
const STUDENT_STATUS = ['active', 'inactive'];

// Phân hạng loại phòng (DATA-SCHEMA.md §3.4a, API.md §4)
const ROOM_TYPE_TIER = ['standard', 'premium'];

// Trạng thái phòng (DATA-SCHEMA.md §3.4)
const ROOM_STATUS = ['active', 'maintenance', 'inactive'];

// Trạng thái giường (DATA-SCHEMA.md §3.5)
const BED_STATUS = ['available', 'occupied', 'maintenance'];

// Trạng thái đơn đăng ký phòng (DATA-SCHEMA.md §3.6a, API.md §5.1)
const APPLICATION_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];

// Trạng thái bản ghi lưu trú (DATA-SCHEMA.md §3.6, API.md §5)
const RESIDENCY_STATUS = ['active', 'closed'];

// Trạng thái hợp đồng (DATA-SCHEMA.md §3.7 v1.2: bỏ pending)
const CONTRACT_STATUS = ['active', 'expired', 'terminated'];

// Mã danh mục loại phí mẫu (DATA-SCHEMA.md §3.8: lowercase)
const FEE_TYPE_CODES = ['rent', 'electricity', 'water', 'deposit', 'supplies', 'other'];

// Trạng thái hóa đơn (DATA-SCHEMA.md §3.10)
const INVOICE_STATUS = ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'];

// Loại hóa đơn (DATA-SCHEMA.md §3.10)
const INVOICE_TYPE = ['deposit', 'monthly', 'settlement', 'supplies', 'other'];

// Phương thức thanh toán (DATA-SCHEMA.md §3.11)
const PAYMENT_METHOD = ['cash', 'bank_transfer', 'vnpay', 'zalopay'];

// Trạng thái thanh toán (DATA-SCHEMA.md §3.11, API.md §8: bỏ completed)
const PAYMENT_STATUS = ['pending', 'success', 'failed', 'expired'];

// Loại thanh toán: thu tiền hoặc hoàn cọc (DATA-SCHEMA.md §3.11, §4)
const PAYMENT_TYPE = ['payment', 'refund'];

// Loại yêu cầu của sinh viên (DATA-SCHEMA.md §3.12)
const REQUEST_TYPE = ['renewal', 'checkout'];

// Trạng thái yêu cầu (DATA-SCHEMA.md §3.12)
const REQUEST_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];

// Danh mục sản phẩm nhu yếu phẩm (DATA-SCHEMA.md §3.15, API.md §11)
const SUPPLY_CATEGORY = ['bedding', 'appliances', 'cleaning', 'personal', 'other'];

// Trạng thái đơn hàng nhu yếu phẩm (DATA-SCHEMA.md §3.16, API.md §11)
const SUPPLY_ORDER_STATUS = ['pending_payment', 'ready', 'delivered', 'cancelled'];

module.exports = {
  ROLES,
  GENDER,
  STUDENT_STATUS,
  ROOM_TYPE_TIER,
  ROOM_STATUS,
  BED_STATUS,
  APPLICATION_STATUS,
  RESIDENCY_STATUS,
  CONTRACT_STATUS,
  FEE_TYPE_CODES,
  INVOICE_STATUS,
  INVOICE_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  REQUEST_TYPE,
  REQUEST_STATUS,
  SUPPLY_CATEGORY,
  SUPPLY_ORDER_STATUS,
};

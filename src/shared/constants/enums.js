/**
 * Hằng số enum & danh mục chuẩn dùng chung toàn hệ thống HaUI - DMS v3.0.
 * Khớp 100% với docs/EDIT_DOCS_DATA_SCHEMA.md và docs/API.md.
 */

const ROLES = ['admin', 'manager', 'staff', 'student'];
const GENDER = ['male', 'female'];
const STUDENT_STATUS = ['active', 'inactive'];

const CAMPUSES = ['cs1'];
const CAMPUS_SCOPE = ['cs1', 'all'];

/** Thông tin chính thức Ký túc xá Cơ sở 1 — ĐH Công nghiệp Hà Nội */
const CAMPUS_INFO = {
  cs1: {
    code: 'cs1',
    name: 'KTX Cơ sở 1 — Cầu Diễn (Hà Nội)',
    shortName: 'Cơ sở 1 - Cầu Diễn',
    address: 'Ngõ 296 / Số 298 Đường Cầu Diễn, Phường Tây Tựu, TP. Hà Nội',
    officeLocation: 'Văn phòng Trung tâm KTX Cơ sở 1 — Tầng 1 nhà A14',
    buildings: ['A14', 'A15'],
    scaleNote: '2 tòa nhà nội trú (A14, A15 — 40 phòng, >30m² khép kín), gồm Phòng Chất lượng cao & Phòng Tiêu chuẩn',
  },
};

/** Bảng giá phòng ở KTX HaUI chính thức năm học 2026–2027 (VNĐ/SV/tháng — ssc.haui.edu.vn) */
const ROOM_PRICES_2026 = {
  high_quality: {
    3: { cs1: 930000 },
    4: { cs1: 700000 },
    6: { cs1: 470000 },
  },
  standard: {
    4: { cs1: 550000 },
    6: { cs1: 380000 },
  },
};

const ROOM_TIERS = ['high_quality', 'standard'];
const ROOM_STATUS = ['active', 'maintenance'];
const ROOM_CAPACITY = [2, 3, 4, 6];

const PRIORITY_TYPES = ['policy_family', 'poor_household', 'remote_area', 'normal'];
const PRIORITY_WEIGHT = { policy_family: 1, poor_household: 2, remote_area: 3, normal: 4 };

const TARGET_COHORTS = ['freshman', 'returning', 'all'];
const PERIOD_STATUS = ['upcoming', 'open', 'closed'];

const CONTRACT_TERMS = ['6_months', '12_months'];
const TERM_MONTHS = {
  '6_months': 6,
  '12_months': 12,
};

/** Trạng thái LƯU trong CSDL (`expired` suy ra lúc đọc khi `active` đã qua `endDate`) */
const CONTRACT_STATUS = ['pending', 'pending_payment', 'active', 'terminated', 'rejected', 'cancelled'];
/** Trạng thái TRẢ RA cho Frontend */
const CONTRACT_STATUS_VIEW = ['pending', 'pending_payment', 'active', 'expired', 'terminated', 'rejected', 'cancelled'];

const INVOICE_TYPE = ['room_semester', 'deposit', 'utility'];
const INVOICE_SCOPE = ['personal', 'room'];
const INVOICE_STATUS = ['unpaid', 'paid', 'cancelled'];

const PAYMENT_TYPE = ['payment', 'refund'];
const PAYMENT_METHOD = ['cash', 'vietqr'];

const REQUEST_TYPE = ['repair', 'transfer', 'checkout'];
const REPAIR_CATEGORY = ['electric', 'water', 'ac', 'furniture', 'other'];
const REQUEST_STATUS = ['pending', 'in_progress', 'approved', 'completed', 'rejected', 'cancelled'];

const NOTIFICATION_SCOPE = ['personal', 'broadcast'];
const NOTIFICATION_TYPE = ['application', 'payment', 'utility', 'request', 'announcement'];
const NOTIFICATION_PRIORITY = ['urgent', 'important', 'normal'];

module.exports = {
  ROLES,
  GENDER,
  STUDENT_STATUS,
  CAMPUSES,
  CAMPUS_SCOPE,
  CAMPUS_INFO,
  ROOM_PRICES_2026,
  ROOM_TIERS,
  ROOM_STATUS,
  ROOM_CAPACITY,
  PRIORITY_TYPES,
  PRIORITY_WEIGHT,
  TARGET_COHORTS,
  PERIOD_STATUS,
  CONTRACT_TERMS,
  TERM_MONTHS,
  CONTRACT_STATUS,
  CONTRACT_STATUS_VIEW,
  INVOICE_TYPE,
  INVOICE_SCOPE,
  INVOICE_STATUS,
  PAYMENT_TYPE,
  PAYMENT_METHOD,
  REQUEST_TYPE,
  REPAIR_CATEGORY,
  REQUEST_STATUS,
  NOTIFICATION_SCOPE,
  NOTIFICATION_TYPE,
  NOTIFICATION_PRIORITY,
};

/**
 * Hằng số enum & danh mục chuẩn dùng chung toàn hệ thống HaUI - DMS v3.0.
 * Khớp 100% với docs/EDIT_DOCS_DATA_SCHEMA.md và docs/API.md.
 */

const ROLES = ['admin', 'manager', 'staff', 'student'];
const GENDER = ['male', 'female'];
const STUDENT_STATUS = ['active', 'inactive'];

const CAMPUSES = ['cs1', 'cs2', 'cs3'];
const CAMPUS_SCOPE = ['cs1', 'cs2', 'cs3', 'all'];

/** Thông tin chính thức 3 Cơ sở ĐH Công nghiệp Hà Nội (Địa giới hành chính 2026 & ssc.haui.edu.vn) */
const CAMPUS_INFO = {
  cs1: {
    code: 'cs1',
    name: 'Cơ sở 1 (Trụ sở chính)',
    shortName: 'Cơ sở 1 - Cầu Diễn',
    address: 'Ngõ 296 / Số 298 Đường Cầu Diễn, Phường Tây Tựu, TP. Hà Nội',
    officeLocation: 'Văn phòng Trung tâm KTX — Tầng 1 nhà A14 / A15',
    buildings: ['A14', 'A15'],
    scaleNote: '264 phòng nội trú (>30m²), hơn 1.100 chỗ ở (209 phòng SV Việt Nam, 55 phòng SV quốc tế)',
  },
  cs2: {
    code: 'cs2',
    name: 'Cơ sở 2',
    shortName: 'Cơ sở 2 - Tây Tựu',
    address: 'Tổ dân phố Thượng 2, Phường Tây Tựu, TP. Hà Nội',
    officeLocation: 'Văn phòng Trung tâm KTX — Tầng 1 nhà B12',
    buildings: ['B12', 'B14'],
    scaleNote: '112 phòng nội trú (4.500m²), hơn 476 chỗ ở (B12: 5 tầng 72 phòng; B14: 5 tầng 40 phòng)',
  },
  cs3: {
    code: 'cs3',
    name: 'Cơ sở 3 (Ninh Bình)',
    shortName: 'Cơ sở 3 - Phù Vân',
    address: 'Phường Phù Vân, Tỉnh Ninh Bình',
    officeLocation: 'Văn phòng Trung tâm KTX — Tầng 1 nhà C15',
    buildings: ['C15', 'C16', 'C17'],
    scaleNote: '330 phòng nội trú (15.035m²), hơn 1.400 chỗ ở (C15: 57 phòng, C16: 63 phòng, C17: 210 phòng)',
  },
};

/** Bảng giá phòng ở KTX HaUI chính thức năm học 2026–2027 (VNĐ/SV/tháng — ssc.haui.edu.vn) */
const ROOM_PRICES_2026 = {
  high_quality: {
    3: { cs1: 930000, cs2: 930000, cs3: 900000 },
    4: { cs1: 700000, cs2: 700000, cs3: 680000 },
    6: { cs1: 470000, cs2: 470000, cs3: 460000 },
  },
  standard: {
    4: { cs1: 550000, cs2: 490000, cs3: 500000 },
    6: { cs1: 380000, cs2: 350000, cs3: 350000 },
  },
  basic: {
    4: { cs1: 450000, cs2: 420000, cs3: 420000 },
    6: { cs1: 320000, cs2: 300000, cs3: 300000 },
  },
};

/** Nhóm khoa/ngành tân sinh viên học ngay tại Hà Nội (CS1/CS2) từ năm nhất */
const HANOI_FRESHMAN_FACULTIES = [
  'Ngoại ngữ',
  'Ngôn ngữ Anh',
  'Ngôn ngữ Trung Quốc',
  'Ngôn ngữ Hàn Quốc',
  'Ngôn ngữ Nhật',
  'Công nghệ May và Thiết kế thời trang',
  'Công nghệ dệt may',
  'Thiết kế thời trang',
  'Công nghệ Hóa',
  'Công nghệ kỹ thuật hóa học',
  'Công nghệ kỹ thuật môi trường',
  'Công nghệ thực phẩm',
];

const ROOM_TIERS = ['high_quality', 'standard', 'basic'];
const ROOM_STATUS = ['active', 'maintenance'];
const ROOM_CAPACITY = [2, 3, 4, 6];

const PRIORITY_TYPES = ['policy_family', 'poor_household', 'remote_area', 'normal'];
const PRIORITY_WEIGHT = { policy_family: 1, poor_household: 2, remote_area: 3, normal: 4 };

const TARGET_COHORTS = ['freshman', 'returning', 'all'];
const PERIOD_STATUS = ['upcoming', 'open', 'closed'];

const CONTRACT_TERMS = ['5_months', '6_months', '8.5_months', '10_months', '12_months'];
const TERM_MONTHS = {
  '5_months': 5,
  '6_months': 6,
  '8.5_months': 8.5,
  '10_months': 10,
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

module.exports = {
  ROLES,
  GENDER,
  STUDENT_STATUS,
  CAMPUSES,
  CAMPUS_SCOPE,
  CAMPUS_INFO,
  ROOM_PRICES_2026,
  HANOI_FRESHMAN_FACULTIES,
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
};

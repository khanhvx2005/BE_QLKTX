/**
 * Hằng số enum dùng chung — khớp FE `docs/API.md` §1.3 (hợp đồng chung FE–BE, bản v2).
 * Quy ước: giá trị viết thường. ⚠️ Đổi giá trị ở đây là đổi hợp đồng: sửa `API.md` trước, báo FE.
 */

const ROLES = ['admin', 'staff', 'student'];
const GENDER = ['male', 'female'];
const STUDENT_STATUS = ['active', 'inactive'];
const ROOM_STATUS = ['active', 'maintenance'];
const ROOM_CAPACITY = [4, 6, 8];
const BED_STATUS = ['available', 'occupied', 'maintenance'];
const CONTRACT_TERMS = ['6_months', '12_months'];
const TERM_MONTHS = { '6_months': 6, '12_months': 12 };

/**
 * Trạng thái LƯU trong CSDL. `expired` KHÔNG lưu: suy ra lúc đọc (active + đã qua endDate) — API.md §6.
 * ⚠️ Không có job đổi active → expired: hợp đồng quá hạn vẫn giữ giường tới khi cán bộ thanh lý (BR-04).
 */
const CONTRACT_STATUS = ['pending', 'active', 'terminated', 'rejected'];
/** Trạng thái TRẢ RA cho FE */
const CONTRACT_STATUS_VIEW = ['pending', 'active', 'expired', 'terminated', 'rejected'];

const INVOICE_TYPE = ['room_semester', 'deposit', 'utility'];
const INVOICE_STATUS = ['unpaid', 'paid'];
/** personal: hóa đơn của một sinh viên · room: hóa đơn điện nước của cả phòng (BR-03) */
const INVOICE_SCOPE = ['personal', 'room'];
const PAYMENT_METHOD = ['cash', 'vietqr'];

module.exports = {
  ROLES,
  GENDER,
  STUDENT_STATUS,
  ROOM_STATUS,
  ROOM_CAPACITY,
  BED_STATUS,
  CONTRACT_TERMS,
  TERM_MONTHS,
  CONTRACT_STATUS,
  CONTRACT_STATUS_VIEW,
  INVOICE_TYPE,
  INVOICE_STATUS,
  INVOICE_SCOPE,
  PAYMENT_METHOD,
};

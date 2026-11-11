/**
 * Utility sinh mã tự động cho các thực thể theo chuẩn HaUI - DMS.
 * Đảm bảo tính duy nhất, format chuẩn và dễ đọc.
 */

const crypto = require('crypto');

/**
 * Sinh số ngẫu nhiên 5 chữ số có đệm 0
 */
const getRandom5Digits = () => {
  return String(crypto.randomInt(1, 100000)).padStart(5, '0');
};

/**
 * Mã hợp đồng: HD-YYYY-XXXXX (e.g. HD-2026-00087)
 */
const generateContractCode = () => {
  const year = new Date().getFullYear();
  return `HD-${year}-${getRandom5Digits()}`;
};

/**
 * Mã hóa đơn cá nhân (Tiền phòng, Tiền cọc): INV-YYYYMM-XXXXX (e.g. INV-202610-00101)
 */
const generateInvoiceCode = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${getRandom5Digits()}`;
};

/**
 * Mã hóa đơn Điện Nước theo Phòng:
 * ============================================================================
 * [QUAN TRỌNG - KHẮC PHỤC LỖI TRÙNG MÃ GIỮA CÁC TÒA NHÀ]:
 * - Công thức: INV-UTIL-<MÃ TÒA>-<SỐ PHÒNG>-<YYYYMM>
 * - Ví dụ: Tòa K1, phòng 302, tháng 10/2026 -> INV-UTIL-K1-302-202610
 * - Tòa K2, phòng 302, tháng 10/2026 -> INV-UTIL-K2-302-202610
 * -> Nhờ có <MÃ TÒA>, không bao giờ bị trùng lặp mã khi chốt số cùng lúc!
 * ============================================================================
 */
const generateUtilityInvoiceCode = (buildingCode, roomNumber, monthYear) => {
  const cleanBuilding = String(buildingCode || 'KTX').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  const cleanRoom = String(roomNumber || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  const cleanMonth = String(monthYear || '').replace(/[^0-9]/g, '');
  return `INV-UTIL-${cleanBuilding}-${cleanRoom}-${cleanMonth}`;
};

/**
 * Mã phiếu thu / giao dịch thanh toán: PAYYYYYMMDDXXXXXX (e.g. PAY20261110DEF456)
 */
const generateTransactionRef = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PAY${dateStr}${randomHex}`;
};

module.exports = {
  generateContractCode,
  generateInvoiceCode,
  generateUtilityInvoiceCode,
  generateTransactionRef,
};

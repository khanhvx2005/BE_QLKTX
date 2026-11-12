/**
 * Sinh mã chứng từ — dễ đọc, tăng dần, không trùng.
 *   Hợp đồng  HD-2026-0001 · Hóa đơn cá nhân INV-2026-0001 · Phiếu thu PAY-2026-0001
 *   Hóa đơn điện nước INV-UTIL-K1-302-202611 (có mã tòa: phòng cùng số ở hai tòa không trùng — API.md §7)
 *
 * ⚠️ Số thứ tự lấy từ mã lớn nhất hiện có rồi +1. Hai yêu cầu cùng lúc có thể ra cùng số → index unique chặn,
 *    `createWithCode` thử lại với số kế tiếp. Đừng bỏ vòng thử lại.
 */

const { localDate } = require('./dates');

const pad = (n, w = 4) => String(n).padStart(w, '0');

/** Số thứ tự kế tiếp cho tiền tố, VD prefix 'HD-2026-' */
async function nextSeq(Model, field, prefix) {
  const last = await Model.findOne({ [field]: { $regex: `^${prefix.replace(/[-]/g, '\\-')}\\d+$` } })
    .sort({ [field]: -1 }).select(field).lean();
  return last ? Number(String(last[field]).slice(prefix.length)) + 1 : 1;
}

/**
 * Tạo bản ghi với mã tăng dần; trùng mã (E11000 trên `field`) thì thử số kế tiếp, tối đa 5 lần.
 * `build(code)` trả object để `Model.create`.
 */
async function createWithCode(Model, field, prefix, build, { session } = {}) {
  let seq = await nextSeq(Model, field, prefix);
  for (let attempt = 0; attempt < 5; attempt += 1, seq += 1) {
    try {
      const [doc] = await Model.create([build(`${prefix}${pad(seq)}`)], session ? { session } : {});
      return doc;
    } catch (err) {
      if (!(err.code === 11000 && err.keyPattern?.[field])) throw err;
    }
  }
  throw new Error(`Không sinh được mã ${prefix}`);
}

const yearPrefix = (kind) => `${kind}-${localDate().slice(0, 4)}-`;

const utilityInvoiceCode = (buildingCode, roomNumber, monthYear) => {
  const clean = (v) => String(v || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  return `INV-UTIL-${clean(buildingCode)}-${clean(roomNumber)}-${String(monthYear).replace('-', '')}`;
};

module.exports = { createWithCode, yearPrefix, utilityInvoiceCode };

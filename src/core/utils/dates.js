/**
 * Ngày tháng nghiệp vụ theo giờ Việt Nam (UTC+7).
 * API.md §1.3: ngày chỉ có ngày là chuỗi `YYYY-MM-DD`, tháng là `YYYY-MM`.
 * ⚠️ Không cắt `toISOString()` để lấy ngày: đó là giờ UTC, thao tác lúc 06:00 sáng ngày 10 sẽ ra ngày 09.
 */

const VN_OFFSET_MIN = 7 * 60;
const pad = (n) => String(n).padStart(2, '0');

/** Date (mặc định bây giờ) → "YYYY-MM-DD" theo giờ Việt Nam */
const localDate = (d = new Date()) => {
  const t = new Date(new Date(d).getTime() + VN_OFFSET_MIN * 60000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

/** "YYYY-MM" theo giờ Việt Nam */
const localMonth = (d = new Date()) => localDate(d).slice(0, 7);

const today = () => localDate();

/** "YYYY-MM-DD" + N ngày */
const addDays = (date, days) => {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

/** "YYYY-MM-DD" + N tháng (ngày 31 + 1 tháng tràn sang tháng sau như Date của JS) */
const addMonths = (date, months) => {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

/** "YYYY-MM" + N tháng */
const addMonthsToMonth = (monthYear, months) => addMonths(`${monthYear}-01`, months).slice(0, 7);

const isDateString = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

module.exports = { localDate, localMonth, today, addDays, addMonths, addMonthsToMonth, isDateString };

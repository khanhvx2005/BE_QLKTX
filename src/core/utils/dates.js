/**
 * Ngày tháng nghiệp vụ theo giờ Việt Nam (UTC+7).
 * Hỗ trợ số tháng nguyên lẫn lẻ (VD: 8.5 tháng = 8 tháng + 15 ngày cho CS3 Ninh Bình).
 */

const VN_OFFSET_MIN = 7 * 60;
const pad = (n) => String(n).padStart(2, '0');

const localDate = (d = new Date()) => {
  const t = new Date(new Date(d).getTime() + VN_OFFSET_MIN * 60000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

const localMonth = (d = new Date()) => localDate(d).slice(0, 7);

const today = () => localDate();

const addDays = (date, days) => {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

/** "YYYY-MM-DD" + N tháng (hỗ trợ cả 8.5 tháng -> 8 tháng + 15 ngày) */
const addMonths = (date, months) => {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  const wholeMonths = Math.floor(Number(months));
  const extraDays = Math.round((Number(months) - wholeMonths) * 30);
  const t = new Date(Date.UTC(y, m - 1 + wholeMonths, d + extraDays));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

const addMonthsToMonth = (monthYear, months) => addMonths(`${monthYear}-01`, months).slice(0, 7);

const isDateString = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

module.exports = { localDate, localMonth, today, addDays, addMonths, addMonthsToMonth, isDateString };

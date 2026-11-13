/**
 * Tác vụ định kỳ — bản v2 KHÔNG còn tác vụ nào (FE `docs/API.md` §6, §8).
 *
 * ⚠️ Đã gỡ ba job cũ, đừng thêm lại:
 *   - Đổi hợp đồng quá hạn sang `expired` và trả giường → sai: hợp đồng quá hạn vẫn giữ giường tới khi cán bộ thanh lý
 *     (BR-04 kiểm nợ lúc thanh lý). `expired` giờ suy ra lúc đọc (shared/views.contractStatusOf).
 *   - Đổi hóa đơn quá hạn sang `overdue` → sai: enum chỉ có unpaid|paid, mọi chỗ kiểm nợ lọc `unpaid` nên bỏ sót.
 *     Quá hạn chỉ là chữ đỏ cạnh hạn nộp ở FE.
 *   - Hủy giao dịch VNPay treo → v2 không còn VNPay.
 */

const logger = require('../logger/logger');

const startScheduler = () => {
  logger.info('[Cron] Bản v2 không có tác vụ định kỳ (trạng thái hết hạn tính lúc đọc).');
};

const runDailyTasks = async () => {};

module.exports = { startScheduler, runDailyTasks };

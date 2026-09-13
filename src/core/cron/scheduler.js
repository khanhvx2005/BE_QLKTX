/**
 * Trình lập lịch tác vụ nền tự động hàng ngày (Consolidated Daily Cron Job).
 * Tuân thủ theo 14-PHIEN-BAN-DON-GIAN-HOA.md §4.9 và 03-PHAN-TICH-NGHIEP-VU.md §6.
 *
 * Thực hiện 4 tác vụ bảo trì tự động hằng ngày lúc 00:05 (Asia/Ho_Chi_Minh):
 * 1. Chuyển các hợp đồng đến hạn kết thúc sang 'expired', kết thúc lưu trú và trả giường về 'available' (BR-28).
 * 2. Đánh dấu các hóa đơn quá hạn thanh toán sang 'overdue' (BR-56).
 * 3. Hủy các giao dịch thanh toán trực tuyến bị treo quá 30 phút sang 'expired' (BR-64).
 * 4. Đối soát và tự sửa chữa bất thường giữa trạng thái giường Bed và bản ghi Residency.
 */

const cron = require('node-cron');
const config = require('../config');
const Contract = require('../../modules/contracts/contract.model');
const Residency = require('../../modules/residencies/residency.model');
const Bed = require('../../modules/rooms/bed.model');
const Invoice = require('../../modules/fees/invoice.model');
const Payment = require('../../modules/payments/payment.model');

/**
 * Thực thi toàn bộ tác vụ bảo trì hằng ngày (Idempotent).
 */
async function runDailyTasks() {
  const startTime = Date.now();
  console.log('--------------------------------------------------');
  console.log('[CRON] ⏰ BẮT ĐẦU TÁC VỤ BẢO TRÌ TỰ ĐỘNG HẰNG NGÀY:', new Date().toISOString());

  const now = new Date();

  // 1. Tác vụ 1: Quét hợp đồng hết hạn -> chuyển 'expired', đóng Residency, giải phóng Bed (BR-28)
  const expiredContracts = await Contract.find({
    status: 'active',
    endDate: { $lt: now },
  });

  for (const contract of expiredContracts) {
    contract.status = 'expired';
    await contract.save();

    if (contract.residencyId) {
      const residency = await Residency.findById(contract.residencyId);
      if (residency && residency.status === 'active') {
        residency.status = 'ended';
        residency.endDate = now;
        await residency.save();

        if (residency.bedId) {
          await Bed.findByIdAndUpdate(residency.bedId, { status: 'available' });
        }
      }
    }
  }
  console.log(`[CRON] ✅ Đã xử lý hết hạn ${expiredContracts.length} hợp đồng & giải phóng giường tương ứng`);

  // 2. Tác vụ 2: Quét hóa đơn quá hạn thanh toán -> chuyển 'overdue' (BR-56)
  const overdueResult = await Invoice.updateMany(
    {
      status: { $in: ['unpaid', 'partial'] },
      dueDate: { $lt: now },
    },
    {
      status: 'overdue',
    }
  );
  console.log(`[CRON] ✅ Đã đánh dấu quá hạn ${overdueResult.modifiedCount} hóa đơn chưa đóng đủ`);

  // 3. Tác vụ 3: Quét giao dịch thanh toán online treo quá 30 phút -> chuyển 'expired' (BR-64)
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const expiredPayments = await Payment.updateMany(
    {
      status: 'pending',
      createdAt: { $lt: thirtyMinutesAgo },
    },
    {
      status: 'expired',
      note: 'Giao dịch hết hạn thanh toán tự động (quá 30 phút)',
    }
  );
  console.log(`[CRON] ✅ Đã đánh dấu hết hạn ${expiredPayments.modifiedCount} giao dịch online bị treo`);

  // 4. Tác vụ 4: Đối soát và tự phục hồi trạng thái giường bị lệch với Residency
  const occupiedBeds = await Bed.find({ status: 'occupied' });
  let reconciledBedsCount = 0;

  for (const bed of occupiedBeds) {
    const activeResidency = await Residency.findOne({
      bedId: bed._id,
      status: 'active',
    });

    if (!activeResidency) {
      // Giường ghi là occupied nhưng không có người ở thực tế -> Phục hồi về available
      bed.status = 'available';
      await bed.save();
      reconciledBedsCount++;
    }
  }

  if (reconciledBedsCount > 0) {
    console.log(`[CRON] ⚠️ Đã tự động phục hồi ${reconciledBedsCount} giường về available do không có lưu trú thực tế`);
  } else {
    console.log(`[CRON] ✅ Đối soát trạng thái giường hoàn toàn chính xác`);
  }

  const duration = Date.now() - startTime;
  console.log(`[CRON] 🎉 HOÀN TẤT TÁC VỤ BẢO TRÌ (Thời gian thực thi: ${duration}ms)`);
  console.log('--------------------------------------------------');

  return {
    expiredContracts: expiredContracts.length,
    overdueInvoices: overdueResult.modifiedCount,
    expiredPayments: expiredPayments.modifiedCount,
    reconciledBeds: reconciledBedsCount,
    duration,
  };
}

/**
 * Khởi tạo tiến trình Cron Job.
 * Chỉ kích hoạt khi ENABLE_CRON=true để tránh chạy trùng khi deploy nhiều instance (14-PHIEN-BAN-DON-GIAN-HOA.md).
 */
function startScheduler() {
  const isCronEnabled = config.scheduler.enableCron || process.env.ENABLE_CRON === 'true';

  if (!isCronEnabled) {
    console.log('[CRON] ⏸️ Lập lịch tự động bị tắt do ENABLE_CRON=false');
    return;
  }

  // Chạy lúc 00:05 mỗi ngày theo giờ Việt Nam
  cron.schedule('5 0 * * *', runDailyTasks, {
    timezone: config.scheduler.timezone || 'Asia/Ho_Chi_Minh',
  });

  console.log('[CRON] 🚀 Đã kích hoạt lịch trình tự động hàng ngày lúc 00:05 (Timezone: Asia/Ho_Chi_Minh)');
}

// Hỗ trợ chạy thủ công từ terminal: node src/core/cron/scheduler.js run-now
if (process.argv[2] === 'run-now') {
  const { connectDatabase } = require('../config/database');
  connectDatabase()
    .then(() => runDailyTasks())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[CRON] ❌ Lỗi thực thi tác vụ chạy ngay:', err);
      process.exit(1);
    });
}

module.exports = {
  startScheduler,
  runDailyTasks,
};

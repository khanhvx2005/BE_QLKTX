/**
 * Dịch vụ gửi email thông báo tự động (Nodemailer SMTP) cho KTX HaUI v3.0:
 * 1. Duyệt đơn & cấp tài khoản kèm hạn đóng phí 7 ngày (pending_payment)
 * 2. Từ chối đơn kèm lý do
 * 3. Xác nhận đã thanh toán & gửi mã QR Check-in nhận phòng (active)
 * 4. Thông báo hóa đơn điện nước hàng tháng cho toàn bộ thành viên trong phòng
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../logger/logger');

let transporter = null;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function getTransporter() {
  if (transporter) return transporter;
  const { host, port, user, pass } = config.smtp;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

async function sendMailSafe({ to, subject, html, tag }) {
  const mailer = getTransporter();
  if (!mailer || !to) {
    logger.warn(`[EMAIL:${tag}] Chưa cấu hình SMTP hoặc thiếu địa chỉ nhận — bỏ qua gửi tới ${to}`);
    return false;
  }
  try {
    const { fromName, from } = config.smtp;
    await mailer.sendMail({ from: `"${fromName}" <${from}>`, to, subject, html });
    logger.info(`[EMAIL:${tag}] Đã gửi email tới ${to}`);
    return true;
  } catch (err) {
    logger.error(`[EMAIL:${tag}] Gửi email thất bại tới ${to}:`, err);
    return false;
  }
}

async function sendAccountEmail({ to, studentName, studentCode, roomName, termName, paymentDeadline, isNewAccount = true }) {
  const { frontendUrl } = config.smtp;
  const accountBlock = isNewAccount
    ? `<div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:14px 18px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Tên đăng nhập (MSSV / Email):</strong> <code>${escapeHtml(studentCode)}</code></p>
        <p style="margin:4px 0;"><strong>Mật khẩu khởi tạo:</strong> <code>${escapeHtml(studentCode)}</code></p>
      </div>
      <p style="color:#dc2626;font-size:13px;"><em>* Bắt buộc đổi mật khẩu mới ở lần đăng nhập đầu tiên.</em></p>`
    : `<p>Vui lòng đăng nhập lại bằng tài khoản KTX hiện có của bạn (<strong>${escapeHtml(studentCode)}</strong>).</p>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#1e40af;color:#fff;padding:20px;text-align:center;">
        <h2 style="margin:0;font-size:18px;">TRƯỜNG ĐẠI HỌC CÔNG NGHIỆP HÀ NỘI</h2>
        <p style="margin:4px 0 0;font-size:13px;">TRUNG TÂM HỖ TRỢ SINH VIÊN — KÝ TÚC XÁ HaUI</p>
      </div>
      <div style="padding:24px;color:#1e293b;line-height:1.6;">
        <p>Xin chào <strong>${escapeHtml(studentName)}</strong>,</p>
        <p>Đơn đăng ký KTX HaUI của bạn đã được <strong>PHÊ DUYỆT & GIỮ CHỖ TẠM THỜI</strong>.</p>
        <div style="background-color:#f8fafc;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>Phòng ở dự kiến:</strong> ${escapeHtml(roomName)}</p>
          <p style="margin:4px 0;"><strong>Gói thời hạn:</strong> ${escapeHtml(termName)}</p>
          <p style="margin:4px 0;"><strong>Hạn chót đóng tiền giữ chỗ:</strong> <strong style="color:#dc2626;">${escapeHtml(paymentDeadline || '7 ngày')}</strong></p>
        </div>
        ${accountBlock}
        <p>Vui lòng đăng nhập Cổng sinh viên để quét mã <strong>VietQR</strong> đóng tiền phòng và tiền cọc trước hạn. Nếu quá hạn chưa đóng phí, hệ thống sẽ hủy kết quả để nhường chỗ cho đợt bổ sung.</p>
        <div style="text-align:center;margin:20px 0;">
          <a href="${escapeHtml(frontendUrl)}/login" style="background-color:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Đăng nhập Cổng KTX</a>
        </div>
      </div>
    </div>`;
  return sendMailSafe({
    to,
    subject: `[HaUI - DMS] Phê duyệt giữ chỗ KTX & Hướng dẫn đóng phí (${studentCode})`,
    html,
    tag: 'APPROVE',
  });
}

async function sendRejectionEmail({ to, studentName, studentCode, contractCode, reason }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#991b1b;color:#fff;padding:20px;text-align:center;">
        <h2 style="margin:0;font-size:18px;">TRUNG TÂM KÝ TÚC XÁ ĐH CÔNG NGHIỆP HÀ NỘI</h2>
      </div>
      <div style="padding:24px;color:#1e293b;line-height:1.6;">
        <p>Xin chào <strong>${escapeHtml(studentName)}</strong> (MSSV: <strong>${escapeHtml(studentCode)}</strong>),</p>
        <p>Đơn đăng ký KTX mã <strong>${escapeHtml(contractCode)}</strong> chưa được phê duyệt.</p>
        <div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>Lý do:</strong> ${escapeHtml(reason)}</p>
        </div>
        <p>Bạn có thể bổ sung thông tin và nộp lại đơn nếu đợt đăng ký vẫn đang mở.</p>
      </div>
    </div>`;
  return sendMailSafe({
    to,
    subject: `[HaUI - DMS] Kết quả xét duyệt đơn KTX (${contractCode})`,
    html,
    tag: 'REJECT',
  });
}

async function sendCheckinReadyEmail({ to, studentName, studentCode, contractCode, roomName, checkinCode, officeLocation }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#15803d;color:#fff;padding:20px;text-align:center;">
        <h2 style="margin:0;font-size:18px;">XÁC NHẬN THANH TOÁN & MÃ QR NHẬN PHÒNG</h2>
      </div>
      <div style="padding:24px;color:#1e293b;line-height:1.6;">
        <p>Xin chào <strong>${escapeHtml(studentName)}</strong> (${escapeHtml(studentCode)}),</p>
        <p>Hợp đồng <strong>${escapeHtml(contractCode)}</strong> đã hoàn tất nghĩa vụ tài chính và chính thức có hiệu lực.</p>
        <div style="background-color:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:14px 18px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>Phòng ở:</strong> ${escapeHtml(roomName)}</p>
          <p style="margin:4px 0;"><strong>Mã QR Check-in:</strong> <code style="font-size:16px;color:#15803d;">${escapeHtml(checkinCode)}</code></p>
          <p style="margin:4px 0;"><strong>Địa điểm nhận phòng:</strong> ${escapeHtml(officeLocation || 'Văn phòng Trung tâm KTX')}</p>
        </div>
        <p>Vui lòng mở mã QR Check-in trong Cổng Sinh viên khi đến làm thủ tục nhận phòng (mang theo CCCD/Giấy báo nhập học & 02 ảnh 3x4).</p>
      </div>
    </div>`;
  return sendMailSafe({
    to,
    subject: `[HaUI - DMS] Đã kích hoạt hợp đồng & Mã QR nhận phòng (${contractCode})`,
    html,
    tag: 'CHECKIN_READY',
  });
}

async function sendUtilityBillEmail({ to, studentName, roomLabel, monthYear, totalAmount, perStudentAmount, dueDate, invoiceCode }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background-color:#0369a1;color:#fff;padding:18px;text-align:center;">
        <h2 style="margin:0;font-size:18px;">THÔNG BÁO TIỀN ĐIỆN NƯỚC PHÒNG ${escapeHtml(roomLabel)}</h2>
      </div>
      <div style="padding:22px;color:#1e293b;line-height:1.6;">
        <p>Xin chào <strong>${escapeHtml(studentName)}</strong>,</p>
        <p>Ban Quản lý KTX HaUI đã chốt chỉ số điện nước kỳ <strong>${escapeHtml(monthYear)}</strong> cho phòng <strong>${escapeHtml(roomLabel)}</strong>:</p>
        <ul>
          <li>Mã hóa đơn phòng: <strong>${escapeHtml(invoiceCode)}</strong></li>
          <li>Tổng tiền cả phòng: <strong>${Number(totalAmount).toLocaleString('vi-VN')} VNĐ</strong></li>
          <li>Mức chia bình quân tham khảo: <strong>${Number(perStudentAmount).toLocaleString('vi-VN')} VNĐ/bạn</strong></li>
          <li>Hạn thanh toán: <strong>${escapeHtml(dueDate)}</strong></li>
        </ul>
        <p>Một thành viên đại diện trong phòng vui lòng mở Cổng Sinh viên để quét mã <strong>VietQR</strong> gạch nợ tự động cho cả phòng.</p>
      </div>
    </div>`;
  return sendMailSafe({
    to,
    subject: `[HaUI - DMS] Tiền điện nước ${monthYear} — Phòng ${roomLabel} (${invoiceCode})`,
    html,
    tag: 'UTILITY',
  });
}

module.exports = {
  sendAccountEmail,
  sendRejectionEmail,
  sendCheckinReadyEmail,
  sendUtilityBillEmail,
};

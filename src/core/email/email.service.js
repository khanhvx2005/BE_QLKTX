/**
 * Dịch vụ gửi email thông báo hệ thống Ký túc xá HaUI
 * Hỗ trợ gửi qua SMTP (Gmail / Outlook / Custom SMTP)
 */

const nodemailer = require('nodemailer');
const logger = require('../logger/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Gửi email cấp tài khoản và thông báo kết quả duyệt KTX cho sinh viên
 */
async function sendAccountEmail({ to, studentName, studentCode, roomName, bedNumber, termName }) {
  const mailer = getTransporter();
  if (!mailer) {
    logger.warn(`[EMAIL] Chưa cấu hình SMTP_USER hoặc SMTP_PASS trong .env. Không thể gửi email tới ${to}`);
    return false;
  }

  try {
    const fromName = process.env.SMTP_FROM_NAME || 'Ký túc xá Đại học Công nghiệp Hà Nội (HaUI - DMS)';
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e40af; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">TRƯỜNG ĐẠI HỌC CÔNG NGHIỆP HÀ NỘI</h2>
          <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">BAN QUẢN LÝ KÝ TÚC XÁ</p>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p>Xin chào <strong>${studentName}</strong>,</p>
          <p>Đơn đăng ký nội trú Ký túc xá HaUI của bạn đã được <strong>PHÊ DUYỆT THÀNH CÔNG</strong>.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 4px 0;"><strong>🏢 Chỗ ở được phân bổ:</strong> ${roomName} - Giường số ${String(bedNumber).padStart(2, '0')}</p>
            <p style="margin: 4px 0;"><strong>📅 Gói thời hạn:</strong> ${termName || 'Học kỳ'}</p>
          </div>

          <p>Hệ thống đã tự động kích hoạt tài khoản Cổng dịch vụ KTX cho bạn với thông tin đăng nhập như sau:</p>
          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Tên đăng nhập (Email hoặc MSSV):</strong> <code style="color: #1e40af; font-size: 15px;">${studentCode}</code></p>
            <p style="margin: 4px 0;"><strong>Mật khẩu ban đầu:</strong> <code style="color: #1e40af; font-size: 15px;">${studentCode}</code></p>
          </div>

          <p style="color: #dc2626; font-size: 13px;"><em>* Lưu ý bắt buộc: Bạn phải đổi mật khẩu mới ở lần đăng nhập đầu tiên để bảo vệ tài khoản.</em></p>
          <p>Vui lòng đăng nhập vào cổng KTX để xem hợp đồng và thanh toán các hóa đơn tiếp nhận.</p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="http://localhost:5173/login" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Đăng nhập Cổng KTX</a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 12px 20px; text-align: center; font-size: 12px; color: #64748b;">
          Email tự động từ Hệ thống Quản lý Ký túc xá HaUI - DMS. Vui lòng không phản hồi email này.
        </div>
      </div>
    `;

    await mailer.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `[HaUI - DMS] Thông báo duyệt đơn KTX & Cấp tài khoản sinh viên (${studentCode})`,
      html,
    });

    logger.info(`[EMAIL] ✅ Đã gửi email thông báo duyệt đơn tới ${to}`);
    return true;
  } catch (err) {
    logger.error(`[EMAIL] ❌ Gửi email thất bại tới ${to}:`, err);
    return false;
  }
}

module.exports = {
  sendAccountEmail,
};

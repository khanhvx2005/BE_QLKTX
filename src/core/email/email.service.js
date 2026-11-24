/**
 * Dịch vụ gửi email thông báo hệ thống Ký túc xá HaUI (Nodemailer SMTP).
 * - Gửi thông báo phê duyệt đơn đăng ký KTX kèm tài khoản khởi tạo (FR-02, FR-32).
 * - Gửi thông báo từ chối đơn đăng ký kèm lý do chi tiết (FR-33).
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
 * Gửi email cấp tài khoản và thông báo kết quả phê duyệt đơn KTX cho sinh viên
 */
async function sendAccountEmail({ to, studentName, studentCode, roomName, bedNumber, termName }) {
  const mailer = getTransporter();
  if (!mailer || !to) {
    logger.warn(`[EMAIL] Chưa cấu hình SMTP_USER/SMTP_PASS trong .env — bỏ qua gửi email duyệt đơn tới ${to}`);
    return false;
  }

  try {
    const { fromName, from, frontendUrl } = config.smtp;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e40af; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">TRƯỜNG ĐẠI HỌC CÔNG NGHIỆP HÀ NỘI</h2>
          <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">BAN QUẢN LÝ KÝ TÚC XÁ</p>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p>Xin chào <strong>${escapeHtml(studentName)}</strong>,</p>
          <p>Đơn đăng ký nội trú Ký túc xá HaUI của bạn đã được <strong>PHÊ DUYỆT THÀNH CÔNG</strong>.</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 4px 0;"><strong>Chỗ ở được phân bổ:</strong> ${escapeHtml(roomName)} - Giường số ${String(bedNumber).padStart(2, '0')}</p>
            <p style="margin: 4px 0;"><strong>Gói thời hạn:</strong> ${escapeHtml(termName || 'Học kỳ')}</p>
          </div>
          <p>Hệ thống đã tự động kích hoạt tài khoản Cổng dịch vụ KTX cho bạn với thông tin đăng nhập:</p>
          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Tên đăng nhập (Email hoặc MSSV):</strong> <code style="color: #1e40af; font-size: 15px;">${escapeHtml(studentCode)}</code></p>
            <p style="margin: 4px 0;"><strong>Mật khẩu ban đầu:</strong> <code style="color: #1e40af; font-size: 15px;">${escapeHtml(studentCode)}</code></p>
          </div>
          <p style="color: #dc2626; font-size: 13px;"><em>* Lưu ý bắt buộc: Bạn phải đổi mật khẩu mới ở lần đăng nhập đầu tiên để bảo vệ tài khoản.</em></p>
          <p>Vui lòng đăng nhập vào cổng KTX để xem hợp đồng và thanh toán các hóa đơn tiếp nhận.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(frontendUrl)}/login" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Đăng nhập Cổng KTX</a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 12px 20px; text-align: center; font-size: 12px; color: #64748b;">
          Email tự động từ Hệ thống Quản lý Ký túc xá HaUI - DMS. Vui lòng không phản hồi email này.
        </div>
      </div>
    `;

    await mailer.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject: `[HaUI - DMS] Thông báo duyệt đơn KTX & Cấp tài khoản sinh viên (${studentCode})`,
      html,
    });

    logger.info(`[EMAIL] Đã gửi email thông báo duyệt đơn tới ${to}`);
    return true;
  } catch (err) {
    logger.error(`[EMAIL] Gửi email duyệt đơn thất bại tới ${to}:`, err);
    return false;
  }
}

/**
 * Gửi email thông báo từ chối đơn đăng ký KTX kèm lý do cho sinh viên
 */
async function sendRejectionEmail({ to, studentName, studentCode, contractCode, reason }) {
  const mailer = getTransporter();
  if (!mailer || !to) {
    logger.warn(`[EMAIL] Chưa cấu hình SMTP_USER/SMTP_PASS trong .env — bỏ qua gửi email từ chối tới ${to}`);
    return false;
  }

  try {
    const { fromName, from } = config.smtp;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #991b1b; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">TRƯỜNG ĐẠI HỌC CÔNG NGHIỆP HÀ NỘI</h2>
          <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">BAN QUẢN LÝ KÝ TÚC XÁ</p>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p>Xin chào <strong>${escapeHtml(studentName)}</strong> (MSSV: <strong>${escapeHtml(studentCode)}</strong>),</p>
          <p>Đơn đăng ký nội trú Ký túc xá mã <strong>${escapeHtml(contractCode)}</strong> của bạn chưa được phê duyệt.</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
            <p style="margin: 4px 0;"><strong>Lý do từ chối:</strong> ${escapeHtml(reason)}</p>
          </div>
          <p>Nếu cần bổ sung thông tin hoặc chọn lại phòng phù hợp, bạn có thể nộp lại đơn mới trên Cổng tiếp nhận KTX công khai hoặc liên hệ Ban Quản lý KTX để được hỗ trợ.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 12px 20px; text-align: center; font-size: 12px; color: #64748b;">
          Email tự động từ Hệ thống Quản lý Ký túc xá HaUI - DMS. Vui lòng không phản hồi email này.
        </div>
      </div>
    `;

    await mailer.sendMail({
      from: `"${fromName}" <${from}>`,
      to,
      subject: `[HaUI - DMS] Thông báo kết quả xét duyệt đơn KTX (${contractCode})`,
      html,
    });

    logger.info(`[EMAIL] Đã gửi email thông báo từ chối đơn tới ${to}`);
    return true;
  } catch (err) {
    logger.error(`[EMAIL] Gửi email từ chối đơn thất bại tới ${to}:`, err);
    return false;
  }
}

module.exports = {
  sendAccountEmail,
  sendRejectionEmail,
};

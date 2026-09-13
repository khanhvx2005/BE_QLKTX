/**
 * Tiện ích tích hợp Cổng thanh toán VNPay Sandbox.
 * Triển khai tạo URL thanh toán và xác thực chữ ký bảo mật HMAC-SHA512.
 * Tuân thủ theo 13-LO-TRINH-TRIEN-KHAI.md §3.2 (dòng 570-605) và 07-PHAN-QUYEN-BAO-MAT.md §5.
 */

const crypto = require('crypto');
const config = require('../../core/config');

/**
 * Sắp xếp các trường dữ liệu theo thứ tự bảng chữ cái alphabet (quy tắc bắt buộc của VNPay).
 */
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    if (obj[key] !== '' && obj[key] !== undefined && obj[key] !== null) {
      sorted[encodeURIComponent(key)] = encodeURIComponent(String(obj[key])).replace(/%20/g, '+');
    }
  }
  return sorted;
}

/**
 * Định dạng ngày giờ theo chuẩn YYYYMMDDHHmmss của VNPay.
 */
function formatDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
}

/**
 * Tạo URL chuyển hướng sang cổng thanh toán VNPay Sandbox.
 */
function createPaymentUrl({ transactionRef, amount, orderInfo, ipAddr = '127.0.0.1' }) {
  const tmnCode = config.payment.vnpay.tmnCode || 'DEMO_TMN';
  const hashSecret = config.payment.vnpay.hashSecret || 'DEMO_SECRET_KEY';
  const vnpUrl = config.payment.vnpay.url || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  const returnUrl = config.payment.vnpay.returnUrl || 'http://localhost:5173/portal/payment-result';

  const createDate = formatDate(new Date());

  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(amount * 100), // VNPay tính bằng đơn vị xu (nhân 100)
    vnp_CurrCode: 'VND',
    vnp_TxnRef: transactionRef,
    vnp_OrderInfo: orderInfo || `Thanh toan hoa don KTX ${transactionRef}`,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  const sortedParams = sortObject(vnpParams);
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(sortedParams)) {
    searchParams.append(key, value);
  }
  const signData = searchParams.toString();

  const hmac = crypto.createHmac('sha512', hashSecret);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  return `${vnpUrl}?${signData}&vnp_SecureHash=${signed}`;
}

/**
 * Ký dữ liệu tham số VNPay bằng thuật toán HMAC-SHA512.
 */
function signParams(params) {
  const hashSecret = config.payment.vnpay.hashSecret || 'SANDBOXSECRETKEYFORVNPAYKTX202612345';
  const cleanParams = { ...params };
  delete cleanParams.vnp_SecureHash;
  delete cleanParams.vnp_SecureHashType;

  const sortedParams = sortObject(cleanParams);
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(sortedParams)) {
    searchParams.append(key, value);
  }
  const signData = searchParams.toString();

  const hmac = crypto.createHmac('sha512', hashSecret);
  return hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
}

/**
 * Xác thực chữ ký số HMAC-SHA512 từ kết quả Return URL do VNPay trả về (BR-61, TC-103).
 */
function verifySignature(query) {
  const receivedHash = query.vnp_SecureHash;
  if (!receivedHash) {
    return false;
  }

  const expectedHash = signParams(query);
  return receivedHash.toLowerCase() === expectedHash.toLowerCase();
}

module.exports = {
  sortObject,
  signParams,
  createPaymentUrl,
  verifySignature,
};

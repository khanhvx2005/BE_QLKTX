/**
 * Tiện ích dùng chung cho route/service — giữ envelope và lỗi đúng `docs/API.md` (repo FE) §1.1, §1.2.
 */

const ApiError = require('../errors/api-error');
const ApiResponse = require('./response');

/**
 * Bọc handler: service trả `{ data, message?, status? }` → envelope `{ code: 'OK', message, data }`.
 * Lỗi ném ra (ApiError) đi tới error-handler như cũ.
 */
const respond = (fn) => async (req, res, next) => {
  try {
    const out = await fn(req);
    return ApiResponse.success(res, out?.data ?? null, out?.message ?? 'Thành công', out?.status ?? 200);
  } catch (err) {
    return next(err);
  }
};

/** 400 VALIDATION_ERROR kèm lỗi theo trường (FE gắn vào đúng ô nhập) */
const fieldErrors = (errors, message = 'Dữ liệu không hợp lệ') => {
  throw new ApiError(400, 'VALIDATION_ERROR', message, { errors });
};

/** Ném nếu có lỗi */
const assertNoErrors = (errors) => {
  if (errors.length) fieldErrors(errors);
};

const fail = (status, code, message, data = null) => {
  throw new ApiError(status, code, message, data);
};

/**
 * Phân trang trong bộ nhớ → `{ items, total, page, limit }` (API.md §1.2).
 * Dữ liệu KTX nhỏ (vài nghìn bản ghi) nên lọc/sắp ở tầng service cho đơn giản và đúng tuyệt đối với FE.
 * `limit` tối đa 100.
 */
const paginate = (rows, q = {}, extra = {}) => {
  const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
  const page = Math.max(Number(q.page) || 1, 1);
  return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit, ...extra };
};

/** Tìm không phân biệt hoa thường trên các trường (giá trị chuỗi) */
const matches = (term, values) => {
  const t = String(term || '').trim().toLowerCase();
  return !t || values.some((v) => String(v ?? '').toLowerCase().includes(t));
};

/** Id hợp lệ dạng ObjectId — id sai dạng coi như không tìm thấy (404) thay vì 400 */
const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));

module.exports = { respond, fieldErrors, assertNoErrors, fail, paginate, matches, isObjectId };

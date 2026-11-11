/**
 * Bộ tiện ích Cache (Redis + In-Memory Fallback) cho HaUI - DMS.
 * 
 * ============================================================================
 * [MỤC TIÊU VÀ NGUYÊN LÝ HOẠT ĐỘNG CHO TEAM 5]:
 * 1. Vì sao cần Cache?
 *    - Trong đợt cao điểm mở cổng KTX, hàng ngàn sinh viên truy cập đồng thời để
 *      xem danh sách phòng trống (FR-23), xem danh mục tòa nhà (FR-20) và Dashboard (FR-70).
 *    - Caching giúp giảm tải cho MongoDB tới 90%, thời gian phản hồi API chỉ ~1-5ms!
 * 2. Khi nào xóa Cache (Cache Invalidation)?
 *    - Khi cán bộ duyệt đơn (khóa giường) hoặc khi trả phòng (nhả giường): gọi `delByPattern('rooms:*')`.
 *    - Khi tạo/sửa thông tin tòa nhà: gọi `delByPattern('buildings:*')`.
 *    - Khi có giao dịch thanh toán: gọi `delByPattern('dashboard:*')`.
 * 3. Hỗ trợ team:
 *    - Cung cấp hàm `wrap(key, fetchFn, ttl)`: Tự động tra cache trước, nếu chưa có
 *      thì gọi `fetchFn()` từ CSDL, lưu cache rồi trả về. Cực kỳ tiện lợi và code gọn!
 * ============================================================================
 */

const { redisClient, isRedisConnected } = require('../config/redis');
const logger = require('../logger/logger');

// Bộ nhớ đệm RAM dự phòng khi máy tính của dev chưa bật Redis
const inMemoryCache = new Map();

/**
 * Lấy dữ liệu từ Cache
 * @param {string} key - Khóa cache (vd: 'rooms:available:male')
 * @returns {Promise<any|null>}
 */
const get = async (key) => {
  try {
    if (isRedisConnected() && redisClient) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    }

    // Fallback: In-Memory
    const record = inMemoryCache.get(key);
    if (!record) return null;

    // Kiểm tra hết hạn TTL của In-Memory
    if (record.expiresAt && Date.now() > record.expiresAt) {
      inMemoryCache.delete(key);
      return null;
    }
    return record.value;
  } catch (err) {
    logger.warn(`[Cache] Lỗi get key ${key}: ${err.message}`);
    return null;
  }
};

/**
 * Lưu dữ liệu vào Cache
 * @param {string} key - Khóa cache
 * @param {any} value - Dữ liệu cần lưu (Object, Array, Primitive)
 * @param {number} ttlSeconds - Thời gian sống tính bằng giây (Mặc định 300s = 5 phút)
 */
const set = async (key, value, ttlSeconds = 300) => {
  try {
    const serialized = JSON.stringify(value);

    if (isRedisConnected() && redisClient) {
      await redisClient.set(key, serialized, 'EX', ttlSeconds);
      return true;
    }

    // Fallback: In-Memory
    inMemoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  } catch (err) {
    logger.warn(`[Cache] Lỗi set key ${key}: ${err.message}`);
    return false;
  }
};

/**
 * Xóa 1 khóa cache cụ thể
 * @param {string} key
 */
const del = async (key) => {
  try {
    if (isRedisConnected() && redisClient) {
      await redisClient.del(key);
    }
    inMemoryCache.delete(key);
    return true;
  } catch (err) {
    logger.warn(`[Cache] Lỗi del key ${key}: ${err.message}`);
    return false;
  }
};

/**
 * Xóa cache theo tiền tố / biểu thức mẫu (Pattern)
 * Ví dụ: delByPattern('rooms:*') sẽ xóa mọi cache liên quan đến phòng
 * @param {string} pattern
 */
const delByPattern = async (pattern) => {
  try {
    if (isRedisConnected() && redisClient) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }

    // Xóa trong In-Memory
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    for (const key of inMemoryCache.keys()) {
      if (regex.test(key)) {
        inMemoryCache.delete(key);
      }
    }
    return true;
  } catch (err) {
    logger.warn(`[Cache] Lỗi delByPattern ${pattern}: ${err.message}`);
    return false;
  }
};

/**
 * Hàm bọc tiện lợi (Cache-Aside Pattern):
 * Tra cứu trong Cache, nếu trúng (Cache Hit) thì trả về ngay.
 * Nếu trượt (Cache Miss), thực thi hàm `fetchFn()`, ghi vào Cache rồi trả về.
 * 
 * @example
 * const rooms = await cache.wrap('rooms:available:male', () => Room.find(...), 300);
 */
const wrap = async (key, fetchFn, ttlSeconds = 300) => {
  const cached = await get(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  // Thực thi hàm lấy dữ liệu từ DB
  const freshData = await fetchFn();

  // Lưu vào cache bất đồng bộ (không chặn response)
  if (freshData !== null && freshData !== undefined) {
    set(key, freshData, ttlSeconds).catch(() => {});
  }

  return freshData;
};

module.exports = {
  get,
  set,
  del,
  delByPattern,
  wrap,
};


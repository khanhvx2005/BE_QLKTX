/**
 * Controller cho Module Supplies (Nhu yếu phẩm).
 * Tiếp nhận request HTTP cho các endpoint quản trị và cán bộ.
 * Tuân thủ theo API.md §11.
 */

const supplyService = require('./supply.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

/**
 * GET /api/supply-items
 */
const getSupplyItems = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await supplyService.getSupplyItems(query);
  return ApiResponse.paginate(
    res,
    result.items,
    result.total,
    result.page,
    result.limit,
    'Lấy danh mục vật phẩm thành công'
  );
});

/**
 * POST /api/supply-items
 */
const createSupplyItem = asyncHandler(async (req, res) => {
  const result = await supplyService.createSupplyItem(req.body);
  return ApiResponse.success(res, result, 'Tạo vật phẩm mới thành công', 201);
});

/**
 * PUT /api/supply-items/:id
 */
const updateSupplyItem = asyncHandler(async (req, res) => {
  const result = await supplyService.updateSupplyItem(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật vật phẩm thành công');
});

/**
 * GET /api/supply-orders
 */
const getSupplyOrders = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await supplyService.getSupplyOrders(query);

  return res.status(200).json({
    code: 'OK',
    message: 'Lấy danh sách đơn hàng thành công',
    data: {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      summary: result.summary,
    },
  });
});

/**
 * GET /api/supply-orders/:id
 */
const getSupplyOrderById = asyncHandler(async (req, res) => {
  const result = await supplyService.getSupplyOrderById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy chi tiết đơn hàng thành công');
});

/**
 * PATCH /api/supply-orders/:id/deliver
 */
const deliverSupplyOrder = asyncHandler(async (req, res) => {
  const result = await supplyService.deliverSupplyOrder(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'Bàn giao nhu yếu phẩm cho sinh viên thành công');
});

/**
 * PATCH /api/supply-orders/:id/cancel
 */
const cancelSupplyOrder = asyncHandler(async (req, res) => {
  const result = await supplyService.cancelSupplyOrder(req.params.id, req.body.cancelReason);
  return ApiResponse.success(res, result, 'Hủy đơn hàng thành công');
});

module.exports = {
  getSupplyItems,
  createSupplyItem,
  updateSupplyItem,
  getSupplyOrders,
  getSupplyOrderById,
  deliverSupplyOrder,
  cancelSupplyOrder,
};

/**
 * Controller cho Module Students.
 * Tiếp nhận request HTTP, gọi service và trả về ApiResponse envelope chuẩn.
 */

const studentService = require('./student.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

const getStudents = asyncHandler(async (req, res) => {
  const result = await studentService.getStudents(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách sinh viên thành công');
});

const getStudentById = asyncHandler(async (req, res) => {
  const result = await studentService.getStudentById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy thông tin sinh viên thành công');
});

const createStudent = asyncHandler(async (req, res) => {
  const result = await studentService.createStudent(req.body);
  return ApiResponse.success(res, result, 'Thêm sinh viên thành công', 201);
});

const updateStudent = asyncHandler(async (req, res) => {
  const result = await studentService.updateStudent(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật thông tin sinh viên thành công');
});

const deactivateStudent = asyncHandler(async (req, res) => {
  const result = await studentService.deactivateStudent(req.params.id);
  return ApiResponse.success(res, result, 'Đã vô hiệu hóa hồ sơ sinh viên');
});

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deactivateStudent,
};

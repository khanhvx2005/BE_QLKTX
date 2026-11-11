/**
 * Controller cho Module Students (Hồ sơ Sinh viên HaUI).
 */

const studentService = require('./student.service');
const ApiResponse = require('../../core/utils/response');
const asyncHandler = require('../../core/utils/async-handler');

// 1. Danh sách sinh viên (FR-10)
const getStudents = asyncHandler(async (req, res) => {
  const result = await studentService.getStudents(req.query);
  return ApiResponse.success(res, result, 'Lấy danh sách sinh viên thành công');
});

// 2. Chi tiết sinh viên (FR-11)
const getStudentById = asyncHandler(async (req, res) => {
  const result = await studentService.getStudentById(req.params.id);
  return ApiResponse.success(res, result, 'Lấy thông tin sinh viên thành công');
});

// 3. Thêm mới sinh viên thủ công (FR-12)
const createStudent = asyncHandler(async (req, res) => {
  const result = await studentService.createStudent(req.body);
  return ApiResponse.success(res, result, 'Thêm sinh viên thành công', 201);
});

// 4. Nhập sinh viên hàng loạt từ Excel (FR-12b)
const importStudentsBatch = asyncHandler(async (req, res) => {
  const result = await studentService.importStudentsBatch(req.body.students || req.body);
  return ApiResponse.success(res, result, 'Nhập danh sách sinh viên hoàn tất');
});

// 5. Cập nhật hồ sơ sinh viên (FR-13)
const updateStudent = asyncHandler(async (req, res) => {
  const result = await studentService.updateStudent(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Cập nhật thông tin sinh viên thành công');
});

// 6. Vô hiệu hóa sinh viên (FR-14)
const disableStudent = asyncHandler(async (req, res) => {
  const result = await studentService.disableStudent(req.params.id);
  return ApiResponse.success(res, result, 'Đã vô hiệu hóa hồ sơ sinh viên');
});

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  importStudentsBatch,
  updateStudent,
  disableStudent,
};

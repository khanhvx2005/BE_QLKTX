/**
 * Router định tuyến cho Module Students.
 * Khai báo các endpoint theo hợp đồng API.md §3.
 */

const express = require('express');
const router = express.Router();

const studentController = require('./student.controller');
const { createStudentSchema, updateStudentSchema, queryStudentSchema } = require('./student.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

// Mọi route của sinh viên đều yêu cầu đăng nhập
router.use(authenticate);

// 1. Danh sách / tìm kiếm sinh viên (admin, staff, viewer)
router.get('/', authorize('admin', 'staff', 'viewer'), validate(queryStudentSchema, 'query'), studentController.getStudents);

// 2. Lấy chi tiết 1 sinh viên (admin, staff, viewer)
router.get('/:id', authorize('admin', 'staff', 'viewer'), studentController.getStudentById);

// 3. Tạo hồ sơ sinh viên (admin, staff)
router.post('/', authorize('admin', 'staff'), validate(createStudentSchema), studentController.createStudent);

// 4. Cập nhật thông tin sinh viên (admin, staff)
router.put('/:id', authorize('admin', 'staff'), validate(updateStudentSchema), studentController.updateStudent);

// 5. Vô hiệu hóa sinh viên / Soft delete (admin, staff)
router.patch('/:id/deactivate', authorize('admin', 'staff'), studentController.deactivateStudent);

module.exports = router;

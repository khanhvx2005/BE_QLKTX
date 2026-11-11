/**
 * Router định tuyến cho Module Students (Hồ sơ Sinh viên HaUI).
 * Tuân thủ theo EDIT_DOCS_DAC_TA_YEU_CAU.md §3.2.
 */

const express = require('express');
const router = express.Router();

const studentController = require('./student.controller');
const {
  createStudentSchema,
  updateStudentSchema,
  queryStudentSchema,
} = require('./student.validation');
const validate = require('../../core/middlewares/validate');
const { authenticate, authorize } = require('../../core/middlewares/auth');

router.use(authenticate);

// Danh sách sinh viên (FR-10)
router.get('/', authorize('admin', 'staff'), validate(queryStudentSchema, 'query'), studentController.getStudents);

// Chi tiết 1 sinh viên (FR-11)
router.get('/:id', authorize('admin', 'staff'), studentController.getStudentById);

// Thêm sinh viên thủ công (FR-12)
router.post('/', authorize('admin', 'staff'), validate(createStudentSchema), studentController.createStudent);

// Nhập sinh viên hàng loạt từ Excel (FR-12b)
router.post('/import-excel', authorize('admin', 'staff'), studentController.importStudentsBatch);

// Cập nhật sinh viên (FR-13)
router.put('/:id', authorize('admin', 'staff'), validate(updateStudentSchema), studentController.updateStudent);

// Vô hiệu hóa sinh viên (FR-14)
router.patch('/:id/status', authorize('admin', 'staff'), studentController.disableStudent);

module.exports = router;

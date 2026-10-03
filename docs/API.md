# API Reference — HaUI Dormitory Management System (DMS)

**Đơn vị áp dụng:** Trường Đại học Công nghiệp Hà Nội (HaUI)  
**Phiên bản:** 2.2 (Chuẩn hóa thực tế & Tự động cấp tài khoản qua Email)  
**Base URL:** `/api`  
**Xác thực:** JWT Bearer Token (`Authorization: Bearer <token>`)

---

## 1. Quy ước chung

### 1.1. Chuẩn phản hồi (Response Envelope)
```json
// Thành công
{ "code": "OK", "message": "Thành công", "data": { ... } }

// Lỗi
{ "code": "ERROR_CODE", "message": "Thông báo lỗi tiếng Việt", "data": null }
```

### 1.2. Phân trang
```json
{ "items": [ ... ], "total": 120, "page": 1, "limit": 20 }
```

### 1.3. Ma trận vai trò (Roles Legend)
- `admin`: System Administrator (Quản trị hệ thống, toàn quyền kỹ thuật).
- `manager`: Manager (Trưởng Ban quản lý KTX, phê duyệt chính sách, duyệt trúng tuyển, duyệt quyết toán, xem báo cáo).
- `staff`: Staff (Cán bộ KTX vận hành & hỗ trợ, quản lý phòng/giường, chốt điện nước, quét QR checkin, điều phối sửa chữa, chat hỗ trợ).
- `student`: Student (Sinh viên HaUI).

---

## 2. Danh mục API chi tiết theo phân hệ

### 2.1. Xác thực & Tài khoản (`/api/auth`, `/api/users`)
> *Ghi chú:* Hệ thống **không có form đăng ký tài khoản tự do**. Tài khoản sinh viên được hệ thống tự động sinh khi trúng tuyển KTX và gửi thông tin qua Email.
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Đăng nhập (email/MSSV + mật khẩu) |
| POST | `/api/auth/logout` | Authenticated | Đăng xuất |
| GET | `/api/auth/me` | Authenticated | Lấy thông tin tài khoản hiện tại |
| PATCH | `/api/auth/change-password` | Authenticated | Đổi mật khẩu (cưỡng bức ở lần đăng nhập đầu nếu `mustChangePassword == true`) |
| GET | `/api/users` | Admin | Quản lý danh sách người dùng |
| POST | `/api/users/:id/reset-password` | Admin, Manager | Cấp lại mật khẩu tạm thời cho người dùng (tự động gửi email) |

---

### 2.2. Cơ cấu không gian (`/api/campuses`, `/api/buildings`, `/api/rooms`, `/api/beds`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET/POST | `/api/campuses` | Admin, Manager | Danh sách / Tạo mới Cơ sở (CS1, CS2, CS3) |
| GET/POST/PUT | `/api/buildings` | Admin, Manager | Quản lý tòa nhà KTX theo cơ sở |
| GET | `/api/rooms` | Admin, Manager, Staff | Danh sách phòng: lọc theo cơ sở, tòa, tầng, giới tính, loại phòng |
| POST | `/api/rooms` | Admin, Manager | Tạo phòng mới: tự sinh `capacity` giường |
| GET | `/api/rooms/:id` | Authenticated | Chi tiết phòng, danh sách giường và sinh viên đang ở |
| GET | `/api/rooms/available` | Authenticated | Tra cứu phòng còn giường trống (được Cache bằng Redis) |
| PATCH | `/api/beds/:id/status` | Admin, Manager, Staff | Chuyển trạng thái giường sang bảo trì (`maintenance`) hoặc mở lại |

---

### 2.3. Năm học & Đợt đăng ký (`/api/academic-years`, `/api/registration-periods`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET/POST | `/api/academic-years` | Admin, Manager | Quản lý năm học (VD: `2026-2027`) |
| GET | `/api/registration-periods` | Public | Danh sách các đợt đăng ký KTX công khai |
| POST | `/api/registration-periods` | Admin, Manager | Mở đợt đăng ký mới theo năm học và cơ sở |
| PATCH | `/api/registration-periods/:id/status`| Admin, Manager | Đóng/mở cổng nhận đơn |

---

### 2.4. Đơn đăng ký KTX, Hàng đợi Queue & Cấp tài khoản (`/api/applications`, `/api/portal`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/portal/apply-public` | Public | **Sinh viên nộp đơn online công khai** trong đợt mở (đẩy vào Redis Queue chống nghẽn, tự gửi email xác nhận; hỗ trợ khai báo `hasHealthCondition` để tự động ưu tiên giường tầng dưới) |
| GET | `/api/portal/apply/queue-status/:ticketId` | Public | Tra cứu trạng thái xử lý đơn trong hàng đợi |
| GET | `/api/portal/application-result` | Public | Tra cứu kết quả xét duyệt KTX bằng MSSV (`?studentCode=...`) |
| GET | `/api/applications` | Admin, Manager, Staff | Danh sách đơn đăng ký: lọc theo đợt, cơ sở, diện ưu tiên, trạng thái |
| GET | `/api/applications/:id` | Admin, Manager, Staff | Chi tiết đơn kèm ảnh minh chứng ưu tiên |
| POST | `/api/applications/:id/approve` | Admin, Manager | **Duyệt trúng tuyển:** Gán `bedId` trống → Tự động sinh HĐ, Hóa đơn ban đầu, sinh Tài khoản (`mustChangePassword: true`) và **gửi Email trúng tuyển kèm mật khẩu tạm** |
| POST | `/api/applications/:id/reject` | Admin, Manager | **Từ chối đơn:** Nhập lý do từ chối → Tự động gửi Email thông báo kết quả |

---

### 2.5. Hồ sơ sinh viên (`/api/students`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/students` | Admin, Manager, Staff | Danh sách sinh viên: lọc theo MSSV, tên, lớp, khoa, diện ưu tiên, trạng thái học tập (`studying`, `graduated`) |
| POST/PUT | `/api/students` | Admin, Manager, Staff | Thêm mới / Cập nhật hồ sơ sinh viên |
| GET | `/api/students/:id` | Admin, Manager, Staff | Chi tiết hồ sơ: lịch sử hợp đồng, hóa đơn, vi phạm |

---

### 2.6. Hợp đồng & Check-in QR (`/api/contracts`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/contracts` | Admin, Manager, Staff | Danh sách hợp đồng: lọc theo trạng thái, năm học, tòa nhà |
| GET | `/api/contracts/:id` | Authenticated | Chi tiết hợp đồng, thông tin giường, tiền cọc, công nợ |
| GET | `/api/portal/my-qr-checkin` | Student | Lấy mã QR Check-in nhận phòng trên điện thoại |
| POST | `/api/contracts/qr-checkin` | Admin, Manager, Staff | Quét mã QR của sinh viên để xác nhận nhận phòng và bàn giao giường |
| POST | `/api/contracts/:id/terminate` | Admin, Manager | Chấm dứt hợp đồng sớm / Trả phòng |

---

### 2.7. Điện nước, Hóa đơn & VietQR (`/api/utility-readings`, `/api/invoices`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/utility-readings` | Admin, Manager, Staff | Bảng danh sách chỉ số điện nước theo tháng của từng phòng |
| POST | `/api/utility-readings/batch` | Admin, Manager, Staff | Nhập chỉ số điện nước hàng loạt cho cả Tòa/Tầng |
| POST | `/api/invoices/generate-utility` | Admin, Manager | Sinh hóa đơn điện nước tháng cho tất cả sinh viên trong phòng (chia đều chính xác) |
| GET | `/api/invoices` | Admin, Manager, Staff | Quản lý danh sách hóa đơn: lọc theo trạng thái, kỳ thanh toán, tòa nhà |
| GET | `/api/invoices/:id` | Authenticated | Chi tiết hóa đơn: dòng chi phí, lịch sử thanh toán |
| GET | `/api/invoices/:id/vietqr` | Authenticated | Tạo mã VietQR động nhúng sẵn số tiền và nội dung hóa đơn để quét thanh toán |
| PATCH | `/api/invoices/:id/cancel` | Admin, Manager | Hủy hóa đơn lập sai (khi chưa phát sinh thanh toán) |

---

### 2.8. Thanh toán (`/api/payments`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/payments/offline` | Admin, Manager, Staff | Ghi nhận thu tiền tại quầy (tiền mặt / chuyển khoản) |
| POST | `/api/payments/online/checkout` | Student | Tạo phiên thanh toán VNPay/ZaloPay |
| POST | `/api/payments/webhook/vnpay` | Payment Gateway | Webhook nhận kết quả giao dịch (xử lý bất đồng bộ qua Queue) |
| GET | `/api/payments` | Admin, Manager | Lịch sử các giao dịch thu chi và hoàn cọc |

---

### 2.9. Đơn phát sinh: Chuyển phòng, Trả phòng, Báo hỏng (`/api/requests`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/requests` | Admin, Manager, Staff | Danh sách đơn: lọc theo loại (`transfer`, `checkout`, `repair`) và trạng thái |
| POST | `/api/requests/:id/approve-transfer`| Admin, Manager | Duyệt chuyển phòng: gán giường mới, giải phóng giường cũ, tính bù trừ chênh lệch giá |
| POST | `/api/requests/:id/approve-checkout`| Admin, Manager | Duyệt trả phòng: kiểm kê tài sản, quyết toán cọc, hoàn tiền, cấp xác nhận không nợ |
| PATCH | `/api/requests/:id/repair-status` | Admin, Manager, Staff | Cập nhật tiến độ sửa chữa: `pending → approved → completed` |
| POST | `/api/requests/:id/reject` | Admin, Manager | Từ chối yêu cầu kèm lý do |

---

### 2.10. Kênh Chat hỗ trợ trực tuyến (`/api/chat` + Socket.io)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/chat/conversations` | Admin, Manager, Staff | Danh sách các cuộc hội thoại của sinh viên cần hỗ trợ |
| GET | `/api/chat/conversations/me` | Student | Lấy thông tin cuộc hội thoại của sinh viên với Ban quản lý |
| GET | `/api/chat/conversations/:id/messages` | Authenticated | Lấy danh sách tin nhắn trong cuộc hội thoại (phân trang) |
| POST | `/api/chat/conversations/:id/messages` | Authenticated | Gửi tin nhắn / hình ảnh đính kèm (sự kiện `new_message` qua Socket) |

---

### 2.11. Thông báo & Bảng tin KTX (`/api/notifications`, `/api/announcements`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/notifications` | Authenticated | Lấy danh sách thông báo cá nhân (phân trang, đếm số chưa đọc) |
| PATCH | `/api/notifications/:id/read` | Authenticated | Đánh dấu thông báo đã đọc |
| PATCH | `/api/notifications/read-all` | Authenticated | Đánh dấu tất cả thông báo là đã đọc |
| GET | `/api/announcements` | Authenticated | Xem bảng tin nội bộ KTX (lọc theo cơ sở, mức độ ưu tiên) |
| POST | `/api/announcements` | Admin, Manager, Staff | Đăng bài thông báo mới lên bảng tin KTX |

---

### 2.12. Vi phạm nội quy KTX (`/api/violations`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/violations` | Admin, Manager, Staff | Danh sách biên bản vi phạm KTX |
| POST | `/api/violations` | Admin, Manager, Staff | Lập biên bản vi phạm: ghi nhận sinh viên, hành vi, tiền phạt, điểm KTX bị trừ |
| GET | `/api/violations/student/:studentId` | Authenticated | Tra cứu lịch sử vi phạm của một sinh viên |

---

### 2.13. Cổng sinh viên (`/api/portal/*`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/portal/my-residence` | Student | Xem thông tin chỗ ở hiện tại: phòng, giường, danh sách bạn cùng phòng |
| GET | `/api/portal/my-contracts` | Student | Xem hợp đồng hiện tại và lịch sử các năm học trước |
| GET | `/api/portal/my-invoices` | Student | Danh sách hóa đơn của bản thân kèm mã VietQR quét thanh toán |
| POST | `/api/portal/requests` | Student | Gửi đơn: Xin chuyển phòng, Xin trả phòng, Báo hỏng thiết bị |
| GET | `/api/portal/my-requests` | Student | Danh sách các đơn yêu cầu đã gửi và phản hồi từ cán bộ |
| GET | `/api/portal/my-violations` | Student | Xem các biên bản vi phạm nội quy của bản thân |

---

### 2.14. Dashboard & Thống kê (`/api/dashboard`)
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/dashboard/occupancy` | Admin, Manager, Staff | Thống kê số giường: tổng, đang ở, còn trống, bảo trì, tỷ lệ lấp đầy theo từng cơ sở (Redis cached) |
| GET | `/api/dashboard/finance` | Admin, Manager | Thống kê tổng công nợ, số hóa đơn quá hạn chưa thu |
| GET | `/api/dashboard/summary` | Admin, Manager, Staff | Tổng quan số sinh viên nội trú, số đơn chờ duyệt, số phòng cần chốt điện nước |

# Data Schema — HaUI Dormitory Management System (DMS)

**Đơn vị áp dụng:** Trường Đại học Công nghiệp Hà Nội (HaUI)  
**Phiên bản:** 2.3 (MongoDB + Mongoose ODM + Redis Cache & Queue + Health Accessibility)  
**Quy ước ngôn ngữ:** 100% tên trường (Field name), Enum và Mã định danh chuẩn hóa bằng **Tiếng Anh**.

---

## 1. Quy ước dữ liệu (Data Conventions)

- **Primary key:** `_id` (ObjectId mặc định của MongoDB).
- **Quan hệ (References):** `mongoose.Schema.Types.ObjectId` kèm `ref: '<Model>'`.
- **Dấu vết thời gian (Timestamps):** Tự động với `{ timestamps: true }` (`createdAt`, `updatedAt`).
- **Xóa mềm & Bảo toàn lịch sử:** Sử dụng `status` hoặc `isActive`. Không bao giờ xóa cứng dữ liệu sinh viên, hợp đồng, hóa đơn để phục vụ đối soát tài chính và báo cáo thống kê.
- **Tiền tệ:** Số nguyên **VND** (không có phần thập phân).
- **Quy ước Enum:** Toàn bộ giá trị enum viết bằng **chữ thường (lowercase)**, tập trung tại `shared/constants/enums.js`.
- **Phân quyền 4 vai trò:** `admin` (quản trị hệ thống), `manager` (quản lý KTX), `staff` (cán bộ vận hành & hỗ trợ), `student` (sinh viên).
- **Ưu tiên thể chất (Accessibility):** Giường tầng phân định `position: 'lower' | 'upper'`. Sinh viên có vấn đề thể chất được tự động ưu tiên gán giường tầng dưới.
- **Redis Cache & Queue:**
  - Cache các key đọc nhiều: `rooms:available:campus:{id}`, `academic-years:current`.
  - Hàng đợi BullMQ: `queue:dorm-application` (xử lý đơn nộp cao điểm), `queue:payment-webhook` (xử lý webhook thanh toán).

---

## 2. Danh mục 19 Collection trong CSDL

### 2.1. Phân hệ Cơ cấu không gian (Cơ sở → Tòa → Phòng → Giường)

#### `Campus` — `modules/rooms/campus.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `code` | String | Mã cơ sở (`CS1`, `CS2`, `CS3`), unique, required |
| `name` | String | Tên cơ sở (VD: `Cơ sở 1 - Bắc Từ Liêm`), required |
| `address` | String | Địa chỉ thực tế |

#### `Building` — `modules/rooms/building.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `campusId` | ObjectId ref `Campus` | Cơ sở trực thuộc, required |
| `code` | String | Mã tòa nhà (VD: `A1`, `B1`), required |
| `name` | String | Tên hiển thị (VD: `Ký túc xá A1`), required |
| `totalFloors` | Number | Tổng số tầng của tòa nhà |
| `hasElevator` | Boolean | Tòa nhà có thang máy không, default `false` |
| `description` | String | Mô tả |
*Index:* `{ campusId: 1, code: 1 }` unique compound.

#### `Room` — `modules/rooms/room.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `buildingId` | ObjectId ref `Building` | Tòa nhà trực thuộc, required |
| `roomNumber` | String | Số phòng (VD: `302`, `405`), required |
| `floor` | Number | Tầng (VD: `1`, `2`, `3`), required |
| `gender` | String (enum) | `male`, `female`, required |
| `roomType` | String (enum) | `four_beds`, `six_beds`, `eight_beds`, required |
| `hasAirConditioner`| Boolean | `true` (có điều hòa), `false` (phòng quạt), default `false` |
| `capacity` | Number | Sức chứa tối đa (bằng số giường: 4, 6 hoặc 8), required |
| `pricePerMonth` | Number | Đơn giá thuê 1 tháng của 1 sinh viên (VND), required |
| `status` | String (enum) | `active`, `maintenance`, default `active` |
*Index:* `{ buildingId: 1, roomNumber: 1 }` unique compound.

#### `Bed` — `modules/rooms/bed.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `roomId` | ObjectId ref `Room` | Phòng trực thuộc, required |
| `bedCode` | String | Mã giường (VD: `P302-G01D`, `P302-G01T`), required |
| `position` | String (enum) | `lower` (tầng dưới), `upper` (tầng trên), required, default `lower` |
| `status` | String (enum) | `available`, `occupied`, `maintenance`, default `available` |
| `note` | String | Ghi chú tình trạng thiết bị |
*Index:* `{ roomId: 1, bedCode: 1 }` unique compound.

---

### 2.2. Phân hệ Năm học & Đợt đăng ký

#### `AcademicYear` — `modules/periods/academic-year.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `name` | String | Tên năm học (VD: `2026-2027`), unique, required |
| `startDate` | Date | Ngày bắt đầu năm học |
| `endDate` | Date | Ngày kết thúc năm học |
| `isCurrent` | Boolean | `true` nếu là năm học hiện tại, default `false` |

#### `RegistrationPeriod` — `modules/periods/registration-period.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `academicYearId` | ObjectId ref `AcademicYear` | Năm học, required |
| `campusId` | ObjectId ref `Campus` | Cơ sở áp dụng, required |
| `name` | String | Tên đợt (VD: `Đăng ký KTX K19 Cơ sở Hà Nam Đợt 1`), required |
| `startDate` | Date | Thời điểm mở cổng nhận đơn, required |
| `endDate` | Date | Thời điểm khóa cổng nhận đơn, required |
| `status` | String (enum) | `upcoming`, `open`, `closed`, default `upcoming` |

---

### 2.3. Phân hệ Sinh viên & Đơn đăng ký

#### `Student` — `modules/students/student.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `userId` | ObjectId ref `User` | Tài khoản đăng nhập (unique, sparse) |
| `studentCode` | String | Mã sinh viên (MSSV), unique, required |
| `fullName` | String | Họ và tên, required |
| `gender` | String (enum) | `male`, `female`, required |
| `dob` | Date | Ngày tháng năm sinh |
| `phone` | String | Số điện thoại liên hệ, required |
| `email` | String | Email sinh viên |
| `faculty` | String | Khoa/Viện đào tạo |
| `className` | String | Lớp sinh hoạt |
| `priorityType` | String (enum) | `policy_family`, `poor_household`, `remote_area`, `normal`, default `normal` |
| `status` | String (enum) | `studying`, `graduated`, `dropped_out`, default `studying` |
| `emergencyContact` | Object | `{ name, phone, relationship }` |
*Index:* `{ studentCode: 1 }` unique, `{ fullName: 'text' }`.

#### `Application` — `modules/applications/application.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `periodId` | ObjectId ref `RegistrationPeriod` | Đợt đăng ký, required |
| `studentId` | ObjectId ref `Student` | Sinh viên nộp đơn, required |
| `campusId` | ObjectId ref `Campus` | Cơ sở đăng ký, required |
| `preferredRoomType`| String (enum) | `four_beds`, `six_beds`, `eight_beds` |
| `preferredAirConditioner` | Boolean | Nguyện vọng phòng điều hòa hay quạt |
| `priorityEvidenceUrl` | String | Link ảnh minh chứng diện ưu tiên chính sách |
| `hasHealthCondition` | Boolean | `true` nếu có vấn đề sức khỏe/vận động cần giường dưới, default `false` |
| `healthDescription` | String | Mô tả tình trạng sức khỏe (VD: khuyết tật chân, bệnh tim mạch...) |
| `healthEvidenceUrl` | String | Link ảnh giấy chứng nhận y tế / sổ khám bệnh |
| `status` | String (enum) | `pending`, `approved`, `rejected`, default `pending` |
| `assignedBedId` | ObjectId ref `Bed` | Giường được gán khi duyệt |
| `reviewedBy` | ObjectId ref `User` | Cán bộ xét duyệt |
| `reviewNote` | String | Lý do từ chối hoặc ghi chú duyệt |
| `reviewedAt` | Date | Thời điểm duyệt đơn |
*Index:* `{ periodId: 1, studentId: 1 }` unique compound.

---

### 2.4. Phân hệ Hợp đồng & Tài chính

#### `Contract` — `modules/contracts/contract.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `contractCode` | String | Mã hợp đồng `HD-YYYY-XXXXX`, unique, required |
| `applicationId` | ObjectId ref `Application` | Đơn đăng ký gốc |
| `studentId` | ObjectId ref `Student` | Sinh viên lưu trú, required |
| `bedId` | ObjectId ref `Bed` | Giường được giao ở, required |
| `academicYearId` | ObjectId ref `AcademicYear` | Năm học lưu trú, required |
| `startDate` | Date | Ngày bắt đầu vào ở, required |
| `endDate` | Date | Ngày kết thúc hợp đồng, required |
| `totalMonths` | Number | Số tháng tính tiền phòng (`8.5`, `10` hoặc `12`), required |
| `pricePerMonth` | Number | Đơn giá tháng đóng băng tại thời điểm ký (VND) |
| `roomPrice` | Number | Tổng tiền phòng cả đợt hợp đồng (`pricePerMonth × totalMonths`) |
| `depositAmount` | Number | Tiền cọc tài sản nộp khi nhận phòng (VND) |
| `depositRefunded` | Number | Tiền cọc thực tế hoàn trả khi trả phòng (VND), default `0` |
| `checkinAt` | Date | Thời điểm quét mã QR nhận phòng tại KTX |
| `status` | String (enum) | `active`, `expired`, `terminated`, default `active` |
| `terminationReason`| String | Lý do trả phòng / chấm dứt |
| `terminatedAt` | Date | Thời điểm trả phòng |
*Index:* `{ bedId: 1 }` partial unique (`{ status: 'active' }`), `{ studentId: 1 }` partial unique (`{ status: 'active' }`).

#### `UtilityReading` — `modules/fees/utility-reading.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `roomId` | ObjectId ref `Room` | Phòng chốt số, required |
| `billingMonth` | String | Tháng chốt (VD: `2026-10`), required |
| `electricityStart` | Number | Chỉ số điện đầu kỳ (kWh), required |
| `electricityEnd` | Number | Chỉ số điện cuối kỳ (kWh), `>= electricityStart` |
| `waterStart` | Number | Chỉ số nước đầu kỳ (m³), required |
| `waterEnd` | Number | Chỉ số nước cuối kỳ (m³), `>= waterStart` |
| `electricityUnitPrice` | Number | Đơn giá điện đóng băng tại thời điểm chốt (VND/kWh) |
| `waterUnitPrice` | Number | Đơn giá nước đóng băng tại thời điểm chốt (VND/m³) |
| `isInvoiced` | Boolean | Đã sinh hóa đơn cho sinh viên trong phòng chưa, default `false` |
| `recordedBy` | ObjectId ref `User` | Cán bộ ghi chỉ số |
*Index:* `{ roomId: 1, billingMonth: 1 }` unique compound.

#### `Invoice` — `modules/fees/invoice.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `invoiceCode` | String | Mã hóa đơn `INV-YYYYMM-XXXXX`, unique, required |
| `contractId` | ObjectId ref `Contract` | Hợp đồng liên quan, required |
| `studentId` | ObjectId ref `Student` | Sinh viên thanh toán, required |
| `type` | String (enum) | `initial`, `utility`, `settlement`, `other`, required |
| `billingMonth` | String | Tháng phát sinh (dùng cho `utility`, VD: `2026-10`), null với initial |
| `lineItems` | Array | `[{ description, quantity, unitPrice, amount }]`, min 1 |
| `totalAmount` | Number | Tổng tiền cần thanh toán (VND) |
| `paidAmount` | Number | Đã thanh toán (tính tự động từ Payment thành công), default `0` |
| `dueDate` | Date | Hạn chót thanh toán, required |
| `status` | String (enum) | `unpaid`, `partial`, `paid`, `overdue`, `cancelled`, default `unpaid` |

#### `Payment` — `modules/payments/payment.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `transactionRef` | String | Mã tham chiếu giao dịch hệ thống sinh, unique |
| `invoiceId` | ObjectId ref `Invoice` | Hóa đơn thanh toán, required |
| `studentId` | ObjectId ref `Student` | Sinh viên thực hiện |
| `amount` | Number | Số tiền giao dịch (VND, `> 0`), required |
| `type` | String (enum) | `payment` (thu tiền), `refund` (chi trả hoàn cọc) |
| `method` | String (enum) | `cash`, `bank_transfer`, `vietqr`, `vnpay`, `zalopay` |
| `gatewayTransactionId`| String | Mã giao dịch từ cổng thanh toán (unique, sparse) |
| `status` | String (enum) | `pending`, `success`, `failed`, `expired`, default `pending` |
| `paidAt` | Date | Thời điểm thanh toán thành công |
| `recordedBy` | ObjectId ref `User` | Cán bộ thu tiền (null nếu tự nộp online) |

---

### 2.5. Phân hệ Nghiệp vụ phát sinh (Chuyển phòng, Báo hỏng, Kỷ luật)

#### `StudentRequest` — `modules/requests/student-request.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `contractId` | ObjectId ref `Contract` | Hợp đồng hiện tại, required |
| `studentId` | ObjectId ref `Student` | Sinh viên gửi đơn, required |
| `type` | String (enum) | `transfer` (chuyển phòng), `checkout` (trả phòng), `repair` (báo hỏng) |
| `reason` | String | Lý do chi tiết, required |
| `targetBedId` | ObjectId ref `Bed` | Giường muốn chuyển tới (dùng cho `transfer`) |
| `repairCategory` | String (enum) | `electric`, `water`, `ac`, `furniture`, `other` (dùng cho `repair`) |
| `attachmentUrl` | String | Ảnh chụp hiện trường hỏng hóc (dùng cho `repair`) |
| `status` | String (enum) | `pending`, `approved`, `rejected`, `completed`, `cancelled`, default `pending` |
| `reviewedBy` | ObjectId ref `User` | Cán bộ xử lý |
| `reviewNote` | String | Phản hồi từ cán bộ |
| `reviewedAt` | Date | Thời điểm xử lý |

#### `Violation` — `modules/violations/violation.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `studentId` | ObjectId ref `Student` | Sinh viên vi phạm, required |
| `roomId` | ObjectId ref `Room` | Phòng xảy ra vi phạm |
| `title` | String | Tiêu đề vi phạm (VD: `Về muộn sau 23h`, `Nấu ăn trong phòng`), required |
| `description` | String | Chi tiết hành vi vi phạm |
| `penaltyAmount` | Number | Tiền phạt quy chế nếu có (VND), default `0` |
| `penaltyDeduction` | Number | Số điểm rèn luyện KTX bị trừ (VD: `-5`), default `0` |
| `occurredAt` | Date | Thời điểm xảy ra vi phạm, required |
| `recordedBy` | ObjectId ref `User` | Cán bộ lập biên bản, required |

---

### 2.6. Phân hệ Smart KTX 4.0 (Chat, Thông báo, Bảng tin)

#### `Conversation` — `modules/chat/conversation.model.js`
Cuộc hội thoại hỗ trợ trực tuyến giữa Sinh viên và Ban quản lý KTX.
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `studentId` | ObjectId ref `Student` | Sinh viên tham gia, required, unique |
| `staffId` | ObjectId ref `User` | Cán bộ đang tiếp nhận hỗ trợ |
| `lastMessage` | String | Nội dung tin nhắn cuối cùng |
| `lastMessageAt` | Date | Thời điểm tin nhắn cuối cùng |
| `unreadCountStudent` | Number | Số tin nhắn chưa đọc của sinh viên, default `0` |
| `unreadCountStaff` | Number | Số tin nhắn chưa đọc của cán bộ, default `0` |

#### `ChatMessage` — `modules/chat/chat-message.model.js`
Tin nhắn trong cuộc hội thoại.
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `conversationId` | ObjectId ref `Conversation` | Cuộc hội thoại trực thuộc, required |
| `senderId` | ObjectId ref `User` | Người gửi tin nhắn, required |
| `senderRole` | String (enum) | `student`, `staff`, required |
| `content` | String | Nội dung tin nhắn |
| `attachmentUrl` | String | Link hình ảnh đính kèm (nếu có) |
| `isRead` | Boolean | Đã đọc chưa, default `false` |
*Index:* `{ conversationId: 1, createdAt: 1 }`.

#### `Notification` — `modules/notifications/notification.model.js`
Thông báo đẩy chuông thời gian thực.
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `userId` | ObjectId ref `User` | Người nhận thông báo, required |
| `title` | String | Tiêu đề thông báo, required |
| `message` | String | Nội dung thông báo, required |
| `type` | String (enum) | `application`, `invoice`, `repair`, `violation`, `chat`, `system` |
| `linkUrl` | String | Đường dẫn điều hướng khi click vào thông báo |
| `isRead` | Boolean | Đã đọc chưa, default `false` |
*Index:* `{ userId: 1, isRead: 1, createdAt: -1 }`.

#### `Announcement` — `modules/announcements/announcement.model.js`
Bảng tin nội bộ KTX.
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `campusId` | ObjectId ref `Campus` | Cơ sở áp dụng (null nếu áp dụng toàn trường) |
| `title` | String | Tiêu đề bài thông báo, required |
| `content` | String | Nội dung chi tiết bài thông báo, required |
| `category` | String (enum) | `general`, `maintenance`, `security`, `activity`, default `general` |
| `priority` | String (enum) | `normal`, `urgent`, default `normal` |
| `publishedBy` | ObjectId ref `User` | Cán bộ đăng bài, required |
| `publishedAt` | Date | Thời điểm xuất bản bài viết |

---

### 2.7. Phân hệ Tài khoản người dùng

#### `User` — `modules/auth/user.model.js`
| Trường | Kiểu dữ liệu | Mô tả & Ràng buộc |
|---|---|---|
| `email` | String | Email/MSSV đăng nhập, unique, required, lowercase |
| `passwordHash` | String | Mật khẩu băm bcrypt (cost >= 10), required |
| `fullName` | String | Tên hiển thị người dùng, required |
| `role` | String (enum) | `admin`, `manager`, `staff`, `student`, required |
| `isActive` | Boolean | `true` (hoạt động), `false` (bị khóa) |
| `mustChangePassword`| Boolean | Bắt buộc đổi mật khẩu khi đăng nhập lần đầu |
| `lastLoginAt` | Date | Thời điểm đăng nhập gần nhất |

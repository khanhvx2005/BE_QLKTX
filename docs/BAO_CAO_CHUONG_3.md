# CHƯƠNG 3: THIẾT KẾ HỆ THỐNG WEB QUẢN LÝ KÝ TÚC XÁ (HaUI - DMS)

---

## 3.1. Kiến trúc hệ thống ở mức cơ bản

Hệ thống Quản lý Ký túc xá Đại học Công nghiệp Hà Nội (**HaUI - DMS**) được thiết kế theo mô hình kiến trúc phân tầng hiện đại **Client - Server** kết hợp phong cách **Modular Monolith** trên nền tảng Node.js / Express và MongoDB. Kiến trúc này tối ưu hóa sự cân bằng giữa tính đơn giản trong triển khai, vận hành và khả năng bảo trì, mở rộng cao cho quy mô đội ngũ phát triển.

Hệ thống được tổ chức thành 3 tầng logic chính (Three-Tier Architecture):

1. **Tầng Giao diện người dùng (Presentation Tier / Client):**
   - Xây dựng dưới dạng ứng dụng đơn trang **Single Page Application (SPA)** bằng **React.js (Vite)** kết hợp thư viện giao diện chuẩn doanh nghiệp **Ant Design (AntD)** và thư viện biểu đồ **Recharts**.
   - Giao diện được thiết kế thích ứng (Responsive) hoàn chỉnh trên cả Desktop, Tablet và Mobile, chia thành 2 phân hệ chính:
     - *Cổng thông tin tiếp nhận công khai (Public Portal)*: Dành cho sinh viên đăng ký mới nộp hồ sơ online và tra cứu phòng trống không cần tài khoản.
     - *Bảng điều khiển quản trị & Portal sinh viên (Admin/Staff Dashboard & Student Portal)*: Dành cho cán bộ quản trị và sinh viên đã có tài khoản để quản lý phòng, điện nước, hóa đơn, thanh toán.
   - Giao tiếp với tầng Backend thông qua giao thức bảo mật **HTTPS** và định dạng dữ liệu chuẩn **RESTful JSON APIs**.

2. **Tầng Xử lý nghiệp vụ (Application / Business Logic Tier):**
   - Xây dựng trên nền tảng **Node.js** và framework **Express.js**, tuân thủ kiến trúc phân tầng rõ ràng bên trong từng mô-đun:
     - **Routes Layer:** Tiếp nhận yêu cầu HTTP, định tuyến và kích hoạt các middleware xác thực / phân quyền (Authentication / RBAC Middleware), xác thực dữ liệu đầu vào (Validation Middleware).
     - **Controllers Layer:** Tiếp nhận request, trích xuất dữ liệu, điều phối gọi dịch vụ nghiệp vụ và định dạng dữ liệu trả về cho client.
     - **Services Layer:** Nơi tập trung toàn bộ các quy tắc nghiệp vụ cốt lõi (Business Rules) của hệ thống: kiểm tra điều kiện giới tính phòng, thuật toán xếp phòng ngăn xếp, cơ chế khóa giường nguyên tử một bước (Atomic Query), tính toán lũy tiến điện nước, sinh mã VietQR động, gửi email thông báo tự động (Nodemailer).
     - **Security & Cross-cutting Concerns:** Cơ chế bảo mật dựa trên **JWT (JSON Web Token)**, mã hóa mật khẩu một chiều với **Bcrypt (10 salt rounds)**, xử lý ngoại lệ tập trung (Global Exception & Error Handling), ghi nhật ký hệ thống (Winston Logger).

3. **Tầng Dữ liệu (Data Tier / Persistence Layer):**
   - Cơ sở dữ liệu tài liệu **MongoDB** kết hợp thư viện ánh xạ đối tượng **Mongoose ODM**.
   - Mô hình dữ liệu được tinh gọn tối đa thành **7 Collections cốt lõi** (`users`, `students`, `buildings`, `rooms`, `contracts`, `utility_readings`, `invoices`, `payments`).
   - Sử dụng các chỉ mục (Indexes) phức hợp và truy vấn nguyên tử cấp độ CSDL (`findOneAndUpdate`) để đảm bảo tính toàn vẹn dữ liệu, triệt tiêu hoàn toàn hiện tượng tranh chấp giường (Race Condition / Zero Overbooking).

```mermaid
graph TD
    subgraph CLIENT["TẦNG TRÌNH DIỄN (CLIENT / FRONTEND)"]
        UI1["Cổng đăng ký KTX Online công khai (Guest)"]
        UI2["Portal Sinh viên nội trú (Student)"]
        UI3["Dashboard Quản trị KTX (Admin / Staff)"]
    end

    subgraph API_GW["GIAO THỨC TRUYỀN THÔNG"]
        REST["RESTful API (HTTPS / JSON / JWT Header)"]
    end

    subgraph BACKEND["TẦNG XỬ LÝ NGHIỆP VỤ (BACKEND - NODE.JS / EXPRESS)"]
        direction TB
        subgraph MIDDLEWARE["Tầng Middleware & Security"]
            MW_AUTH["Xác thực JWT & Phân quyền RBAC (Admin, Staff, Student)"]
            MW_VAL["Kiểm tra tính hợp lệ dữ liệu (Joi / Validator)"]
            MW_LOG["Ghi log hệ thống & Bắt lỗi tập trung (Global Error Handler)"]
        end
        subgraph MODULES["Các Mô-đun Nghiệp vụ (Modular Monolith)"]
            M_AUTH["Auth & Users Module"]
            M_STUDENT["Students & Excel Import Module"]
            M_ROOM["Buildings & Rooms Module"]
            M_CONTRACT["Contracts & Registration Module"]
            M_UTILITY["Utility Readings & Matrix Grid Module"]
            M_INVOICE["Invoices & VietQR Generator Module"]
            M_PAYMENT["Payments & Cash/QR Reconciliation Module"]
            M_STATS["Dashboard & Reports Module"]
        end
        subgraph SERVICES["Dịch vụ Tích hợp Bên ngoài"]
            EMAIL["Dịch vụ Email tự động (Nodemailer / SMTP)"]
            QR["Thư viện sinh mã VietQR chuẩn NAPAS 247"]
        end
    end

    subgraph DATABASE["TẦNG DỮ LIỆU (DATA TIER - MONGODB)"]
        MONGO[("MongoDB Database Engine")]
        C1[("users")]
        C2[("students")]
        C3[("buildings")]
        C4[("rooms & beds (embedded)")]
        C5[("contracts")]
        C6[("utility_readings")]
        C7[("invoices")]
        C8[("payments")]
    end

    CLIENT --> REST
    REST --> MIDDLEWARE
    MIDDLEWARE --> MODULES
    MODULES --> SERVICES
    MODULES --> MONGO
    MONGO --- C1
    MONGO --- C2
    MONGO --- C3
    MONGO --- C4
    MONGO --- C5
    MONGO --- C6
    MONGO --- C7
    MONGO --- C8
```

---

## 3.2. Biểu đồ hoạt động (Activity Diagram)

Các biểu đồ hoạt động được chuẩn hóa theo mô hình phân làn bơi đa tác nhân (**Swimlanes / Partitions: Tác nhân người dùng – Giao diện/Hệ thống – CSDL/Dịch vụ ngoài**) với đầy đủ nút khởi đầu (start node `●`), nút kết thúc (end node `⦿`), các điểm rẽ nhánh điều kiện (decision diamonds `◇`), hoạt động xử lý và luồng dữ liệu hai chiều.

### 3.2.1. Biểu đồ hoạt động "Nộp đơn đăng ký KTX Online công khai"

Quy trình nộp đơn đăng ký KTX trực tuyến công khai dành cho sinh viên mới / sinh viên chưa có tài khoản trên cổng thông tin KTX HaUI:

```mermaid
flowchart TD
    %% Định nghĩa các Swimlanes
    subgraph SinhVien["Sinh viên (Guest)"]
        StartNode(( ))
        A1["Truy cập Cổng KTX công khai"]
        A2["Nhập MSSV, thông tin cá nhân & Giới tính"]
        A3["Chọn Tòa nhà, Phòng và Vị trí Giường"]
        A4["Chọn gói thời hạn thuê (6 hoặc 12 tháng)"]
        A5["Bấm 'Gửi đơn đăng ký'"]
        A6["Nhận thông báo lỗi & Nhập lại"]
        A7["Xem thông báo nộp đơn thành công & Mã tra cứu"]
        EndNode((( )))
    end

    subgraph HeThong["Hệ thống Web KTX HaUI"]
        B1["Nhận yêu cầu lọc phòng theo giới tính"]
        B2["Áp dụng quy tắc ngăn xếp: Tầng thấp -> Phòng nhỏ"]
        B3["Kiểm tra tính hợp lệ của dữ liệu đầu vào"]
        B3_Decision{"Dữ liệu hợp lệ?"}
        B4["Gửi thông báo lỗi nhập liệu"]
        B5["Kiểm tra trạng thái tồn tại của MSSV"]
        B5_Decision{"MSSV đã đăng ký hoặc đang ở?"}
        B6["Thông báo: MSSV đã có đơn hoặc đang cư trú"]
        B7["Tạo hồ sơ sinh viên tạm thời"]
        B8["Tạo hợp đồng đăng ký ở trạng thái 'pending'"]
        B9["Gọi dịch vụ gửi Email tiếp nhận"]
        B10["Trả về kết quả nộp đơn thành công"]
    end

    subgraph CSDL_DichVu["Cơ sở dữ liệu & Dịch vụ ngoài"]
        C1[("CSDL MongoDB: Truy vấn phòng trống Room")]
        C2[("CSDL MongoDB: Kiểm tra trùng Contract & Student")]
        C3[("CSDL MongoDB: Lưu Student (status: active, userId: null)")]
        C4[("CSDL MongoDB: Lưu Contract (status: pending)")]
        C5["Dịch vụ Email (Nodemailer SMTP): Gửi mail tiếp nhận"]
    end

    %% Luồng xử lý
    StartNode --> A1
    A1 --> A2
    A2 --> B1
    B1 --> C1
    C1 --> B2
    B2 --> A3
    A3 --> A4
    A4 --> A5
    A5 --> B3
    B3 --> B3_Decision
    B3_Decision -- "Không hợp lệ" --> B4
    B4 --> A6
    A6 --> A2
    B3_Decision -- "Hợp lệ" --> B5
    B5 --> C2
    C2 --> B5_Decision
    B5_Decision -- "Đã tồn tại" --> B6
    B6 --> EndNode
    B5_Decision -- "Chưa tồn tại" --> B7
    B7 --> C3
    C3 --> B8
    B8 --> C4
    C4 --> B9
    B9 --> C5
    C5 --> B10
    B10 --> A7
    A7 --> EndNode
```

---

### 3.2.2. Biểu đồ hoạt động "Xét duyệt đơn KTX & Cấp tài khoản tự động"

Quy trình Cán bộ KTX thẩm định hồ sơ, thực hiện câu truy vấn nguyên tử một bước (`findOneAndUpdate`) để khóa giường chống Race Condition, tự sinh tài khoản người dùng, phát hành 02 hóa đơn tài chính và gửi email kích hoạt cho sinh viên:

```mermaid
flowchart TD
    subgraph CanBo["Cán bộ KTX (Staff)"]
        StartNode(( ))
        A1["Xem danh sách đơn đăng ký KTX (pending)"]
        A2["Mở xem chi tiết hồ sơ & thông tin giường chọn"]
        A3{"Thẩm định hồ sơ"}
        A4["Nhập lý do từ chối"]
        A5["Bấm 'Duyệt đơn đăng ký'"]
        A6["Nhận cảnh báo tranh chấp giường & chọn giường khác"]
        A7["Nhận thông báo duyệt đơn & cấp tài khoản thành công"]
        EndNode((( )))
    end

    subgraph HeThong["Hệ thống Web KTX HaUI"]
        B1["Tiếp nhận yêu cầu từ chối đơn"]
        B2["Chuyển trạng thái hợp đồng sang 'terminated'"]
        B3["Gọi gửi email thông báo từ chối cho SV"]
        B4["Tiếp nhận yêu cầu duyệt đơn"]
        B5["Thực hiện khóa giường nguyên tử bằng Atomic Query"]
        B5_Decision{"Khóa giường thành công?"}
        B6["Báo lỗi 409 BED_ALREADY_OCCUPIED"]
        B7["Chuyển Contract sang trạng thái 'active'"]
        B8["Tạo tài khoản User (Username=MSSV, Pass=MSSV, mustChangePassword=true)"]
        B9["Liên kết userId hai chiều với hồ sơ Student"]
        B10["Tự động phát hành 02 Hóa đơn: Tiền cọc & Tiền phòng kỳ"]
        B11["Gọi dịch vụ Email kích hoạt tài khoản"]
        B12["Phản hồi duyệt đơn thành công"]
    end

    subgraph CSDL_DichVu["Cơ sở dữ liệu & Dịch vụ ngoài"]
        C1[("CSDL: Contract.updateOne status = 'terminated'")]
        C2[("CSDL: Room.findOneAndUpdate beds.status == 'available' -> 'occupied'")]
        C3[("CSDL: Contract.updateOne status = 'active'")]
        C4[("CSDL: User.create + Student.updateOne")]
        C5[("CSDL: Invoice.create 02 hóa đơn cọc & tiền phòng")]
        C6["Dịch vụ Email: Gửi thông tin tài khoản & nhắc đổi MK"]
    end

    %% Luồng hoạt động
    StartNode --> A1
    A1 --> A2
    A2 --> A3
    A3 -- "Không đạt yêu cầu" --> A4
    A4 --> B1
    B1 --> C1
    C1 --> B2
    B2 --> B3
    B3 --> EndNode
    A3 -- "Đạt yêu cầu" --> A5
    A5 --> B4
    B4 --> B5
    B5 --> C2
    C2 --> B5_Decision
    B5_Decision -- "Thất bại (Giường vừa bị chiếm)" --> B6
    B6 --> A6
    A6 --> A2
    B5_Decision -- "Thành công" --> B7
    B7 --> C3
    C3 --> B8
    B8 --> C4
    C4 --> B9
    B9 --> B10
    B10 --> C5
    C5 --> B11
    B11 --> C6
    C6 --> B12
    B12 --> A7
    A7 --> EndNode
```

---

### 3.3.3. Biểu đồ hoạt động "Thanh toán hóa đơn qua mã VietQR động"

Quy trình thanh toán hóa đơn trực tuyến áp dụng chung cho Hóa đơn cá nhân và Hóa đơn điện nước chung của phòng (đại diện phòng thanh toán qua mã VietQR động, hỗ trợ đối soát qua Webhook hoặc thủ công):

```mermaid
flowchart TD
    subgraph SinhVien["Sinh viên / Đại diện phòng"]
        StartNode(( ))
        A1["Mở chi tiết Hóa đơn trên Portal"]
        A2["Chọn 'Thanh toán qua VietQR'"]
        A3["Quét mã VietQR trên ứng dụng Ngân hàng"]
        A4["Kiểm tra số tiền, cú pháp chuẩn & Xác thực OTP"]
        A5["Nhận thông báo thanh toán thành công & Gạch nợ"]
        EndNode((( )))
    end

    subgraph HeThong["Hệ thống Web KTX HaUI"]
        B1["Tiếp nhận yêu cầu tạo mã thanh toán"]
        B2["Tạo mã VietQR động: Khóa số tiền & cú pháp HAUI INV..."]
        B3["Hiển thị Modal mã QR kèm hướng dẫn & Đồng hồ đếm ngược"]
        B4["Tiếp nhận Webhook biến động số dư từ Ngân hàng"]
        B5["Bóc tách cú pháp, kiểm tra mã HĐ & đối soát số tiền"]
        B5_Decision{"Số tiền & Cú pháp khớp?"}
        B6["Tự động chuyển Invoice sang trạng thái 'paid'"]
        B7["Tạo bản ghi giao dịch Payment (method: 'vietqr')"]
        B8["Bắn thông báo cập nhật giao diện thời gian thực"]
    end

    subgraph NganHang_Webhook["Hệ thống Ngân hàng & Webhook SePay"]
        C1["Ứng dụng Ngân hàng (Mobile Banking)"]
        C2["Hệ thống chuyển mạch NAPAS 247"]
        C3["Webhook SePay / Casso lắng nghe biến động tài khoản"]
        C4[("CSDL MongoDB: Cập nhật Invoice & Lưu Payment")]
    end

    %% Luồng hoạt động
    StartNode --> A1
    A1 --> A2
    A2 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> A3
    A3 --> C1
    C1 --> A4
    A4 --> C2
    C2 --> C3
    C3 --> B4
    B4 --> B5
    B5 --> B5_Decision
    B5_Decision -- "Không khớp / Sai lệch" --> EndNode
    B5_Decision -- "Khớp hoàn toàn" --> B6
    B6 --> C4
    C4 --> B7
    B7 --> B8
    B8 --> A5
    A5 --> EndNode
```

---

### 3.3.4. Biểu đồ hoạt động "Trả phòng & Thanh lý Hợp đồng KTX"

Quy trình kiểm tra công nợ, kiểm kê tài sản hư hại, quyết toán tiền cọc, giải phóng giường và chấm dứt hợp đồng KTX:

```mermaid
flowchart TD
    subgraph CanBo_SinhVien["Cán bộ KTX & Sinh viên"]
        StartNode(( ))
        A1["Sinh viên nộp đơn / yêu cầu trả phòng KTX"]
        A2["Cán bộ mở chức năng 'Nghiệm thu & Trả phòng'"]
        A3["Nhận cảnh báo nợ hóa đơn & Yêu cầu hoàn thành nghĩa vụ"]
        A4["Cán bộ cùng sinh viên kiểm kê hiện trạng tài sản phòng"]
        A5{"Đánh giá hiện trạng cơ sở vật chất"}
        A6["Xác nhận không hư hại: Hoàn trả 100% tiền cọc"]
        A7["Nhập số tiền khấu trừ đền bù hư hại & Lý do"]
        A8["Xác nhận thanh lý hợp đồng & In biên bản bàn giao"]
        EndNode((( )))
    end

    subgraph HeThong["Hệ thống Web KTX HaUI"]
        B1["Kiểm tra công nợ hóa đơn cá nhân & phòng của SV"]
        B1_Decision{"Còn hóa đơn 'unpaid'?"}
        B2["Báo lỗi: Chặn trả phòng khi còn nợ tiền"]
        B3["Cho phép mở form nghiệm thu và xử lý tiền cọc"]
        B4["Tính số tiền hoàn cọc = Tiền cọc - Tiền khấu trừ"]
        B5["Thực hiện giải phóng giường về trạng thái 'available'"]
        B6["Cập nhật Contract sang status 'terminated' & 'refunded'"]
        B7["Tạo bản ghi phiếu chi hoàn tiền trong Payment"]
        B8["Xuất biên bản bàn giao & thanh lý hợp đồng"]
    end

    subgraph CSDL["Cơ sở dữ liệu MongoDB"]
        C1[("CSDL: Truy vấn Invoice (status: unpaid)")]
        C2[("CSDL: Room.findOneAndUpdate beds.$.status = 'available', studentId = null")]
        C3[("CSDL: Contract.updateOne status = 'terminated'")]
        C4[("CSDL: Payment.create (paymentType: 'refund')")]
    end

    %% Luồng hoạt động
    StartNode --> A1
    A1 --> A2
    A2 --> B1
    B1 --> C1
    C1 --> B1_Decision
    B1_Decision -- "Còn nợ hóa đơn" --> B2
    B2 --> A3
    A3 --> EndNode
    B1_Decision -- "Đã sạch công nợ" --> B3
    B3 --> A4
    A4 --> A5
    A5 -- "Không hư hỏng" --> A6
    A5 -- "Có hư hỏng tài sản" --> A7
    A6 --> B4
    A7 --> B4
    B4 --> A8
    A8 --> B5
    B5 --> C2
    C2 --> B6
    B6 --> C3
    C3 --> B7
    B7 --> C4
    C4 --> B8
    B8 --> EndNode
```

---

### 3.3.5. Biểu đồ hoạt động "Quản lý Tòa nhà"

Biểu đồ hoạt động của use case **"Quản lý Tòa nhà"** được thiết kế chuẩn theo mô hình phân làn (Swimlane Diagram) với 2 cột tương ứng với 2 tác nhân/thực thể tham gia: **CanBoKTX** (Cán bộ KTX / Quản trị viên) và **HeThong** (Hệ thống phần mềm), bao gồm đầy đủ các luồng nghiệp vụ: xem danh sách & tỷ lệ lấp đầy, thêm mới tòa nhà, cập nhật thông tin tòa nhà và thay đổi trạng thái hoạt động (kèm kiểm tra điều kiện sinh viên đang cư trú).

#### Biểu đồ PlantUML (Định dạng Đen - Trắng chuẩn Báo cáo / Khóa luận):

```plantuml
@startuml
skinparam Monochrome true
skinparam Shadowing false
skinparam DefaultFontName "Times New Roman"
skinparam DefaultFontSize 12
skinparam ActivityDiamondFontSize 11
skinparam ArrowFontSize 11
skinparam ActivityBorderThickness 1
skinparam ArrowThickness 1

|CanBoKTX|
start
:Kich vao "Quan ly Toa nha";

|HeThong|
:Lay danh sach toa nha va thong ke so phong, so giuong;
:Hien thi danh sach toa nha va so do lap day;

|CanBoKTX|
if (Thao tac?) then ([Them moi])
  :Kich "Them Toa nha";
  |HeThong|
  :Hien thi form nhap thong tin toa nha;
  |CanBoKTX|
  repeat
    :Nhap thong tin: Ma toa, Ten toa, Mo ta;
    :Kich "Luu toa nha";
    |HeThong|
    :Kiem tra ma toa nha duy nhat;
    if (Ma da ton tai?) then ([Co])
      :Bao loi trung ma toa;
      |CanBoKTX|
      :Kich "Nhap lai";
    else ([Khong])
      :Luu toa nha moi vao CSDL (isActive = true);
      break
    endif
  repeat while (Nhap lai ma toa)

elseif ([Chinh sua])
  :Chon mot toa, kich "Chinh sua";
  |HeThong|
  :Hien thi form chinh sua thong tin;
  |CanBoKTX|
  :Sua ten toa, mo ta khu vuc;
  :Kich "Cap nhat";
  |HeThong|
  :Luu thong tin cap nhat vao CSDL;

else ([Doi trang thai])
  :Chon mot toa, kich "Doi trang thai";
  |HeThong|
  :Hien thi hop thoai xac nhan doi trang thai;
  |CanBoKTX|
  :Kich "Xac nhan";
  |HeThong|
  :Kiem tra hien trang sinh vien dang o trong toa;
  if (Con sinh vien dang o?) then ([Co])
    :Bao loi, khong cho phep dong toa nha;
  else ([Khong])
    :Cap nhat trang thai toa nha (isActive = true / false);
  endif
endif

|HeThong|
:Thong bao thanh cong;
:Lam moi danh sach toa nha;
stop
@enduml
```

#### Biểu đồ Mermaid (Hiển thị trực quan trên Markdown):

```mermaid
flowchart TD
    %% Định nghĩa 2 làn tác nhân (Swimlanes) theo chuẩn Visual Paradigm
    subgraph CanBoKTX["CanBoKTX"]
        StartNode(( ))
        A1["Kích vào 'Quản lý Tòa nhà'"]
        A2["Xem danh sách tòa nhà kèm thống kê tỷ lệ lấp đầy"]
        A3{"Thao tác?"}
        
        %% Nhánh 1: Thêm mới tòa nhà
        A4["Kích 'Thêm Tòa nhà'"]
        A5["Nhập thông tin tòa: Mã tòa, Tên tòa, Mô tả"]
        A6["Kích 'Lưu tòa nhà'"]
        A7["Kích 'Sửa mã tòa'"]
        
        %% Nhánh 2: Chỉnh sửa thông tin
        A8["Chọn một tòa, kích 'Chỉnh sửa'"]
        A9["Sửa tên tòa, mô tả khu vực"]
        A10["Kích 'Cập nhật'"]
        
        %% Nhánh 3: Đổi trạng thái hoạt động (Bật/Tắt)
        A11["Chọn một tòa, kích 'Đổi trạng thái'"]
        A12["Kích 'Xác nhận'"]
        
        %% Nút merge các luồng hoàn tất
        MergeEnd{" "}
    end

    subgraph HeThong["HeThong"]
        B1["Lấy danh sách các tòa và thống kê số phòng, số giường"]
        B2["Hiển thị danh sách tòa nhà và sơ đồ lấp đầy"]
        
        %% Xử lý thêm mới
        B3["Hiển thị form nhập thông tin tòa nhà mới"]
        B4["Kiểm tra mã tòa nhà duy nhất"]
        Decision_MaToa{"Mã đã tồn tại?"}
        B5["Báo lỗi trùng mã tòa, yêu cầu nhập mã khác"]
        B6["Lưu tòa nhà mới vào CSDL (isActive = true)"]
        
        %% Xử lý chỉnh sửa
        B7["Hiển thị form chỉnh sửa thông tin tòa nhà"]
        B8["Lưu thông tin cập nhật vào CSDL"]
        
        %% Xử lý đổi trạng thái
        B9["Hiển thị hộp thoại xác nhận đổi trạng thái"]
        B10["Kiểm tra hiện trạng sinh viên đang ở trong tòa"]
        Decision_NguoiO{"Còn sinh viên đang ở?"}
        B11["Báo lỗi, không cho phép đóng tòa nhà"]
        B12["Cập nhật trạng thái tòa nhà (isActive = true / false)"]
        
        %% Làm mới giao diện
        B13["Thông báo thành công & Làm mới danh sách tòa nhà"]
        EndNode((( )))
    end

    %% Luồng hoạt động tuần tự qua lại giữa 2 làn tác nhân
    StartNode --> A1
    A1 --> B1
    B1 --> B2
    B2 --> A2
    A2 --> A3
    
    %% --- Nhánh 1: Thêm mới ---
    A3 -- "[Thêm mới]" --> A4
    A4 --> B3
    B3 --> A5
    A5 --> A6
    A6 --> B4
    B4 --> Decision_MaToa
    Decision_MaToa -- "[Có]" --> B5
    B5 --> A7
    A7 --> A5
    Decision_MaToa -- "[Không]" --> B6
    B6 --> MergeEnd
    
    %% --- Nhánh 2: Chỉnh sửa ---
    A3 -- "[Chỉnh sửa]" --> A8
    A8 --> B7
    B7 --> A9
    A9 --> A10
    A10 --> B8
    B8 --> MergeEnd
    
    %% --- Nhánh 3: Đổi trạng thái ---
    A3 -- "[Đổi trạng thái]" --> A11
    A11 --> B9
    B9 --> A12
    A12 --> B10
    B10 --> Decision_NguoiO
    Decision_NguoiO -- "[Có]" --> B11
    B11 --> MergeEnd
    Decision_NguoiO -- "[Không]" --> B12
    B12 --> MergeEnd
    
    %% Kết thúc và làm mới danh sách
    MergeEnd --> B13
    B13 --> EndNode
```

---

## 3.4. Biểu đồ trình tự (Sequence Diagram)

Các biểu đồ trình tự được chuẩn hóa theo đúng khuôn mẫu phân rã lớp 3 tầng chuẩn UML (**Actor $\rightarrow$ Boundary UI $\rightarrow$ Control Controller $\rightarrow$ Entity Data Models & Services**), các thông điệp có số thứ tự đánh số rõ ràng `1:, 2:, 3:...`, tên hàm/phương thức có tham số cụ thể, và các luồng phản hồi phân tách bằng nét đứt `-->`.

### 3.4.1. Biểu đồ trình tự "Nộp đơn đăng ký KTX Online công khai"

```mermaid
sequenceDiagram
    autonumber
    actor SinhVien as :SinhVien
    participant DangKyUI as :DangKyOnlineUI
    participant DangKyCtrl as :DangKyOnlineController
    participant RoomModel as :Room
    participant StudentModel as :Student
    participant ContractModel as :Contract
    participant EmailService as :EmailService

    SinhVien->>DangKyUI: 1: chonGioiTinh(gioiTinh)
    activate DangKyUI
    DangKyUI->>DangKyCtrl: 2: layDanhSachPhongTrong(gioiTinh)
    activate DangKyCtrl
    DangKyCtrl->>RoomModel: 3: findAvailableRooms(gioiTinh, sortByFloorAsc)
    activate RoomModel
    RoomModel-->>DangKyCtrl: 4: return listRoomsAndBeds
    deactivate RoomModel
    DangKyCtrl-->>DangKyUI: 5: return listRoomsResponse
    deactivate DangKyCtrl
    DangKyUI-->>SinhVien: 6: hienThiDanhSachPhongVaGiuong()
    deactivate DangKyUI

    SinhVien->>DangKyUI: 7: nhapThongTinVaChonGiuong(formData)
    activate DangKyUI
    SinhVien->>DangKyUI: 8: nhanGuiDonDangKy()
    DangKyUI->>DangKyCtrl: 9: guiDonDangKy(formData)
    activate DangKyCtrl

    DangKyCtrl->>DangKyCtrl: 10: kiemTraDuLieuDauVao(formData)
    DangKyCtrl->>StudentModel: 11: kiemTraTrungMSSV(studentCode)
    activate StudentModel
    StudentModel-->>DangKyCtrl: 12: return studentExistStatus
    deactivate StudentModel

    alt MSSV đã tồn tại đơn đăng ký hoặc đang ở KTX
        DangKyCtrl-->>DangKyUI: 13: return thongBaoLoiTrungMSSV
        DangKyUI-->>SinhVien: 14: hienThiThongBaoLoi()
    else Hồ sơ hợp lệ
        DangKyCtrl->>StudentModel: 15: taoHoSoSinhVienTam(studentData)
        activate StudentModel
        StudentModel-->>DangKyCtrl: 16: return studentId
        deactivate StudentModel

        DangKyCtrl->>ContractModel: 17: taoDonDangKy(studentId, roomId, bedNumber, term, status='pending')
        activate ContractModel
        ContractModel-->>DangKyCtrl: 18: return contractCode
        deactivate ContractModel

        DangKyCtrl->>EmailService: 19: guiEmailTiepNhan(email, contractCode)
        activate EmailService
        EmailService-->>DangKyCtrl: 20: return sendStatus
        deactivate EmailService

        DangKyCtrl-->>DangKyUI: 21: return ketQuaThanhCong(contractCode)
        DangKyUI-->>SinhVien: 22: hienThiThongBaoNopDonThanhCong(contractCode)
    end
    deactivate DangKyCtrl
    deactivate DangKyUI
```

---

### 3.4.2. Biểu đồ trình tự "Xét duyệt đơn KTX & Cấp tài khoản tự động"

```mermaid
sequenceDiagram
    autonumber
    actor CanBo as :CanBoKTX
    participant DuyetDonUI as :DuyetDonKTXUI
    participant DuyetDonCtrl as :DuyetDonController
    participant RoomModel as :Room
    participant ContractModel as :Contract
    participant UserModel as :User
    participant StudentModel as :Student
    participant InvoiceModel as :Invoice
    participant EmailService as :EmailService

    CanBo->>DuyetDonUI: 1: moChiTietDonDangKy(contractId)
    activate DuyetDonUI
    DuyetDonUI->>DuyetDonCtrl: 2: layChiTietDon(contractId)
    activate DuyetDonCtrl
    DuyetDonCtrl->>ContractModel: 3: getContractWithDetails(contractId)
    activate ContractModel
    ContractModel-->>DuyetDonCtrl: 4: return contractDetails
    deactivate ContractModel
    DuyetDonCtrl-->>DuyetDonUI: 5: return contractData
    deactivate DuyetDonCtrl
    DuyetDonUI-->>CanBo: 6: hienThiChiTietHoSo()
    deactivate DuyetDonUI

    CanBo->>DuyetDonUI: 7: nhanDuyetDon(contractId)
    activate DuyetDonUI
    DuyetDonUI->>DuyetDonCtrl: 8: pheDuyetDonDangKy(contractId, staffId)
    activate DuyetDonCtrl

    Note over DuyetDonCtrl,RoomModel: Truy vấn nguyên tử một bước (Atomic Query)
    DuyetDonCtrl->>RoomModel: 9: findOneAndUpdate({ _id: roomId, "beds.bedNumber": bedNumber, "beds.status": "available" }, { $set: { "beds.$.status": "occupied", "beds.$.studentId": studentId } })
    activate RoomModel
    RoomModel-->>DuyetDonCtrl: 10: return updateResult
    deactivate RoomModel

    alt Giường vừa bị người khác chiếm (updateResult == null)
        DuyetDonCtrl-->>DuyetDonUI: 11: return thongBaoLoi(409, BED_ALREADY_OCCUPIED)
        DuyetDonUI-->>CanBo: 12: hienThiCanhBaoTranhChapGiuong()
    else Khóa giường thành công
        DuyetDonCtrl->>ContractModel: 13: capNhatTrangThaiHopDong(contractId, 'active', staffId)
        activate ContractModel
        ContractModel-->>DuyetDonCtrl: 14: return contractActive
        deactivate ContractModel

        DuyetDonCtrl->>UserModel: 15: taoTaiKhoanTuDong(email, MSSV, passwordHash=MSSV, role='student', mustChangePassword=true)
        activate UserModel
        UserModel-->>DuyetDonCtrl: 16: return newUserId
        deactivate UserModel

        DuyetDonCtrl->>StudentModel: 17: lienKetUserId(studentId, newUserId)
        activate StudentModel
        StudentModel-->>DuyetDonCtrl: 18: return linkSuccess
        deactivate StudentModel

        DuyetDonCtrl->>InvoiceModel: 19: sinhHoaDonCocVaTienPhong(studentId, contractId, amounts)
        activate InvoiceModel
        InvoiceModel-->>DuyetDonCtrl: 20: return listInvoicesCreated
        deactivate InvoiceModel

        DuyetDonCtrl->>EmailService: 21: guiEmailThongTinTaiKhoan(email, MSSV, matKhauKhoiTao)
        activate EmailService
        EmailService-->>DuyetDonCtrl: 22: return emailSentStatus
        deactivate EmailService

        DuyetDonCtrl-->>DuyetDonUI: 23: return ketQuaPheDuyetThanhCong()
        DuyetDonUI-->>CanBo: 24: hienThiThongBaoDuyetThanhCong()
    end
    deactivate DuyetDonCtrl
    deactivate DuyetDonUI
```

---

### 3.4.3. Biểu đồ trình tự "Thanh toán hóa đơn qua mã VietQR động"

```mermaid
sequenceDiagram
    autonumber
    actor SinhVien as :SinhVien
    participant ThanhToanUI as :ThanhToanHoaDonUI
    participant ThanhToanCtrl as :ThanhToanController
    participant InvoiceModel as :Invoice
    participant VietQRService as :VietQRService
    participant AppNganHang as :AppNganHang
    participant WebhookGateway as :WebhookGateway
    participant PaymentModel as :Payment

    SinhVien->>ThanhToanUI: 1: chonHoaDonVaYeuCauVietQR(invoiceId)
    activate ThanhToanUI
    ThanhToanUI->>ThanhToanCtrl: 2: khoiTaoVietQR(invoiceId)
    activate ThanhToanCtrl

    ThanhToanCtrl->>InvoiceModel: 3: getInvoiceDetails(invoiceId)
    activate InvoiceModel
    InvoiceModel-->>ThanhToanCtrl: 4: return invoiceData
    deactivate InvoiceModel

    ThanhToanCtrl->>VietQRService: 5: generateVietQR(amount, transferContent, bankConfig)
    activate VietQRService
    VietQRService-->>ThanhToanCtrl: 6: return qrCodeUrl
    deactivate VietQRService

    ThanhToanCtrl-->>ThanhToanUI: 7: return qrPayload(qrCodeUrl, amount, transferContent)
    deactivate ThanhToanCtrl
    ThanhToanUI-->>SinhVien: 8: hienThiModalVietQR()
    deactivate ThanhToanUI

    SinhVien->>AppNganHang: 9: quetMaQRVaXacNhanChuyenKhoan()
    activate AppNganHang
    AppNganHang->>AppNganHang: 10: xuLyChuyenKhoanNapas247()
    AppNganHang->>WebhookGateway: 11: guiWebhookBienDongSoDu(transactionData)
    deactivate AppNganHang
    activate WebhookGateway

    WebhookGateway->>ThanhToanCtrl: 12: xuLyWebhook(payload)
    activate ThanhToanCtrl
    ThanhToanCtrl->>ThanhToanCtrl: 13: bocTachMaHoaDonVaKiemTraSoTien()

    ThanhToanCtrl->>InvoiceModel: 14: capNhatTrangThaiHoaDon(invoiceId, 'paid', paidAt)
    activate InvoiceModel
    InvoiceModel-->>ThanhToanCtrl: 15: return invoicePaid
    deactivate InvoiceModel

    ThanhToanCtrl->>PaymentModel: 16: luuGiaoDichThanhToan(invoiceId, amount, 'vietqr', transactionCode)
    activate PaymentModel
    PaymentModel-->>ThanhToanCtrl: 17: return paymentRecord
    deactivate PaymentModel

    ThanhToanCtrl-->>WebhookGateway: 18: return 200 OK
    deactivate ThanhToanCtrl
    deactivate WebhookGateway

    ThanhToanUI->>ThanhToanCtrl: 19: kiemTraTrangThaiHoaDon(invoiceId)
    activate ThanhToanCtrl
    ThanhToanCtrl-->>ThanhToanUI: 20: return status='paid'
    deactivate ThanhToanCtrl
    activate ThanhToanUI
    ThanhToanUI-->>SinhVien: 21: hienThiThongBaoGachNoThanhCong()
    deactivate ThanhToanUI
```

---

### 3.4.4. Biểu đồ trình tự "Trả phòng & Thanh lý Hợp đồng KTX"

```mermaid
sequenceDiagram
    autonumber
    actor CanBo as :CanBoKTX
    participant TraPhongUI as :TraPhongUI
    participant TraPhongCtrl as :TraPhongController
    participant InvoiceModel as :Invoice
    participant RoomModel as :Room
    participant ContractModel as :Contract
    participant PaymentModel as :Payment

    CanBo->>TraPhongUI: 1: moNghiemThuTraPhong(contractId)
    activate TraPhongUI
    TraPhongUI->>TraPhongCtrl: 2: kiemTraCongNoTruocKhiTraPhong(contractId)
    activate TraPhongCtrl

    TraPhongCtrl->>InvoiceModel: 3: findUnpaidInvoices(studentId, roomId)
    activate InvoiceModel
    InvoiceModel-->>TraPhongCtrl: 4: return listUnpaidInvoices
    deactivate InvoiceModel

    alt Còn hóa đơn chưa thanh toán (tiền phòng hoặc điện nước phòng)
        TraPhongCtrl-->>TraPhongUI: 5: return baoLoiConCongNo(listUnpaidInvoices)
        TraPhongUI-->>CanBo: 6: hienThiCanhBaoChuaSachNo()
    else Đã thanh toán đầy đủ công nợ
        TraPhongCtrl-->>TraPhongUI: 7: return xacNhanSachNo(depositAmount)
        deactivate TraPhongCtrl
        TraPhongUI-->>CanBo: 8: hienThiFormNghiemThuVaQuyetToanCoc()

        CanBo->>TraPhongUI: 9: nhapBienBanKiemKe(soTienKhauTru, lyDo)
        CanBo->>TraPhongUI: 10: nhanXacNhanThanhLyHopDong()
        TraPhongUI->>TraPhongCtrl: 11: thanhLyHopDong(contractId, soTienKhauTru, lyDo, staffId)
        activate TraPhongCtrl

        TraPhongCtrl->>TraPhongCtrl: 12: tinhTienHoanTra(depositAmount - soTienKhauTru)

        TraPhongCtrl->>RoomModel: 13: giaiPhongGiuong(roomId, bedNumber)
        activate RoomModel
        RoomModel-->>TraPhongCtrl: 14: return bedAvailableStatus
        deactivate RoomModel

        TraPhongCtrl->>ContractModel: 15: terminateContract(contractId, refundDetails, staffId)
        activate ContractModel
        ContractModel-->>TraPhongCtrl: 16: return contractTerminated
        deactivate ContractModel

        TraPhongCtrl->>PaymentModel: 17: taoPhieuChiHoanCoc(invoiceId, refundAmount, 'refund')
        activate PaymentModel
        PaymentModel-->>TraPhongCtrl: 18: return refundReceipt
        deactivate PaymentModel

        TraPhongCtrl-->>TraPhongUI: 19: return ketQuaThanhLyThanhCong()
        deactivate TraPhongCtrl
        TraPhongUI-->>CanBo: 20: inBienBanBanGiaoVaHoanTat()
    end
    deactivate TraPhongUI
```

---

### 3.4.5. Biểu đồ trình tự "Quản lý Tòa nhà"

```mermaid
sequenceDiagram
    autonumber
    actor AdminStaff as :QuanTriVien
    participant ToaNhaUI as :QuanLyToaNhaUI
    participant ToaNhaCtrl as :BuildingController
    participant BuildingModel as :Building
    participant RoomModel as :Room

    AdminStaff->>ToaNhaUI: 1: truyCapDanhMucToaNha()
    activate ToaNhaUI
    ToaNhaUI->>ToaNhaCtrl: 2: layDanhSachToaKemThongKe()
    activate ToaNhaCtrl

    ToaNhaCtrl->>BuildingModel: 3: getAllBuildings()
    activate BuildingModel
    BuildingModel-->>ToaNhaCtrl: 4: return listBuildings
    deactivate BuildingModel

    ToaNhaCtrl->>RoomModel: 5: aggregateOccupancyStatsByBuilding()
    activate RoomModel
    RoomModel-->>ToaNhaCtrl: 6: return occupancyStats
    deactivate RoomModel

    ToaNhaCtrl-->>ToaNhaUI: 7: return buildingsWithStatsResponse
    deactivate ToaNhaCtrl
    ToaNhaUI-->>AdminStaff: 8: hienThiBangToaNhaVaTyLeLapDay()
    deactivate ToaNhaUI

    alt Trường hợp thêm Tòa nhà mới
        AdminStaff->>ToaNhaUI: 9: nhapThongTinToa(maToa, tenToa, moTa)
        activate ToaNhaUI
        AdminStaff->>ToaNhaUI: 10: nhanLuuToaNha()
        ToaNhaUI->>ToaNhaCtrl: 11: themToaNhaMoi(buildingData)
        activate ToaNhaCtrl

        ToaNhaCtrl->>BuildingModel: 12: findByCode(maToa)
        activate BuildingModel
        BuildingModel-->>ToaNhaCtrl: 13: return existingCheck
        deactivate BuildingModel

        alt Mã tòa nhà đã tồn tại
            ToaNhaCtrl-->>ToaNhaUI: 14: return thongBaoLoiTrungMa()
            ToaNhaUI-->>AdminStaff: 15: hienThiCanhBaoTrungMaToa()
        else Mã tòa hợp lệ
            ToaNhaCtrl->>BuildingModel: 16: createBuilding(buildingData)
            activate BuildingModel
            BuildingModel-->>ToaNhaCtrl: 17: return newBuilding
            deactivate BuildingModel
            ToaNhaCtrl-->>ToaNhaUI: 18: return themToaThanhCong()
            ToaNhaUI-->>AdminStaff: 19: capNhatDanhSachToaNha()
        end
        deactivate ToaNhaCtrl
        deactivate ToaNhaUI

    else Trường hợp đổi trạng thái hoạt động của Tòa
        AdminStaff->>ToaNhaUI: 20: chonDoiTrangThaiToa(buildingId)
        activate ToaNhaUI
        ToaNhaUI->>ToaNhaCtrl: 21: thayDoiTrangThaiHoatDong(buildingId)
        activate ToaNhaCtrl

        ToaNhaCtrl->>RoomModel: 22: findOccupiedBedsInBuilding(buildingId)
        activate RoomModel
        RoomModel-->>ToaNhaCtrl: 23: return listOccupiedBeds
        deactivate RoomModel

        alt Vẫn còn sinh viên đang cư trú trong tòa
            ToaNhaCtrl-->>ToaNhaUI: 24: return baoLoiToaConNguoiO()
            ToaNhaUI-->>AdminStaff: 25: hienThiCanhBaoKhongTheDongToa()
        else Tòa nhà trống hoàn toàn
            ToaNhaCtrl->>BuildingModel: 26: updateBuildingStatus(buildingId, isActive)
            activate BuildingModel
            BuildingModel-->>ToaNhaCtrl: 27: return updateStatusSuccess
            deactivate BuildingModel
            ToaNhaCtrl-->>ToaNhaUI: 28: return doiTrangThaiThanhCong()
            ToaNhaUI-->>AdminStaff: 29: capNhatGiaoDienTrangThai()
        end
        deactivate ToaNhaCtrl
        deactivate ToaNhaUI
    end
```

---

## 3.5. Thiết kế cơ sở dữ liệu

Cơ sở dữ liệu của Hệ thống Quản lý Ký túc xá Đại học Công nghiệp Hà Nội (HaUI - DMS) được thiết kế và cài đặt trên nền tảng **MongoDB**, quản lý thông qua **Mongoose ODM**. Mô hình dữ liệu được tinh gọn tối đa thành **7 collections cốt lõi**, loại bỏ các bảng trung gian phức tạp (`room_types`, `beds`, `fee_types`, `residencies`), nhúng trực tiếp sức chứa và mảng giường vào phòng để tối ưu hóa hiệu năng truy vấn, hạn chế `lookup` và hỗ trợ các thao tác cập nhật nguyên tử (Atomic Updates).

---

### 3.5.1. Mô hình thực thể – mối quan hệ (ERD)

Sơ đồ ERD thể hiện mối quan hệ liên kết giữa 7 thực thể cốt lõi, phản ánh đầy đủ các khóa chính (PK), khóa ngoại (FK), khóa duy nhất (UK) và bản số quan hệ (Cardinality):

```mermaid
erDiagram
    users ||--o| students : "co_ho_so (1-1, role=student)"
    buildings ||--o{ rooms : "chua (1-n)"
    students ||--o{ contracts : "ky_hop_dong (1-n)"
    rooms ||--o{ contracts : "cho_thue_cho (1-n)"
    rooms ||--o{ utility_readings : "chot_chi_so (1-n)"
    rooms ||--o{ invoices : "phat_hanh_hd_dien_nuoc (1-n)"
    students ||--o{ invoices : "thu_huong_hoac_dai_dien_nop (1-n)"
    contracts ||--o{ invoices : "sinh_hd_phong_va_coc (1-n)"
    utility_readings ||--o{ invoices : "sinh_hd_tong_dien_nuoc (1-n)"
    invoices ||--o{ payments : "thanh_toan_hoac_hoan_coc (1-n)"

    users {
        ObjectId _id PK "UNN"
        string email UK "VarChar(100) UNN"
        string passwordHash "VarChar(255) NN"
        string fullName "NVarChar(100) NN"
        string role "VarChar(20) NN 'admin|staff|student'"
        boolean isActive "Bit NN (default: 1)"
        boolean mustChangePassword "Bit NN (default: 0)"
        date createdAt "DateTime NN"
        date updatedAt "DateTime NN"
    }

    students {
        ObjectId _id PK "UNN"
        ObjectId userId FK "unique, sparse"
        string studentCode UK "VarChar(20) UNN (MSSV HaUI)"
        string fullName "NVarChar(100) NN"
        string gender "VarChar(10) NN 'male|female'"
        string phone "VarChar(15) NN"
        string email "VarChar(100) NN"
        date dob "DateTime"
        string faculty "NVarChar(100) NN"
        string className "VarChar(50) NN"
        string status "VarChar(20) NN 'active|inactive'"
        date createdAt "DateTime NN"
        date updatedAt "DateTime NN"
    }

    buildings {
        ObjectId _id PK "UNN"
        string code UK "VarChar(20) UNN 'K1, K2, K3, K4'"
        string name "NVarChar(100) NN"
        string description "NText"
        boolean isActive "Bit NN (default: 1)"
        date createdAt "DateTime NN"
        date updatedAt "DateTime NN"
    }

    rooms {
        ObjectId _id PK "UNN"
        ObjectId buildingId FK "NN"
        string roomNumber "VarChar(20) NN '101, 202...'"
        integer floor "Integer NN"
        string gender "VarChar(10) NN 'male|female'"
        integer capacity "Integer NN (4|6|8)"
        integer pricePerMonth "Integer NN (VND)"
        integer depositAmount "Integer NN (VND)"
        string status "VarChar(20) NN 'active|maintenance'"
        array beds "Subdocument Beds Array"
        date createdAt "DateTime NN"
        date updatedAt "DateTime NN"
    }

    contracts {
        ObjectId _id PK "UNN"
        string contractCode UK "VarChar(30) UNN"
        ObjectId studentId FK "NN"
        ObjectId roomId FK "NN"
        integer bedNumber "Integer NN"
        string term "VarChar(20) NN '6_months|12_months'"
        date startDate "DateTime NN"
        date endDate "DateTime NN"
        integer pricePerMonth "Integer NN"
        integer totalRoomFee "Integer NN"
        integer depositAmount "Integer NN"
        string depositStatus "VarChar(20) NN 'unpaid|paid|refunded|forfeited'"
        integer depositRefundAmount "Integer NN"
        integer depositDeductionAmount "Integer NN"
        string depositRefundReason "NVarChar(255)"
        date depositRefundedAt "DateTime"
        ObjectId depositRefundedBy FK
        string status "VarChar(20) NN 'pending|active|expired|terminated'"
        ObjectId approvedBy FK
        date createdAt "DateTime NN"
        date updatedAt "DateTime NN"
    }

    utility_readings {
        ObjectId _id PK "UNN"
        ObjectId roomId FK "NN"
        string monthYear "VarChar(10) NN 'YYYY-MM'"
        object electricity "NText / JSON NN"
        object water "NText / JSON NN"
        integer totalAmount "Integer NN (VND)"
        integer occupantsCount "Integer NN"
        integer perStudentAmount "Integer NN (VND)"
        boolean isBilled "Bit NN (default: 0)"
        ObjectId recordedBy FK "NN"
        date createdAt "DateTime NN"
        date updatedAt "DateTime NN"
    }

    invoices {
        ObjectId _id PK "UNN"
        string invoiceCode UK "VarChar(50) UNN"
        ObjectId roomId FK
        ObjectId studentId FK
        ObjectId contractId FK
        ObjectId utilityReadingId FK
        string type "VarChar(30) NN 'room_semester|deposit|utility'"
        integer amount "Integer NN (VND)"
        string description "NVarChar(255)"
        date dueDate "DateTime NN"
        string status "VarChar(20) NN 'unpaid|paid'"
        date paidAt "DateTime"
        date createdAt "DateTime NN"
        date updatedAt "DateTime NN"
    }

    payments {
        ObjectId _id PK "UNN"
        string paymentCode UK "VarChar(50) UNN"
        ObjectId invoiceId FK "NN"
        integer amount "Integer NN (VND)"
        string paymentType "VarChar(20) NN 'payment|refund'"
        string method "VarChar(20) NN 'cash|vietqr'"
        ObjectId cashCollectedBy FK
        string transactionCode "VarChar(100)"
        string note "NVarChar(255)"
        date paidAt "DateTime NN"
        date createdAt "DateTime NN"
        date updatedAt "DateTime NN"
    }
```

---

### 3.5.2. Mô tả chi tiết các collection

*Quy ước ký hiệu ràng buộc bảng dữ liệu:*
- **PK**: Primary Key (Khóa chính)
- **FK**: Foreign Key (Khóa ngoại)
- **UK**: Unique Key (Khóa duy nhất)
- **NN**: Not Null (Không được để trống)
- **UNN**: Unique & Not Null (Duy nhất và không được để trống)

---

#### 1. Collection `users` (Tài khoản người dùng & Xác thực)
- **Mục đích:** Quản lý tài khoản đăng nhập hệ thống, mật khẩu mã hóa một chiều `bcrypt`, phân cấp vai trò người dùng (RBAC) và kiểm soát cờ bắt buộc đổi mật khẩu.
- **Mapping file:** `src/modules/auth/user.model.js`

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải chi tiết |
|---|---|---|---|---|
| `_id` | ObjectId | PK, UNN | Auto generated | Khóa chính tự sinh trong MongoDB |
| `email` | String | UK, UNN | - | Email đăng nhập duy nhất (lowercase, trim) |
| `passwordHash` | String | NN | - | Mật khẩu đã băm bảo mật bằng `bcrypt` (10 rounds) |
| `fullName` | String | NN | - | Họ và tên hiển thị của người dùng |
| `role` | String | NN | - | Vai trò người dùng: `'admin'`, `'staff'`, `'student'` |
| `isActive` | Boolean | NN | `true` | Cờ kích hoạt/khóa tài khoản |
| `mustChangePassword` | Boolean | NN | `false` | Bật `true` khi cấp tài khoản mới hoặc reset mật khẩu tạm |
| `createdAt` | Date | NN | `Date.now` | Thời điểm tạo tài khoản |
| `updatedAt` | Date | NN | `Date.now` | Thời điểm cập nhật tài khoản gần nhất |

- **Chỉ mục (Indexes):**
  - `{ email: 1 }` (Unique Index) — Tối ưu hóa tốc độ tìm kiếm khi đăng nhập và chống trùng lặp email.

---

#### 2. Collection `students` (Hồ sơ Sinh viên HaUI)
- **Mục đích:** Lưu trữ lý lịch nhân thân sinh viên HaUI, thông tin học tập, số điện thoại liên lạc và liên kết tài khoản hệ thống.
- **Mapping file:** `src/modules/students/student.model.js`

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải chi tiết |
|---|---|---|---|---|
| `_id` | ObjectId | PK, UNN | Auto generated | Khóa chính hồ sơ sinh viên |
| `userId` | ObjectId | FK, sparse, unique | `null` | Liên kết 1-1 với `users` (gán khi duyệt đơn) |
| `studentCode` | String | UK, UNN | - | **Mã sinh viên HaUI** (ví dụ: `2021601234`), duy nhất |
| `fullName` | String | NN | - | Họ và tên sinh viên |
| `gender` | String | NN | - | Giới tính: `'male'` hoặc `'female'` (điều kiện cốt lõi lọc phòng) |
| `phone` | String | NN | - | Số điện thoại liên lạc (10 chữ số: `/^0\d{9}$/`) |
| `email` | String | NN | - | Email cá nhân nhận thông báo kết quả duyệt và hóa đơn |
| `dob` | Date | Nullable | `null` | Ngày tháng năm sinh |
| `faculty` | String | NN | - | Khoa/Viện đào tạo tại HaUI (*CNTT, Cơ khí, Điện...*) |
| `className` | String | NN | - | Lớp học sinh hoạt (*ví dụ: KTPM01-K16*) |
| `emergencyContact` | Object | Nullable | `{}` | `{ name: String, phone: String, relationship: String }` |
| `status` | String | NN | `'active'` | Trạng thái hồ sơ: `'active'`, `'inactive'` |
| `createdAt` | Date | NN | `Date.now` | Thời gian tạo hồ sơ |
| `updatedAt` | Date | NN | `Date.now` | Thời gian cập nhật gần nhất |

- **Chỉ mục (Indexes):**
  - `{ studentCode: 1 }` (Unique Index) — Đảm bảo duy nhất mã sinh viên.
  - `{ fullName: "text" }` — Hỗ trợ tìm kiếm nhanh theo họ tên sinh viên.

---

#### 3. Collection `buildings` (Tòa nhà KTX HaUI)
- **Mục đích:** Quản lý danh mục các dãy tòa nhà ký túc xá (K1, K2, K3, K4...) và trạng thái hoạt động.
- **Mapping file:** `src/modules/rooms/building.model.js`

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải chi tiết |
|---|---|---|---|---|
| `_id` | ObjectId | PK, UNN | Auto generated | Khóa chính tòa nhà |
| `code` | String | UK, UNN | - | Mã định danh tòa: `K1`, `K2`, `K3`, `K4` |
| `name` | String | NN | - | Tên hiển thị (ví dụ: `Tòa K1 - KTX Cơ sở 1`) |
| `description` | String | Nullable | `""` | Vị trí, số tầng hoặc ghi chú khu vực |
| `isActive` | Boolean | NN | `true` | Trạng thái hoạt động: `true` (mở), `false` (tạm đóng) |
| `createdAt` | Date | NN | `Date.now` | Thời gian khởi tạo |
| `updatedAt` | Date | NN | `Date.now` | Thời gian cập nhật gần nhất |

- **Chỉ mục (Indexes):**
  - `{ code: 1 }` (Unique Index) — Chống trùng mã tòa nhà.

---

#### 4. Collection `rooms` (Phòng KTX & Mảng Giường nhúng trực tiếp)
- **Mục đích:** Quản lý thông tin từng phòng KTX, sức chứa, đơn giá tháng, tiền cọc và danh sách các vị trí giường nhúng trực tiếp.
- **Mapping file:** `src/modules/rooms/room.model.js`

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải chi tiết |
|---|---|---|---|---|
| `_id` | ObjectId | PK, UNN | Auto generated | Khóa chính phòng KTX |
| `buildingId` | ObjectId | FK, NN | - | Mã liên kết đến tòa nhà (`buildings`) |
| `roomNumber` | String | NN | - | Số phòng (ví dụ: `"101"`, `"205"`, `"302"`) |
| `floor` | Number | NN | - | Vị trí tầng (dùng cho thuật toán xếp phòng ngăn xếp) |
| `gender` | String | NN | - | Phân loại phòng: `'male'` (Nam) hoặc `'female'` (Nữ) |
| `capacity` | Number | NN | - | Sức chứa cố định: `4`, `6` hoặc `8` người |
| `pricePerMonth` | Number | NN | - | Đơn giá tiền phòng thuê trong 1 tháng / sinh viên (VNĐ) |
| `depositAmount` | Number | NN | - | Mức tiền đặt cọc phòng quy định (VNĐ) |
| `status` | String | NN | `'active'` | Trạng thái phòng: `'active'` (sẵn sàng), `'maintenance'` (sửa) |
| `beds` | Array | NN | `[]` | Mảng Subdocument chứa danh sách giường (xem bảng con) |
| `createdAt` | Date | NN | `Date.now` | Thời gian tạo phòng |
| `updatedAt` | Date | NN | `Date.now` | Thời gian cập nhật gần nhất |

*Cấu trúc Subdocument mảng `beds` nhúng trong `rooms`:*
| Thuộc tính con | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải |
|---|---|---|---|---|
| `bedNumber` | Number | NN | - | Vị trí giường: `1, 2, 3...` đến `capacity` |
| `status` | String | NN | `'available'` | Trạng thái: `'available'` (trống), `'occupied'` (đã ở), `'maintenance'` (hỏng) |
| `studentId` | ObjectId | FK, Nullable | `null` | Mã sinh viên đang giữ giường (null khi giường trống) |

- **Chỉ mục (Indexes):**
  - `{ buildingId: 1, roomNumber: 1 }` (Unique Index) — Chống trùng số phòng trong cùng một tòa.
  - `{ gender: 1, "beds.status": 1, floor: 1, roomNumber: 1 }` (Compound Index) — Tối ưu hóa truy vấn lọc phòng trống theo giới tính và quy tắc ngăn xếp.

---

#### 5. Collection `contracts` (Hợp đồng Thuê KTX theo Kỳ)
- **Mục đích:** Quản lý hợp đồng lưu trú, gói thuê trọn gói (6 tháng / 12 tháng), tiến độ xét duyệt và thông tin hoàn/khấu trừ tiền cọc khi trả phòng.
- **Mapping file:** `src/modules/contracts/contract.model.js`

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải chi tiết |
|---|---|---|---|---|
| `_id` | ObjectId | PK, UNN | Auto generated | Khóa chính hợp đồng |
| `contractCode` | String | UK, UNN | - | Mã hợp đồng duy nhất (ví dụ: `HD-2026-0089`) |
| `studentId` | ObjectId | FK, NN | - | Mã sinh viên đứng tên hợp đồng (`students`) |
| `roomId` | ObjectId | FK, NN | - | Phòng KTX được thuê (`rooms`) |
| `bedNumber` | Number | NN | - | Số giường thuê trong phòng |
| `term` | String | NN | - | Kỳ hạn thuê: `'6_months'` hoặc `'12_months'` |
| `startDate` | Date | NN | - | Ngày bắt đầu hiệu lực hợp đồng |
| `endDate` | Date | NN | - | Ngày kết thúc hợp đồng |
| `pricePerMonth` | Number | NN | - | Đơn giá tháng tại thời điểm ký (VNĐ) |
| `totalRoomFee` | Number | NN | - | **Tổng tiền phòng cả kỳ**: `pricePerMonth * (6 hoặc 12)` |
| `depositAmount` | Number | NN | - | Mức tiền cọc quy định ban đầu (VNĐ) |
| `depositStatus` | String | NN | `'unpaid'` | Trạng thái cọc: `'unpaid'`, `'paid'`, `'refunded'`, `'forfeited'` |
| `depositRefundAmount` | Number | NN | `0` | Số tiền cọc hoàn trả thực tế cho SV khi trả phòng |
| `depositDeductionAmount` | Number | NN | `0` | Số tiền khấu trừ hư hại tài sản KTX |
| `depositRefundReason` | String | Nullable | `""` | Ghi chú lý do nghiệm thu hoặc căn cứ khấu trừ cọc |
| `depositRefundedAt` | Date | Nullable | `null` | Ngày giờ hoàn tiền cọc |
| `depositRefundedBy` | ObjectId | FK, Nullable | `null` | Cán bộ xác nhận hoàn tiền cọc (`users`) |
| `status` | String | NN | `'pending'` | Trạng thái: `'pending'`, `'active'`, `'expired'`, `'terminated'` |
| `approvedBy` | ObjectId | FK, Nullable | `null` | Cán bộ duyệt đơn (`users`) |
| `rejectionReason` | String | Nullable | `""` | Lý do từ chối nếu đơn bị hủy |
| `createdAt` | Date | NN | `Date.now` | Thời điểm nộp đơn |
| `updatedAt` | Date | NN | `Date.now` | Thời điểm cập nhật trạng thái gần nhất |

- **Chỉ mục (Indexes):**
  - `{ contractCode: 1 }` (Unique Index)
  - `{ studentId: 1, status: 1 }` — Kiểm tra nhanh tình trạng hợp đồng của sinh viên.
  - `{ roomId: 1, bedNumber: 1, status: 1 }` — Kiểm tra nhanh trạng thái chiếm chỗ của giường.

---

#### 6. Collection `utility_readings` (Chỉ số Điện Nước Chốt Hàng Tháng)
- **Mục đích:** Lưu trữ chỉ số điện và nước ghi nhận hàng tháng theo từng phòng, tính toán tổng tiền và số tiền chia bình quân mỗi sinh viên.
- **Mapping file:** `src/modules/fees/utility-reading.model.js`

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải chi tiết |
|---|---|---|---|---|
| `_id` | ObjectId | PK, UNN | Auto generated | Khóa chính bản ghi chỉ số |
| `roomId` | ObjectId | FK, NN | - | Phòng KTX được chốt số (`rooms`) |
| `monthYear` | String | NN | - | Tháng ghi chỉ số: `YYYY-MM` (ví dụ: `"2026-10"`) |
| `electricity` | Object | NN | - | `{ oldIndex: Number, newIndex: Number, usage: Number, unitPrice: Number, amount: Number }` |
| `water` | Object | NN | - | `{ oldIndex: Number, newIndex: Number, usage: Number, unitPrice: Number, amount: Number }` |
| `totalAmount` | Number | NN | - | Tổng tiền điện + nước cả phòng trong tháng (VNĐ) |
| `occupantsCount` | Number | NN | - | Số lượng sinh viên thực tế đang ở tại thời điểm chốt số |
| `perStudentAmount` | Number | NN | - | Tiền chia bình quân: $\text{totalAmount} \div \text{occupantsCount}$ |
| `isBilled` | Boolean | NN | `false` | Đã phát hành hóa đơn phòng tổng hay chưa |
| `recordedBy` | ObjectId | FK, NN | - | Cán bộ KTX thực hiện nhập số (`users`) |
| `createdAt` | Date | NN | `Date.now` | Thời điểm nhập chỉ số |
| `updatedAt` | Date | NN | `Date.now` | Thời điểm cập nhật gần nhất |

- **Chỉ mục (Indexes):**
  - `{ roomId: 1, monthYear: 1 }` (Unique Index) — Đảm bảo mỗi phòng chỉ chốt số 1 lần trong 1 tháng.

---

#### 7. Collection `invoices` (Hóa đơn Thu tiền)
- **Mục đích:** Quản lý hóa đơn cá nhân (tiền cọc, tiền phòng cả kỳ) và hóa đơn theo phòng (tiền điện nước tổng phát hành cho cả phòng).
- **Mapping file:** `src/modules/fees/invoice.model.js`

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải chi tiết |
|---|---|---|---|---|
| `_id` | ObjectId | PK, UNN | Auto generated | Khóa chính hóa đơn |
| `invoiceCode` | String | UK, UNN | - | Mã hóa đơn chuẩn (ví dụ: `INV-2026-0045`, `INV-UTIL-K1-302-202610`) |
| `roomId` | ObjectId | FK, Nullable | `null` | Phòng gắn hóa đơn (bắt buộc với hóa đơn điện nước `utility`) |
| `studentId` | ObjectId | FK, Nullable | `null` | Sinh viên nộp tiền phòng / đại diện nộp tiền điện nước |
| `contractId` | ObjectId | FK, Nullable | `null` | Liên kết hợp đồng (`contracts`) |
| `utilityReadingId` | ObjectId | FK, Nullable | `null` | Liên kết chỉ số điện nước (`utility_readings`) |
| `type` | String | NN | - | Loại khoản thu: `'room_semester'`, `'deposit'`, `'utility'` |
| `amount` | Number | NN | - | Số tiền cần thanh toán của hóa đơn (VNĐ) |
| `description` | String | Nullable | `""` | Diễn giải khoản thu |
| `dueDate` | Date | NN | - | Hạn chót thanh toán |
| `status` | String | NN | `'unpaid'` | Trạng thái: `'unpaid'` (chưa đóng), `'paid'` (đã thanh toán) |
| `paidAt` | Date | Nullable | `null` | Thời điểm gạch nợ thành công |
| `createdAt` | Date | NN | `Date.now` | Thời điểm phát hành hóa đơn |
| `updatedAt` | Date | NN | `Date.now` | Thời điểm cập nhật gần nhất |

- **Chỉ mục (Indexes):**
  - `{ invoiceCode: 1 }` (Unique Index)
  - `{ roomId: 1, type: 1, status: 1 }` — Tra cứu nhanh công nợ điện nước của phòng.
  - `{ studentId: 1, status: 1 }` — Tra cứu nhanh công nợ cá nhân của sinh viên.

---

#### 8. Collection `payments` (Lịch sử Giao dịch & Phiếu thu/chi)
- **Mục đích:** Lưu trữ nhật ký phiếu thu tiền từ sinh viên (qua VietQR hoặc tiền mặt) và phiếu chi hoàn tiền cọc khi thanh lý hợp đồng trả phòng.
- **Mapping file:** `src/modules/payments/payment.model.js`

| Tên trường (Field) | Kiểu dữ liệu | Ràng buộc | Giá trị mặc định | Diễn giải chi tiết |
|---|---|---|---|---|
| `_id` | ObjectId | PK, UNN | Auto generated | Khóa chính giao dịch |
| `paymentCode` | String | UK, UNN | - | Mã phiếu thu/chi duy nhất (ví dụ: `PAY-2026-0078`) |
| `invoiceId` | ObjectId | FK, NN | - | Hóa đơn liên kết (`invoices`) |
| `amount` | Number | NN | - | Số tiền giao dịch thực tế (VNĐ) |
| `paymentType` | String | NN | `'payment'` | Bản chất giao dịch: `'payment'` (thu tiền) hoặc `'refund'` (chi hoàn cọc) |
| `method` | String | NN | - | Phương thức: `'cash'` (tiền mặt) hoặc `'vietqr'` (chuyển khoản) |
| `cashCollectedBy` | ObjectId | FK, Nullable | `null` | Cán bộ KTX thu tiền mặt (`users`) |
| `transactionCode` | String | Nullable | `""` | Mã giao dịch tham chiếu ngân hàng / Webhook SePay |
| `note` | String | Nullable | `""` | Ghi chú thanh toán |
| `paidAt` | Date | NN | `Date.now` | Thời điểm hoàn tất giao dịch |
| `createdAt` | Date | NN | `Date.now` | Thời điểm tạo bản ghi |
| `updatedAt` | Date | NN | `Date.now` | Thời điểm cập nhật gần nhất |

- **Chỉ mục (Indexes):**
  - `{ paymentCode: 1 }` (Unique Index)
  - `{ invoiceId: 1 }` — Lịch sử thanh toán theo hóa đơn.
  - `{ transactionCode: 1 }` — Chống xử lý trùng webhook ngân hàng (Idempotency).

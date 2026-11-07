# 03 – PHÂN TÍCH NGHIỆP VỤ

**Hệ thống:** DMS – Hệ thống quản lý ký túc xá
**Phiên bản:** v2.0 (MongoDB + Mongoose)
**Mục đích:** Mô tả quy tắc nghiệp vụ, máy trạng thái và luồng quy trình.

> Đây là tài liệu **backend phải đọc kỹ nhất** — mọi quy tắc `BR-xx` dưới đây phải được cài đặt ở tầng **Service**.
> Cấu trúc dữ liệu xem `DATA-SCHEMA.md`, endpoint xem `API.md`, phạm vi xem `PRD.md`.

---

## 1. Mô hình nghiệp vụ tổng thể

### 1.1. Các thực thể chính

```mermaid
flowchart LR
    B["Tòa nhà<br/>Building"] -->|"1..n"| R["Phòng<br/>Room"]
    R -->|"1..n"| BD["Giường<br/>Bed"]
    R -->|"1..n"| UR["Chỉ số điện nước<br/>UtilityReading"]
    S["Sinh viên<br/>Student"] -->|"1..n"| RES["Lưu trú<br/>Residency"]
    BD -->|"1..n theo thời gian"| RES
    RES -->|"1:1"| C["Hợp đồng<br/>Contract"]
    C -->|"1..n"| I["Hóa đơn<br/>Invoice"]
    I -->|"1..n"| P["Thanh toán<br/>Payment"]
    C -->|"1..n"| RQ["Yêu cầu<br/>Request"]
    UR -.->|"sinh dòng phí"| I
```

**Điểm khác biệt quan trọng so với bản v1:** giữa Sinh viên và Giường có thực thể trung gian **Residency** ("ai đang ở giường nào"), tách khỏi **Contract** ("giấy tờ pháp lý"). Một Residency ứng với đúng một Contract.

### 1.2. Vòng đời một sinh viên

```mermaid
flowchart LR
    A["Staff tạo<br/>hồ sơ SV"] --> B["SV đăng ký<br/>tài khoản"]
    A --> C["Staff xếp SV<br/>vào giường"]
    C --> D["Residency active<br/>Contract pending"]
    D --> E["Staff kích hoạt<br/>hợp đồng"]
    E --> F["Contract active<br/>+ 2 hóa đơn kỳ đầu"]
    F --> G["Lưu trú:<br/>đóng phí hằng kỳ"]
    G --> H{"Sắp hết hạn"}
    H -->|"Xin gia hạn"| I["Gia hạn:<br/>dời ngày kết thúc"]
    I --> G
    H -->|"Xin trả phòng"| J["Trả phòng:<br/>chốt nợ + quyết toán cọc"]
    H -->|"Không làm gì"| K["Scheduler tự<br/>cho hết hạn"]
    J --> L["Residency closed<br/>Bed available"]
    K --> L
```

---

## 2. Máy trạng thái

### 2.1. Giường — `Bed.status`

```mermaid
stateDiagram-v2
    [*] --> available: Tạo giường mới
    available --> occupied: Tạo Residency (chiếm giường)
    occupied --> available: Đóng Residency (trả phòng / hết hạn / chấm dứt)
    available --> maintenance: Chuyển bảo trì
    maintenance --> available: Hoàn tất bảo trì
    available --> [*]: Xóa giường (chỉ khi chưa từng dùng)
```

| Trạng thái | Ý nghĩa | Xếp người được? |
|-----------|---------|-----------------|
| `available` | Sẵn sàng cho thuê | ✅ |
| `occupied` | Đang có sinh viên ở | ❌ |
| `maintenance` | Hỏng hóc / đang sửa | ❌ |

> **Chỉ 3 trạng thái.** Bản v1 từng có `reserved` (giữ chỗ khi sinh viên nộp đơn online). Ở v2, sinh viên **không tự đăng ký chỗ ở** — Staff là người xếp giường (`PRD.md` §4.1) — nên không cần trạng thái giữ chỗ.

### 2.2. Lưu trú — `Residency.status`

```mermaid
stateDiagram-v2
    [*] --> active: Staff đăng ký SV vào giường
    active --> closed: Trả phòng / hết hạn / chấm dứt
    closed --> [*]
```

### 2.3. Hợp đồng — `Contract.status`

```mermaid
stateDiagram-v2
    [*] --> pending: Tạo hợp đồng cùng Residency
    pending --> active: Staff kích hoạt
    active --> active: Gia hạn (dời endDate)
    active --> expired: Quá endDate (Scheduler)
    active --> terminated: Duyệt trả phòng / chấm dứt sớm
    expired --> [*]
    terminated --> [*]
```

| Trạng thái | Ý nghĩa | Giường | Residency |
|-----------|---------|--------|-----------|
| `pending` | Đã tạo, chưa kích hoạt | `occupied` | `active` |
| `active` | Đang hiệu lực | `occupied` | `active` |
| `expired` | Quá hạn, không gia hạn | `available` | `closed` |
| `terminated` | Trả phòng sớm / bị chấm dứt | `available` | `closed` |

> ⚠️ Giường bị chiếm ngay khi **tạo Residency**, không đợi tới lúc kích hoạt hợp đồng. Nếu đợi, hai Staff có thể cùng tạo Residency trên một giường.

### 2.4. Hóa đơn — `Invoice.status`

```mermaid
stateDiagram-v2
    [*] --> unpaid: Lập hóa đơn
    unpaid --> partial: Thanh toán một phần
    unpaid --> paid: Thanh toán đủ
    partial --> paid: Trả nốt phần còn lại
    unpaid --> overdue: Quá hạn (Scheduler)
    partial --> overdue: Quá hạn mà chưa trả đủ
    overdue --> partial: Trả một phần sau hạn
    overdue --> paid: Trả đủ sau hạn
    unpaid --> cancelled: Hủy hóa đơn lập sai
    paid --> [*]
    cancelled --> [*]
```

| Trạng thái | Điều kiện |
|-----------|-----------|
| `unpaid` | `paidAmount = 0` và chưa quá hạn |
| `partial` | `0 < paidAmount < totalAmount` |
| `paid` | `paidAmount >= totalAmount` |
| `overdue` | `hôm nay > dueDate` và `paidAmount < totalAmount` |
| `cancelled` | Staff hủy, chỉ khi chưa có thanh toán `success` |

### 2.5. Thanh toán — `Payment.status`

```mermaid
stateDiagram-v2
    [*] --> pending: Tạo phiên thanh toán online
    [*] --> success: Ghi nhận thủ công (tiền mặt / chuyển khoản)
    pending --> success: Webhook xác nhận thành công
    pending --> failed: Webhook báo thất bại / người dùng hủy
    pending --> expired: Quá 15 phút không phản hồi
    failed --> [*]
    expired --> [*]
    success --> [*]
```

### 2.6. Yêu cầu — `Request.status`

```mermaid
stateDiagram-v2
    [*] --> pending: Sinh viên gửi yêu cầu
    pending --> approved: Staff duyệt
    pending --> rejected: Staff từ chối (bắt buộc lý do)
    pending --> cancelled: Sinh viên tự hủy
    approved --> [*]
    rejected --> [*]
    cancelled --> [*]
```

---

## 3. Quy tắc nghiệp vụ (Business Rules)

> **Nơi cài đặt:** `DB` = ràng buộc/index Mongoose · `SV` = tầng service · `FE` = kiểm tra giao diện (chỉ để trải nghiệm, **không** thay thế kiểm tra server).
> **⭐** = quy tắc thuộc 3 nghiệp vụ bổ sung (`PRD.md` §2.9).

### 3.1. Cơ sở vật chất

| Mã | Quy tắc | Nơi | FR |
|----|---------|-----|-----|
| BR-01 | `Building.code` duy nhất trong hệ thống. | DB + SV | FR-20 |
| BR-02 | `Room.roomNumber` duy nhất trong phạm vi một tòa nhà. | DB (unique compound) + SV | FR-21 |
| BR-03 | `Bed.bedCode` duy nhất trong phạm vi một phòng. | DB (unique compound) + SV | FR-22 |
| BR-04 | Số giường thực tế của một phòng không vượt quá `Room.capacity`. | SV | FR-24 |
| BR-05 | Chỉ xếp được sinh viên vào giường `available`. | SV (xem BR-20) | FR-31 |
| ⭐ BR-06 | Giới tính sinh viên phải khớp **`Room.gender`**. ⚠️ Kiểm tra ở mức **phòng**, không phải tòa nhà — kiểm tra ở mức tòa sẽ cho nam nữ ở chung phòng. | SV | FR-29 |
| BR-07 | Không xóa cứng tòa nhà/phòng/giường đang được tham chiếu; chỉ chuyển `isActive: false`. | SV | FR-25 |
| BR-08 | Giường `occupied` không chuyển thẳng sang `maintenance` — phải chuyển người ở đi trước. | SV | FR-27 |
| BR-09 | Không giảm `Room.capacity` xuống dưới số giường hiện có. | SV | FR-24 |
| BR-10 | `Room.pricePerBed > 0`. ⚠️ Đây là giá **mỗi sinh viên/tháng**, không nhân/chia cho `capacity` ở bất kỳ đâu. | DB + SV + FE | FR-21 |

### 3.2. Sinh viên

| Mã | Quy tắc | Nơi | FR |
|----|---------|-----|-----|
| BR-11 | `Student.studentCode` duy nhất toàn hệ thống. | DB (unique) + SV | FR-11 |
| BR-12 | `Student.gender` bắt buộc — cần cho BR-06. | DB + SV | FR-10 |
| BR-13 | Không vô hiệu hóa sinh viên còn hợp đồng `pending`/`active`. | SV | FR-14 |
| BR-14 | Không vô hiệu hóa sinh viên còn công nợ (`tổng còn nợ > 0`). | SV | FR-14 |
| BR-15 | Số điện thoại theo định dạng Việt Nam: 10 chữ số, bắt đầu bằng `0`. | SV + FE | FR-10 |

### 3.3. Lưu trú & hợp đồng

| Mã | Quy tắc | Nơi | FR |
|----|---------|-----|-----|
| **BR-20** | **Mỗi giường tại một thời điểm chỉ có tối đa 1 Residency `active`.** Quy tắc quan trọng nhất hệ thống. Cài bằng **cập nhật có điều kiện nguyên tử** (mục 4.1) + partial unique index trên `Residency.bedId`. | SV + DB | FR-31 |
| **BR-21** | **Mỗi sinh viên tại một thời điểm chỉ có tối đa 1 hợp đồng `pending`/`active`.** | SV | FR-32 |
| BR-22 | `Contract.endDate > startDate`, thời hạn tối thiểu 1 tháng. | SV + FE | FR-33 |
| BR-23 | `Contract` liên kết 1:1 với `Residency`. | DB (unique) | FR-33 |
| BR-24 | Mã hợp đồng sinh tự động `HD-YYYY-XXXXX`. | SV | FR-33 |
| **BR-25** | Khi kích hoạt hợp đồng, sinh **hai hóa đơn riêng**: một `type: 'deposit'` (`billingPeriod: null`) và một `type: 'monthly'`. ⚠️ **Tuyệt đối không gộp** — xem mục 5.3. | SV | FR-34 |
| BR-26 | Hạn thanh toán hai hóa đơn kỳ đầu = `startDate + 7 ngày`. | SV | FR-34 |
| BR-27 | `Contract.monthlyPrice` **chốt tại thời điểm ký**; đổi `Room.pricePerBed` sau này không làm thay đổi hợp đồng cũ. | SV | FR-33 |
| BR-28 | Hợp đồng `active` có `endDate < hôm nay` → `expired`, Residency → `closed`, Bed → `available` (Scheduler). | SV (job) | FR-36 |
| BR-29 | "Sắp hết hạn" = `0 <= (endDate − hôm nay) <= N`, mặc định `N = 30`, khai báo ở `core/config/settings.js`. | SV | FR-37 |
| BR-30 | Chỉ hợp đồng `active` mới gia hạn hoặc chấm dứt được. | SV | FR-38 |
| BR-31 | Chấm dứt sớm: tiền phòng kỳ dở tính theo **số ngày ở thực tế** = `monthlyPrice / số ngày trong tháng × số ngày ở`. | SV | FR-38 |
| BR-32 | Tiền phòng **tháng đầu thu đủ một tháng**, không chia theo ngày, kể cả khi vào ở giữa tháng. Đơn giản hóa có chủ ý — **bất đối xứng** với BR-31, phải ghi rõ trong nội quy để tránh khiếu nại. | SV | FR-34 |

### 3.4. Phí, chỉ số điện nước & hóa đơn

| Mã | Quy tắc | Nơi | FR |
|----|---------|-----|-----|
| BR-40 | Mã hóa đơn sinh tự động `INV-YYYYMM-XXXXX`, duy nhất. | DB + SV | FR-48 |
| BR-41 | `totalAmount` = tổng `lineItems.amount`; client không được tự đặt. | SV | FR-49 |
| BR-42 | Mỗi dòng phí: `amount = quantity × unitPrice`. | SV | FR-46 |
| BR-43 | `paidAmount` **luôn tính lại** từ tổng `Payment` có `status: 'success'`, không cộng dồn thủ công. | SV | FR-49 |
| BR-44 | Số tiền thanh toán không vượt quá số còn nợ của hóa đơn. | SV + FE | FR-50 |
| BR-45 | Không thanh toán hóa đơn đã `paid` hoặc `cancelled`. | SV | FR-50 |
| BR-46 | Chỉ hủy hóa đơn khi chưa có thanh toán `success` nào. | SV | FR-58 |
| BR-47 | Không lập trùng: với cùng `(studentId, type, billingPeriod)` chỉ tồn tại 1 hóa đơn chưa hủy. | DB (partial unique) + SV | FR-47 |
| BR-48 | Khi lập hàng loạt gặp hóa đơn `monthly` đã có của kỳ đó, **bổ sung dòng phí còn thiếu** vào hóa đơn đó, **không bỏ qua sinh viên**. | SV | FR-47 |
| ⭐ BR-50 | `UtilityReading`: chỉ số cuối kỳ ≥ chỉ số đầu kỳ. | DB + SV + FE | FR-59 |
| ⭐ BR-51 | Chỉ số đầu kỳ mặc định bằng chỉ số cuối kỳ liền trước; hệ thống tự điền, cảnh báo nếu người dùng sửa. | SV | FR-59 |
| ⭐ BR-52 | Đơn giá điện/nước **chốt lại trên bản ghi `UtilityReading`**; đổi giá trong `FeeType` sau này không làm sai hóa đơn cũ. | SV | FR-59 |
| ⭐ BR-53 | Không sửa `UtilityReading` sau khi `isInvoiced: true`. | SV | FR-59 |
| ⭐ BR-54 | Tiền điện/nước của phòng **chia đều** cho số sinh viên có Residency `active` trong kỳ. Dùng `Math.floor`, phần dư dồn cho sinh viên có `studentCode` nhỏ nhất — xem công thức mục 5.2. Chia đều **theo đầu người, không theo số ngày ở**. | SV | FR-59 |
| ⭐ BR-55 | Phòng không có sinh viên nào ở trong kỳ → không lập hóa đơn điện/nước cho phòng đó. | SV | FR-59 |
| BR-56 | Hóa đơn quá `dueDate` mà `paidAmount < totalAmount` → `overdue` (Scheduler). | SV (job) | FR-57 |

### 3.5. Thanh toán

| Mã | Quy tắc | Nơi | FR |
|----|---------|-----|-----|
| BR-60 | Mỗi giao dịch online có `transactionRef` duy nhất do hệ thống sinh. | DB (unique) + SV | FR-53 |
| **BR-61** | **Xác thực chữ ký webhook trước khi làm bất cứ điều gì.** Chữ ký sai → ghi log cảnh báo bảo mật, **không** thay đổi dữ liệu, trả `GATEWAY_SIGNATURE_INVALID`. | SV | FR-54 |
| **BR-62** | **Idempotent:** nếu `Payment` đã `success`, xác nhận và không ghi nhận lần hai. Index unique sparse trên `gatewayTransactionId` là lớp chặn cuối. | SV + DB | FR-55 |
| BR-63 | Số tiền webhook trả về phải khớp số tiền giao dịch đã tạo; lệch → không cập nhật hóa đơn, đánh dấu cần đối soát. | SV | FR-54 |
| BR-64 | `Payment` `pending` quá 15 phút không phản hồi → `expired` (Scheduler). | SV (job) | FR-56 |
| BR-65 | Lưu nguyên `gatewayRawResponse` để đối soát về sau. | SV | FR-56 |

### 3.6. Gia hạn & trả phòng

| Mã | Quy tắc | Nơi | FR |
|----|---------|-----|-----|
| BR-70 | Chỉ sinh viên có hợp đồng `active` mới gửi được yêu cầu. | SV | FR-60, FR-61 |
| BR-71 | Không tồn tại 2 yêu cầu cùng loại `pending` cho cùng một hợp đồng. | DB (partial unique) + SV | FR-62 |
| BR-72 | Gia hạn: `requestedEndDate` phải lớn hơn `endDate` hiện tại. | SV + FE | FR-60 |
| BR-73 | Duyệt gia hạn: dời `endDate`, sinh hóa đơn `monthly` cho các kỳ gia hạn, **không thu lại tiền cọc**. | SV | FR-65 |
| BR-74 | Duyệt trả phòng: `Contract` → `terminated`, `Residency` → `closed`, `Bed` → `available`, chốt công nợ. | SV | FR-66 |
| ⭐ BR-75 | Duyệt trả phòng khi sinh viên còn nợ → trả `422 STUDENT_HAS_DEBT` kèm số tiền; Staff gửi lại với `forceConfirm: true` mới tiếp tục. | SV + FE | FR-69 |
| ⭐ BR-76 | Quyết toán cọc: `hoàn = depositAmount − công nợ còn lại`. Tạo hóa đơn `type: 'settlement'`. | SV | FR-68 |
| ⭐ BR-77 | Nếu `hoàn > 0`, **phải ghi một `Payment` loại `refund`, `status: 'success'`** để lưu vết đã chi trả. Chỉ tính ra con số mà không ghi nhận thì không đối soát được ai đã nhận lại cọc. | SV | FR-68 |
| BR-78 | Từ chối yêu cầu bắt buộc có `reviewNote` không rỗng. | SV + FE | FR-64 |
| BR-79 | Sinh viên chỉ hủy được yêu cầu của chính mình và chỉ khi còn `pending`. | SV | FR-67 |

### 3.7. Tài khoản & phân quyền

| Mã | Quy tắc | Nơi | FR |
|----|---------|-----|-----|
| BR-80 | `User.email` duy nhất. | DB (unique) + SV | FR-06 |
| BR-81 | Mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số. | SV + FE | FR-03 |
| BR-82 | Tài khoản `student` liên kết 1–1 với một hồ sơ `Student`. | DB (unique sparse) + SV | FR-80 |
| BR-83 | Không khóa/xóa tài khoản `admin` cuối cùng còn hoạt động. | SV | FR-06 |
| BR-84 | Staff **không** được đặt lại mật khẩu tài khoản `admin` — chống leo thang đặc quyền. | SV | FR-09 |
| BR-85 | Đặt lại mật khẩu: sinh mật khẩu tạm ≥ 10 ký tự bằng `crypto.randomBytes`, trả về **một lần**, bật `mustChangePassword`. | SV | FR-09 |
| **BR-86** | **Mọi API `/api/portal/*` lấy danh tính từ JWT, không bao giờ từ tham số client gửi lên.** | SV | FR-85 |

**Tổng: 76 quy tắc nghiệp vụ.**

---

## 4. Ba kỹ thuật cốt lõi

### 4.1. ⭐ Chống xếp trùng giường — cập nhật có điều kiện nguyên tử

**Vấn đề:** hai Staff cùng xếp sinh viên vào một giường trong cùng tích tắc. Nếu code là "đọc trạng thái → thấy `available` → ghi `occupied`", cả hai đều đọc thấy `available` và cả hai đều ghi thành công ⇒ hai người một giường.

**Cách sai:**
```js
const bed = await Bed.findById(bedId);
if (bed.status !== 'available') throw new ApiError(409, ...);  // ❌ khe hở ở đây
bed.status = 'occupied';
await bed.save();
```

**Cách đúng** — đưa điều kiện vào **chính câu truy vấn**. Một thao tác `findOneAndUpdate` trên một document là nguyên tử trong MongoDB, không cần transaction:
```js
const bed = await Bed.findOneAndUpdate(
  { _id: bedId, status: 'available' },   // điều kiện nằm trong query
  { status: 'occupied' },
  { new: true }
);
if (!bed) {
  // Không trả về document ⇒ giường vừa bị người khác chiếm
  throw new ApiError(409, 'BED_NOT_AVAILABLE', 'Giường này vừa được xếp cho sinh viên khác');
}
```

**Lớp bảo vệ thứ hai** ở tầng CSDL (`DATA-SCHEMA.md` §3.6):
```js
residencySchema.index(
  { bedId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
```

> Nếu tạo Residency thất bại sau khi đã chiếm giường, **phải trả giường lại** `available` trong khối `catch`.

### 4.2. ⭐ Idempotent khi xử lý webhook thanh toán

**Vấn đề:** cổng thanh toán gửi lại webhook khi không nhận được phản hồi. Xử lý ngây thơ ⇒ ghi nhận tiền hai lần.

```js
export const handleWebhook = async (payload) => {
  // 1. Xác thực chữ ký TRƯỚC MỌI THỨ (BR-61)
  if (!verifySignature(payload)) {
    logger.warn('[BẢO MẬT] Chữ ký webhook không hợp lệ', { ref: payload.vnp_TxnRef });
    throw new ApiError(400, 'GATEWAY_SIGNATURE_INVALID', 'Chữ ký giao dịch không hợp lệ');
  }

  const payment = await Payment.findOne({ transactionRef: payload.vnp_TxnRef });
  if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch');

  // 2. Đã xử lý rồi thì thoát sớm (BR-62)
  if (payment.status === 'success') return { alreadyConfirmed: true, payment };

  // 3. Số tiền phải khớp (BR-63)
  if (payment.amount !== Number(payload.vnp_Amount) / 100) {
    payment.gatewayRawResponse = payload;
    await payment.save();
    throw new ApiError(422, 'AMOUNT_MISMATCH', 'Số tiền giao dịch không khớp, cần đối soát');
  }

  // 4. Ghi nhận
  payment.status = payload.vnp_ResponseCode === '00' ? 'success' : 'failed';
  payment.gatewayTransactionId = payload.vnp_TransactionNo;
  payment.gatewayRawResponse = payload;
  if (payment.status === 'success') payment.paidAt = new Date();
  await payment.save();

  if (payment.status === 'success') await recalculateInvoice(payment.invoiceId);  // BR-43
  return { alreadyConfirmed: false, payment };
};
```

### 4.3. ⭐ Chia đều tiền điện nước không lệch đồng nào

```js
/**
 * Chia roomTotal cho n sinh viên sao cho TỔNG CÁC PHẦN = roomTotal chính xác.
 * @returns {number[]} mảng n phần tử, phần tử [0] dành cho MSSV nhỏ nhất
 */
export function splitEvenly(roomTotal, n) {
  if (n <= 0) return [];
  const base = Math.floor(roomTotal / n);      // KHÔNG dùng Math.round — tổng sẽ vượt
  const remainder = roomTotal - base * n;
  const shares = Array(n).fill(base);
  shares[0] += remainder;                       // dồn phần dư cho người đầu tiên
  return shares;
}
```

| Ví dụ | Kết quả | Kiểm chứng |
|---|---|---|
| 900 000 đ ÷ 6 | mỗi người 150 000 đ | 150 000 × 6 = 900 000 ✅ |
| 576 000 đ ÷ 7 | 1 người 82 290 đ, 6 người 82 285 đ | 82 290 + 82 285×6 = 576 000 ✅ |

> Nếu dùng `Math.round(576000/7) = 82286` thì tổng = 576 002 đ — **thu thừa 2 đồng**, sổ sách không khớp.

---

## 5. Công thức & ví dụ tính toán

### 5.1. Bảng công thức

| Đại lượng | Công thức |
|-----------|-----------|
| Thành tiền một dòng phí | `amount = quantity × unitPrice` |
| Tổng hóa đơn | `totalAmount = Σ lineItems.amount` |
| Đã thanh toán | `paidAmount = Σ Payment.amount` với `status: 'success'`, `type: 'payment'` |
| Còn nợ của hóa đơn | `totalAmount − paidAmount` |
| Tổng công nợ sinh viên | `Σ còn nợ` của các hóa đơn `unpaid`/`partial`/`overdue` |
| Tiền điện cả phòng | `(electricityEnd − electricityStart) × electricityUnitPrice` |
| Tiền điện mỗi sinh viên | `splitEvenly(tiền điện phòng, n)` — mục 4.3 |
| Tiền phòng một tháng | `Contract.monthlyPrice` (giá **mỗi người**) |
| Tiền phòng theo ngày (trả sớm) | `monthlyPrice / số ngày trong tháng × số ngày ở`, làm tròn đến đồng |
| Tỷ lệ lấp đầy | `occupied / (tổng giường − maintenance) × 100%` |
| Tiền hoàn cọc | `depositAmount − tổng công nợ còn lại` (âm ⇒ sinh viên còn nợ) |

### 5.2. Ví dụ: hóa đơn tháng 10/2026

**Bối cảnh:** phòng B2-301, sức chứa 8, hiện 6 sinh viên đang ở, `pricePerBed` = 400 000 đ/người/tháng.
Điện: 1 250 → 1 610 (360 kWh × 2 500 đ). Nước: 85 → 133 (48 m³ × 12 000 đ).

| Khoản | Tính | Kết quả |
|-------|------|---------|
| Tiền điện cả phòng | 360 × 2 500 | 900 000 đ |
| Tiền điện / sinh viên | `splitEvenly(900000, 6)` | 150 000 đ |
| Tiền nước cả phòng | 48 × 12 000 | 576 000 đ |
| Tiền nước / sinh viên | `splitEvenly(576000, 6)` | 96 000 đ |
| Tiền phòng / sinh viên | cố định | 400 000 đ |
| **Tổng hóa đơn 1 sinh viên** | | **646 000 đ** |

### 5.3. ⚠️ Cạm bẫy: gộp hóa đơn tiền cọc

**Tình huống:** hợp đồng kích hoạt ngày 05/10. Nếu sinh **một** hóa đơn `type: 'monthly'`, `billingPeriod: '2026-10'` chứa cả tiền cọc và tiền phòng, thì cuối tháng 10 khi chạy lập hóa đơn hàng loạt:

1. Hệ thống thấy sinh viên **đã có** hóa đơn `monthly` kỳ 2026-10 (BR-47).
2. Bỏ qua sinh viên đó.
3. ⇒ **Tiền điện và tiền nước tháng 10 của sinh viên này không bao giờ được thu.**

Mỗi sinh viên mới lọt khoảng 250 000 đ. Vì vậy:
- **BR-25:** tách thành hai hóa đơn — `deposit` (`billingPeriod: null`) và `monthly`.
- **BR-48:** đợt lập hàng loạt phải **bổ sung dòng phí thiếu**, không bỏ qua sinh viên.

### 5.4. Ví dụ: quyết toán khi trả phòng

Sinh viên trả phòng 15/12, cọc 500 000 đ, còn nợ 246 000 đ.

| Bước | Kết quả |
|------|---------|
| Tiền phòng kỳ dở (15/31 ngày × 400 000) | 193 548 đ |
| Tổng công nợ chốt | 246 000 + 193 548 = 439 548 đ |
| Hoàn cọc = 500 000 − 439 548 | **60 452 đ** |
| Ghi nhận | Hóa đơn `settlement` + `Payment` loại `refund` 60 452 đ |

Nếu công nợ là 700 000 đ ⇒ hoàn = −200 000 ⇒ hoàn 0 đ, hóa đơn `settlement` ghi sinh viên còn nợ 200 000 đ.

---

## 6. Luồng quy trình chi tiết

### 6.1. Xếp sinh viên vào giường

```mermaid
sequenceDiagram
    actor NV as Staff
    participant API as Backend
    participant DB as MongoDB

    NV->>API: POST /api/residencies {studentId, bedId, startDate}
    API->>DB: Student.findById + Bed.findById(populate room)
    API->>API: Kiểm tra Room.gender == Student.gender (BR-06)
    alt Sai giới tính
        API-->>NV: 422 GENDER_MISMATCH
    end
    API->>DB: Residency.findOne({studentId, status:'active'})
    alt Đã có hợp đồng mở
        API-->>NV: 422 STUDENT_HAS_ACTIVE_CONTRACT
    end
    API->>DB: Bed.findOneAndUpdate({_id, status:'available'}, {status:'occupied'})
    alt Trả về null
        API-->>NV: 409 BED_NOT_AVAILABLE
    else Chiếm được giường
        API->>DB: Residency.create({status:'active'})
        API->>DB: Contract.create({status:'pending'})
        API-->>NV: 201 + residency + contract
    end

    NV->>API: PATCH /api/contracts/:id/activate
    API->>DB: Contract.status = 'active'
    API->>DB: Invoice.create(type:'deposit')
    API->>DB: Invoice.create(type:'monthly')
    API-->>NV: 200 + mảng 2 hóa đơn
```

### 6.2. Lập hóa đơn định kỳ

```mermaid
flowchart TD
    A["Staff nhập chỉ số điện nước<br/>từng phòng (BR-50→53)"] --> B["Chọn 'Lập hóa đơn kỳ'"]
    B --> C["Xem trước: phòng nào thiếu chỉ số"]
    C --> D{"Với mỗi phòng"}
    D --> E["n = số Residency active trong kỳ"]
    E --> F{"n = 0?"}
    F -->|"Có"| G["Bỏ qua phòng (BR-55)"]
    F -->|"Không"| H["Tính tiền điện, nước cả phòng"]
    H --> I["splitEvenly() cho n sinh viên (BR-54)"]
    I --> J{"Với mỗi sinh viên"}
    J --> K{"Đã có hóa đơn<br/>monthly kỳ này?"}
    K -->|"Chưa"| L["Tạo hóa đơn mới:<br/>phòng + điện + nước"]
    K -->|"Rồi"| M["BỔ SUNG dòng điện, nước<br/>vào hóa đơn có sẵn (BR-48)"]
    L --> N["Báo cáo: đã tạo / đã bổ sung / bỏ qua"]
    M --> N
    G --> N
```

### 6.3. Trả phòng và quyết toán

```mermaid
flowchart TD
    A["SV gửi yêu cầu trả phòng"] --> B["Request pending"]
    B --> C["Staff xem chi tiết + công nợ"]
    C --> D{"Duyệt?"}
    D -->|"Từ chối"| E["Nhập reviewNote → rejected (BR-78)"]
    D -->|"Duyệt"| F{"Còn nợ?"}
    F -->|"Có"| G["422 STUDENT_HAS_DEBT (BR-75)"]
    G --> H{"Staff xác nhận<br/>forceConfirm?"}
    H -->|"Không"| C
    H -->|"Có"| I
    F -->|"Không"| I["Tính tiền phòng kỳ dở (BR-31)"]
    I --> J["Chốt tổng công nợ"]
    J --> K["hoàn = cọc − công nợ (BR-76)"]
    K --> L["Tạo hóa đơn settlement"]
    L --> M{"hoàn > 0?"}
    M -->|"Có"| N["Tạo Payment type refund (BR-77)"]
    M -->|"Không"| O["Ghi phần SV còn nợ"]
    N --> P["Contract terminated<br/>Residency closed<br/>Bed available"]
    O --> P
    P --> Q["Hiển thị bảng quyết toán"]
```

---

## 7. Tác vụ nền (Scheduler)

**Một job duy nhất** chạy 00:05 hằng ngày, làm 4 việc tuần tự:

| # | Việc | Quy tắc | Hành động |
|---|------|---------|-----------|
| 1 | Hợp đồng hết hạn | BR-28 | `active` + `endDate < hôm nay` → `expired`; Residency → `closed`; Bed → `available` |
| 2 | Hóa đơn quá hạn | BR-56 | `dueDate < hôm nay` và còn nợ → `overdue` |
| 3 | Giao dịch treo | BR-64 | `Payment` `pending` quá 15 phút → `expired` |
| 4 | Đối soát trạng thái giường | – | So `Bed.status` với Residency thực tế, ghi log nếu lệch và tự sửa |

```js
// core/jobs/daily-job.js — chỉ chạy khi ENABLE_CRON=true
cron.schedule('5 0 * * *', runDailyTasks, { timezone: 'Asia/Ho_Chi_Minh' });

// Cho phép chạy tay để test: npm run job
if (process.argv[2] === 'run-now') runDailyTasks().then(() => process.exit(0));
```

> Mỗi việc phải **idempotent** — chạy lại nhiều lần không gây sai dữ liệu — và ghi log số bản ghi đã xử lý.

---

## 8. Từ điển thuật ngữ

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| **Building / Room / Bed** | Ba cấp không gian ở. Bed là đơn vị nhỏ nhất, được gán cho sinh viên. |
| **Residency** | "Sinh viên X đang ở giường Y" — sự kiện ở thực tế, tách khỏi giấy tờ. |
| **Contract** | Giấy tờ pháp lý gắn với đúng một Residency: thời hạn, giá, tiền cọc, điều khoản. |
| **billingPeriod** | Kỳ tính phí, dạng chuỗi `"2026-10"`. |
| **Deposit** | Tiền cọc thu một lần đầu hợp đồng, quyết toán khi trả phòng. |
| **Settlement** | Hóa đơn thanh lý — chứng từ khép lại vòng đời tài chính của hợp đồng. |
| **Công nợ** | Tổng số tiền sinh viên còn phải trả trên mọi hóa đơn chưa thanh toán đủ. |
| **Tỷ lệ lấp đầy** | Tỷ lệ giường đang có người trên tổng giường khả dụng (trừ giường bảo trì). |
| **Webhook** | Lời gọi server-to-server từ cổng thanh toán báo kết quả giao dịch. **Nguồn sự thật duy nhất** về việc tiền đã vào hay chưa. |
| **Idempotent** | Thực hiện nhiều lần cho kết quả như thực hiện một lần. |

---

## 9. Lịch sử phiên bản

| Phiên bản | Ngày | Nội dung |
|-----------|------|----------|
| v1.0 | 11/09/2026 | Khởi tạo, 65 quy tắc nghiệp vụ (PostgreSQL) |
| v1.1 | 12/09/2026 | Rà soát chéo, bổ sung 6 quy tắc |
| **v2.0** | **12/09/2026** | **Viết lại theo stack MongoDB + Mongoose.** Thêm thực thể `Residency`; bỏ trạng thái giường `reserved` (còn 3); bỏ quy tắc chuyển phòng (ngoài phạm vi v1); enum đổi sang chữ thường; đánh số lại BR và truy vết sang FR mới; thay `FOR UPDATE` bằng `findOneAndUpdate` nguyên tử; thay transaction bằng thao tác nguyên tử. **Tổng: 76 quy tắc.** |

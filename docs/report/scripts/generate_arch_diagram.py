import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'images'))
os.makedirs(OUT_DIR, exist_ok=True)

width = 1400
height = 680

img = Image.new('RGB', (width, height), color=(255, 255, 255))
draw = ImageDraw.Draw(img)

font_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 20)
font_sub = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 16)
font_body = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 14)
font_arrow = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 13)

# --- 1. CLIENT LAYER ---
draw.rounded_rectangle([60, 40, 1340, 190], radius=12, fill=(240, 248, 255), outline=(33, 150, 243), width=2)
draw.text((80, 52), "TẦNG GIAO DIỆN / TRÌNH BÀY (CLIENT TIER - React, Vite & Ant Design)", fill=(2, 119, 189), font=font_title)

client_boxes = [
    ("Cổng công khai & Tra cứu KTX", "Guest / Tân sinh viên", ["• Tra cứu phòng theo giới tính", "• Nộp đơn trực tuyến (Ngăn xếp)"], (255, 255, 255), (3, 169, 244)),
    ("Cổng sinh viên (Student Portal)", "Sinh viên HaUI nội trú", ["• Đổi mật khẩu lần đầu", "• Xem bạn cùng phòng & Quét VietQR"], (255, 255, 255), (3, 169, 244)),
    ("Khu vực quản trị (Admin / Staff)", "Cán bộ KTX & Quản trị viên", ["• Duyệt đơn & Khóa giường", "• Ghi điện nước, Thu phí & Dashboard"], (255, 255, 255), (3, 169, 244))
]

for idx, (title, sub, bullets, bg, border) in enumerate(client_boxes):
    bx = 90 + idx * 410
    by = 85
    draw.rounded_rectangle([bx, by, bx + 380, by + 90], radius=8, fill=bg, outline=border, width=1)
    draw.text((bx + 15, by + 10), title, fill=(1, 87, 155), font=font_sub)
    draw.text((bx + 15, by + 30), f"Tác nhân: {sub}", fill=(100, 100, 100), font=font_body)
    draw.text((bx + 15, by + 50), bullets[0], fill=(50, 50, 50), font=font_body)
    draw.text((bx + 15, by + 68), bullets[1], fill=(50, 50, 50), font=font_body)

draw.line([(700, 190), (700, 245)], fill=(120, 144, 156), width=4)
draw.polygon([(693, 200), (700, 190), (707, 200)], fill=(120, 144, 156))
draw.polygon([(693, 235), (700, 245), (707, 235)], fill=(120, 144, 156))
draw.text((715, 208), "HTTPS / RESTful API (JSON Envelope { code, message, data }, JWT Bearer)", fill=(84, 110, 122), font=font_arrow)

# --- 2. SERVER LAYER ---
draw.rounded_rectangle([60, 250, 1340, 460], radius=12, fill=(255, 248, 225), outline=(255, 152, 0), width=2)
draw.text((80, 262), "TẦNG XỬ LÝ NGHIỆP VỤ (SERVER TIER - Node.js & Express Modular Monolith)", fill=(230, 81, 0), font=font_title)

server_cols = [
    ("Định tuyến & Bảo mật (Core)", ["• Express Router (8 Modules)", "• JWT Auth & RBAC (3 Roles)", "• Forced Password Change Guard", "• Global Error Handler"]),
    ("Tầng Nghiệp vụ (Services)", ["• Atomic Bed Lock ($elemMatch)", "• Room Utility Matrix & Billing", "• VietQR NAPAS Payload Builder", "• Auto Account & SMTP Mailer"]),
    ("Tầng Chuẩn hóa DTO (Shared)", ["• Batch Reference Loader (loadCtx)", "• Computed Expiry Status View", "• Enum & Error Code Contracts", "• UTC+7 Business Date Utils"]),
    ("Tầng Mô hình CSDL (Models)", ["• 8 Mongoose ODM Schemas", "• Embedded Room Beds Array", "• Partial & Compound Indexes", "• Sensitive Field Redaction"])
]

for idx, (title, items) in enumerate(server_cols):
    bx = 90 + idx * 305
    by = 295
    draw.rounded_rectangle([bx, by, bx + 285, by + 145], radius=8, fill=(255, 255, 255), outline=(255, 183, 77), width=1)
    draw.text((bx + 15, by + 10), title, fill=(191, 54, 12), font=font_sub)
    for i, itm in enumerate(items):
        draw.text((bx + 15, by + 38 + i * 26), itm, fill=(50, 50, 50), font=font_body)

draw.line([(450, 460), (450, 510)], fill=(120, 144, 156), width=4)
draw.polygon([(443, 470), (450, 460), (457, 470)], fill=(120, 144, 156))
draw.polygon([(443, 500), (450, 510), (457, 500)], fill=(120, 144, 156))
draw.text((465, 477), "Mongoose Driver / TCP", fill=(84, 110, 122), font=font_arrow)

draw.line([(1050, 460), (1050, 510)], fill=(120, 144, 156), width=4)
draw.polygon([(1043, 470), (1050, 460), (1057, 470)], fill=(120, 144, 156))
draw.polygon([(1043, 500), (1050, 510), (1057, 500)], fill=(120, 144, 156))
draw.text((1065, 477), "VietQR / SMTP Mail", fill=(84, 110, 122), font=font_arrow)

# --- 3. DATABASE & EXTERNAL LAYER ---
draw.rounded_rectangle([60, 515, 800, 650], radius=12, fill=(232, 245, 233), outline=(76, 175, 80), width=2)
draw.text((80, 527), "TẦNG DỮ LIỆU (DATABASE TIER - MongoDB)", fill=(46, 125, 50), font=font_title)
draw.text((80, 558), "8 Collections: users, students, buildings, rooms, contracts, utility_readings, invoices, payments", fill=(30, 30, 30), font=font_body)
draw.text((80, 584), "• Atomic Operations: findOneAndUpdate + $elemMatch (Zero Overbooking)", fill=(60, 60, 60), font=font_body)
draw.text((80, 610), "• Embedded Subdocuments: Mảng giường nhúng trực tiếp trong từng phòng (Room.beds[])", fill=(60, 60, 60), font=font_body)

draw.rounded_rectangle([830, 515, 1340, 650], radius=12, fill=(252, 228, 236), outline=(233, 30, 99), width=2)
draw.text((850, 527), "DỊCH VỤ NGOÀI (EXTERNAL SERVICES)", fill=(194, 24, 91), font=font_title)
draw.text((850, 558), "• Chuẩn VietQR (NAPAS): Sinh mã QR động đúng số tiền & cú pháp", fill=(30, 30, 30), font=font_body)
draw.text((850, 584), "• SMTP Mail (Nodemailer): Gửi tài khoản & kết quả duyệt đơn", fill=(30, 30, 30), font=font_body)
draw.text((850, 610), "• ExcelJS (Frontend): Đọc/xuất danh sách sinh viên hàng loạt", fill=(30, 30, 30), font=font_body)

output_png = os.path.join(OUT_DIR, 'hinh_3_1_kien_truc_he_thong.png')
img.save(output_png, 'PNG')
print(f'Generated {output_png} successfully')

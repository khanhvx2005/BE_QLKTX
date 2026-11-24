import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'images'))
os.makedirs(OUT_DIR, exist_ok=True)

width = 1350
height = 980

img = Image.new('RGB', (width, height), color=(255, 255, 255))
draw = ImageDraw.Draw(img)

font_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 16)
font_role = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 14)
font_sub = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)
font_msg = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)
font_msg_b = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 13)
font_note = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 12)

participants = [
    ("Cán bộ KTX (Staff)", "Actor", 120),
    ("Giao diện Quản lý HĐ", "React SPA Client", 380),
    ("ContractRoutes", "Express Router + Auth", 650),
    ("ContractService", "Business Logic", 920),
    ("MongoDB Database", "Invoices, Rooms, Contracts", 1200)
]

for name, role, x in participants:
    draw.rounded_rectangle([x - 95, 35, x + 95, 85], radius=8, fill=(240, 248, 255), outline=(2, 136, 209), width=2)
    draw.text((x - 80, 43), name, fill=(1, 87, 155), font=font_role)
    draw.text((x - 80, 63), role, fill=(100, 100, 100), font=font_sub)

    for y in range(95, 920, 12):
        draw.line([(x, y), (x, y + 6)], fill=(180, 190, 200), width=2)

    draw.rounded_rectangle([x - 85, 920, x + 85, 955], radius=6, fill=(240, 248, 255), outline=(2, 136, 209), width=1)
    draw.text((x - 70, 928), name, fill=(1, 87, 155), font=font_sub)

def draw_arrow(x1, x2, y, text, is_bold=False):
    draw.line([(x1, y), (x2, y)], fill=(33, 33, 33), width=2)
    if x2 > x1:
        draw.polygon([(x2 - 8, y - 5), (x2, y), (x2 - 8, y + 5)], fill=(33, 33, 33))
        draw.text((x1 + 10, y - 18), text, fill=(20, 20, 20), font=font_msg_b if is_bold else font_msg)
    else:
        draw.polygon([(x2 + 8, y - 5), (x2, y), (x2 + 8, y + 5)], fill=(33, 33, 33))
        draw.text((x2 + 10, y - 18), text, fill=(20, 20, 20), font=font_msg_b if is_bold else font_msg)

def draw_reply(x1, x2, y, text, color=(100, 116, 139)):
    for x in range(min(x1, x2), max(x1, x2), 8):
        draw.line([(x, y), (x + 4, y)], fill=color, width=2)
    if x2 < x1:
        draw.polygon([(x2 + 8, y - 5), (x2, y), (x2 + 8, y + 5)], fill=color)
        draw.text((x2 + 15, y - 18), text, fill=color, font=font_msg)
    else:
        draw.polygon([(x2 - 8, y - 5), (x2, y), (x2 - 8, y + 5)], fill=color)
        draw.text((x1 + 15, y - 18), text, fill=color, font=font_msg)

draw_arrow(120, 380, 125, "1. Nhập MSSV & Xem chi tiết hợp đồng")
draw_arrow(380, 650, 160, "2. GET /api/contracts/:id")
draw_arrow(650, 920, 195, "3. service.getById(id)")
draw_arrow(920, 1200, 230, "4. Contract.findById(id) + Invoice.find({ contractId })")
draw_reply(1200, 920, 265, "5. Dữ liệu hợp đồng & danh sách hóa đơn")
draw_reply(920, 650, 295, "6. contractView(c, ctx, debts)")
draw_reply(650, 380, 325, "7. 200 OK { code: 'OK', data }")
draw_reply(380, 120, 355, "8. Hiển thị chi tiết hợp đồng & công nợ")

draw_arrow(120, 380, 400, "9. Bấm nút 'Thanh lý hợp đồng & Trả phòng'", is_bold=True)
draw_arrow(380, 650, 435, "10. PATCH /api/contracts/:id/terminate")
draw_arrow(650, 920, 470, "11. service.terminate(id)")
draw_arrow(920, 1200, 505, "12. Invoice.find({ status: 'unpaid', $or: [personal, room utility] })")
draw_reply(1200, 920, 540, "13. Danh sách hóa đơn chưa thanh toán (outstanding)")

draw.rectangle([50, 570, 1300, 880], outline=(245, 124, 0), width=2)
draw.rectangle([50, 570, 110, 595], fill=(245, 124, 0))
draw.text((58, 574), "alt", fill=(255, 255, 255), font=font_title)
draw.text((125, 575), "[Điều kiện: Còn hóa đơn unpaid (cá nhân hoặc điện nước phòng)]", fill=(211, 47, 47), font=font_note)

draw_reply(920, 650, 615, "14a. fail(422, 'OUTSTANDING_INVOICES')", color=(211, 47, 47))
draw_reply(650, 380, 645, "14b. 422 { code: 'OUTSTANDING_INVOICES', data: { invoices } }", color=(211, 47, 47))
draw_reply(380, 120, 675, "14c. Chặn thanh lý, hiển thị danh sách hóa đơn còn nợ", color=(211, 47, 47))

draw.line([(50, 700), (1300, 700)], fill=(245, 124, 0), width=1)
draw.text((60, 705), "[Else: Đã sạch nợ 100% (BR-04)]", fill=(46, 125, 50), font=font_note)

draw_arrow(920, 1200, 735, "15. Contract.findOneAndUpdate({ _id, status: 'active' }, { status: 'terminated', terminatedAt })")
draw_reply(1200, 920, 765, "16. Hợp đồng chuyển sang terminated")
draw_arrow(920, 1200, 795, "17. Room.updateOne({ $elemMatch: { bedNumber, studentId } }, { status: 'available', studentId: null })")
draw_reply(1200, 920, 825, "18. Giải phóng đúng giường về available")

draw_reply(920, 650, 850, "19. { data: { contract }, message }", color=(46, 125, 50))
draw_reply(650, 380, 875, "20. 200 OK { code: 'OK', message: 'Đã thanh lý hợp đồng...' }", color=(46, 125, 50))
draw_reply(380, 120, 905, "21. Cập nhật trạng thái đã thanh lý & mở nút xác nhận hoàn cọc", color=(46, 125, 50))

output_seq = os.path.join(OUT_DIR, 'hinh_3_3_4_sequence_tra_phong.png')
img.save(output_seq, 'PNG')
print(f'Generated {output_seq} successfully')

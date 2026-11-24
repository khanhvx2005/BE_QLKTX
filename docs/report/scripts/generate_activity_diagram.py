import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'images'))
os.makedirs(OUT_DIR, exist_ok=True)

# -------------------------------------------------------------
# 1. GENERATE ACTIVITY DIAGRAM (Hình 3.2.4: Trả phòng & Thanh lý)
# -------------------------------------------------------------
width_act = 1100
height_act = 1000

img_act = Image.new('RGB', (width_act, height_act), color=(255, 255, 255))
draw_act = ImageDraw.Draw(img_act)

font_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 18)
font_lane = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 16)
font_box = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)
font_box_b = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 13)
font_note = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)

# Draw Swimlanes (2 lanes: Staff and System)
# Header
draw_act.rectangle([50, 40, 520, 85], fill=(225, 245, 254), outline=(2, 136, 209), width=2)
draw_act.text((210, 52), "CÁN BỘ KTX (STAFF)", fill=(1, 87, 155), font=font_lane)

draw_act.rectangle([520, 40, 1050, 85], fill=(232, 245, 233), outline=(56, 142, 60), width=2)
draw_act.text((710, 52), "HỆ THỐNG (HaUI - DMS)", fill=(27, 94, 32), font=font_lane)

# Lane bodies
draw_act.rectangle([50, 85, 520, 940], outline=(2, 136, 209), width=2)
draw_act.rectangle([520, 85, 1050, 940], outline=(56, 142, 60), width=2)

# Start node
draw_act.ellipse([270, 105, 300, 135], fill=(33, 33, 33))

# Step 1 (Staff): Chọn menu Hợp đồng & Tìm MSSV
draw_act.line([(285, 135), (285, 160)], fill=(80, 80, 80), width=2)
draw_act.polygon([(281, 155), (285, 162), (289, 155)], fill=(80, 80, 80))

draw_act.rounded_rectangle([150, 162, 420, 212], radius=8, fill=(255, 255, 255), outline=(2, 136, 209), width=2)
draw_act.text((165, 172), "1. Chọn 'Quản lý hợp đồng KTX'", fill=(0, 0, 0), font=font_box_b)
draw_act.text((165, 190), "& Tìm kiếm sinh viên theo MSSV", fill=(50, 50, 50), font=font_box)

# Arrow from Step 1 to Step 2 (Staff -> System)
draw_act.line([(420, 187), (650, 187), (650, 240)], fill=(80, 80, 80), width=2)
draw_act.polygon([(646, 235), (650, 242), (654, 235)], fill=(80, 80, 80))

# Step 2 (System): Hiển thị chi tiết hợp đồng active
draw_act.rounded_rectangle([550, 242, 850, 292], radius=8, fill=(255, 255, 255), outline=(56, 142, 60), width=2)
draw_act.text((565, 252), "2. Hiển thị thông tin chi tiết", fill=(0, 0, 0), font=font_box_b)
draw_act.text((565, 270), "hợp đồng đang hoạt động (active)", fill=(50, 50, 50), font=font_box)

# Arrow Step 2 -> Step 3 (System -> Staff)
draw_act.line([(650, 292), (650, 320), (285, 320), (285, 345)], fill=(80, 80, 80), width=2)
draw_act.polygon([(281, 340), (285, 347), (289, 340)], fill=(80, 80, 80))

# Step 3 (Staff): Bấm nút "Thanh lý & Trả phòng"
draw_act.rounded_rectangle([150, 347, 420, 397], radius=8, fill=(255, 255, 255), outline=(2, 136, 209), width=2)
draw_act.text((165, 357), "3. Bấm chọn nút", fill=(0, 0, 0), font=font_box_b)
draw_act.text((165, 375), "'Thanh lý hợp đồng & Trả phòng'", fill=(50, 50, 50), font=font_box)

# Arrow Step 3 -> Step 4 (Staff -> System)
draw_act.line([(420, 372), (785, 372), (785, 425)], fill=(80, 80, 80), width=2)
draw_act.polygon([(781, 420), (785, 427), (789, 420)], fill=(80, 80, 80))

# Step 4 (System): Kiểm tra công nợ
draw_act.rounded_rectangle([640, 427, 930, 477], radius=8, fill=(255, 255, 255), outline=(56, 142, 60), width=2)
draw_act.text((655, 437), "4. Tự động kiểm tra công nợ", fill=(0, 0, 0), font=font_box_b)
draw_act.text((655, 455), "(HĐ tiền phòng & HĐ điện nước)", fill=(50, 50, 50), font=font_box)

# Arrow to Decision Diamond
draw_act.line([(785, 477), (785, 505)], fill=(80, 80, 80), width=2)
draw_act.polygon([(781, 500), (785, 507), (789, 500)], fill=(80, 80, 80))

# Decision 1 (Diamond): Kiểm tra sạch nợ?
draw_act.polygon([(785, 507), (875, 545), (785, 583), (695, 545)], fill=(255, 248, 225), outline=(245, 124, 0), width=2)
draw_act.text((725, 537), "Đã sạch nợ?", fill=(191, 54, 12), font=font_box_b)

# Branch 1: Còn nợ (Right / Up)
draw_act.line([(875, 545), (980, 545), (980, 600)], fill=(211, 47, 47), width=2)
draw_act.polygon([(976, 595), (980, 602), (984, 595)], fill=(211, 47, 47))
draw_act.text((885, 525), "[Còn nợ unpaid]", fill=(211, 47, 47), font=font_note)

draw_act.rounded_rectangle([860, 602, 1030, 652], radius=8, fill=(255, 235, 238), outline=(211, 47, 47), width=2)
draw_act.text((870, 612), "4a.1 Chặn thao tác &", fill=(183, 28, 28), font=font_box_b)
draw_act.text((870, 630), "Hiển thị cảnh báo đỏ", fill=(183, 28, 28), font=font_box)

# Arrow to End for unpaid
draw_act.line([(945, 652), (945, 680)], fill=(80, 80, 80), width=2)
draw_act.polygon([(941, 675), (945, 682), (949, 675)], fill=(80, 80, 80))
# End node for unpaid
draw_act.ellipse([930, 682, 960, 712], outline=(33, 33, 33), width=2)
draw_act.ellipse([935, 687, 955, 707], fill=(33, 33, 33))

# Branch 2: Sạch nợ (Down to Staff)
draw_act.line([(785, 583), (785, 630), (285, 630), (285, 660)], fill=(46, 125, 50), width=2)
draw_act.polygon([(281, 655), (285, 662), (289, 655)], fill=(46, 125, 50))
draw_act.text((792, 595), "[Sạch nợ 100%]", fill=(46, 125, 50), font=font_note)

# Step 6 (Staff): Kiểm kê tài sản, thu chìa & bấm Xác nhận
draw_act.rounded_rectangle([140, 662, 430, 722], radius=8, fill=(255, 255, 255), outline=(2, 136, 209), width=2)
draw_act.text((155, 672), "6. Kiểm kê tài sản, thu chìa khóa", fill=(0, 0, 0), font=font_box_b)
draw_act.text((155, 695), "& Bấm 'Xác nhận trả phòng'", fill=(50, 50, 50), font=font_box)

# Arrow Step 6 -> Step 7 (Staff -> System)
draw_act.line([(430, 692), (785, 692), (785, 735)], fill=(80, 80, 80), width=2)
draw_act.polygon([(781, 730), (785, 737), (789, 730)], fill=(80, 80, 80))

# Step 7 (System): Giải phóng giường
draw_act.rounded_rectangle([630, 737, 940, 787], radius=8, fill=(255, 255, 255), outline=(56, 142, 60), width=2)
draw_act.text((645, 747), "7. Giải phóng giường về Trống", fill=(0, 0, 0), font=font_box_b)
draw_act.text((645, 765), "status = 'available', xóa studentId", fill=(50, 50, 50), font=font_box)

# Arrow Step 7 -> Step 8
draw_act.line([(785, 787), (785, 810)], fill=(80, 80, 80), width=2)
draw_act.polygon([(781, 805), (785, 812), (789, 805)], fill=(80, 80, 80))

# Step 8 (System): Chuyển hợp đồng terminated
draw_act.rounded_rectangle([630, 812, 940, 862], radius=8, fill=(255, 255, 255), outline=(56, 142, 60), width=2)
draw_act.text((645, 822), "8. Chuyển hợp đồng KTX", fill=(0, 0, 0), font=font_box_b)
draw_act.text((645, 840), "sang trạng thái 'terminated'", fill=(50, 50, 50), font=font_box)

# Arrow Step 8 -> Step 9 (Thông báo & Kết thúc)
draw_act.line([(785, 862), (785, 885)], fill=(80, 80, 80), width=2)
draw_act.polygon([(781, 880), (785, 887), (789, 880)], fill=(80, 80, 80))

draw_act.rounded_rectangle([640, 887, 930, 927], radius=8, fill=(232, 245, 233), outline=(56, 142, 60), width=2)
draw_act.text((655, 898), "9. Thông báo thanh lý thành công", fill=(27, 94, 32), font=font_box_b)

# Final End node
draw_act.line([(785, 927), (785, 945), (480, 945), (480, 960)], fill=(80, 80, 80), width=2)
draw_act.polygon([(476, 955), (480, 962), (484, 955)], fill=(80, 80, 80))

draw_act.ellipse([465, 962, 495, 992], outline=(33, 33, 33), width=2)
draw_act.ellipse([470, 967, 490, 987], fill=(33, 33, 33))

output_act = os.path.join(OUT_DIR, 'hinh_3_2_4_activity_tra_phong.png')
img_act.save(output_act, 'PNG')
print(f'Generated {output_act} successfully')

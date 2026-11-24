import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'images'))
os.makedirs(OUT_DIR, exist_ok=True)

width = 1550
height = 360

img = Image.new('RGB', (width, height), color=(255, 255, 255))
draw = ImageDraw.Draw(img)

# Windows TrueType Fonts
font_step = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 20)
font_sub = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 14)
font_body = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 16)

boxes = [
    {
        'num': '01',
        'title': 'ĐĂNG KÝ ONLINE',
        'sub': 'Cổng tiếp nhận công khai',
        'bg': (240, 248, 255),
        'border': (2, 136, 209),
        'header_bg': (2, 136, 209),
        'bullets': [
            '• Tra cứu phòng theo giới tính',
            '• Chọn phòng tầng thấp trước',
            '• Nộp đơn không cần tài khoản'
        ]
    },
    {
        'num': '02',
        'title': 'DUYỆT & KHÓA PHÒNG',
        'sub': 'Cán bộ KTX thẩm định',
        'bg': (255, 248, 225),
        'border': (245, 124, 0),
        'header_bg': (245, 124, 0),
        'bullets': [
            '• Khóa giường nguyên tử',
            '• Tự cấp tài khoản qua Email',
            '• Tự sinh hóa đơn cọc & phòng'
        ]
    },
    {
        'num': '03',
        'title': 'LƯU TRÚ & THU PHÍ',
        'sub': 'Vận hành định kỳ hàng tháng',
        'bg': (232, 245, 233),
        'border': (56, 142, 60),
        'header_bg': (56, 142, 60),
        'bullets': [
            '• Đổi mật khẩu lần đầu (bắt buộc)',
            '• Chốt 01 HĐ điện nước / phòng',
            '• Quét mã VietQR động / Tiền mặt'
        ]
    },
    {
        'num': '04',
        'title': 'TRẢ PHÒNG & THANH LÝ',
        'sub': 'Kết thúc thời hạn hợp đồng',
        'bg': (252, 228, 236),
        'border': (194, 24, 91),
        'header_bg': (194, 24, 91),
        'bullets': [
            '• Kiểm tra sạch nợ cá nhân & phòng',
            '• Kiểm kê tài sản, thu chìa khóa',
            '• Giải phóng giường về Trống'
        ]
    }
]

box_w = 325
box_h = 260
y_start = 50
gap = 45
x_start = 45

for i, b in enumerate(boxes):
    x = x_start + i * (box_w + gap)
    y = y_start
    
    # Outer box
    draw.rounded_rectangle([x, y, x + box_w, y + box_h], radius=10, fill=b['bg'], outline=b['border'], width=2)
    
    # Header box
    draw.rounded_rectangle([x, y, x + box_w, y + 62], radius=10, fill=b['header_bg'])
    draw.rectangle([x, y + 42, x + box_w, y + 62], fill=b['header_bg'])
    
    # Text in header
    draw.text((x + 16, y + 10), f"{b['num']}. {b['title']}", fill=(255, 255, 255), font=font_step)
    draw.text((x + 16, y + 36), b['sub'], fill=(230, 240, 250), font=font_sub)
    
    # Bullets
    by = y + 80
    for bullet in b['bullets']:
        draw.text((x + 16, by), bullet, fill=(35, 35, 35), font=font_body)
        by += 38

    # Arrow to next box
    if i < 3:
        ax = x + box_w + 8
        ay = y + box_h // 2
        draw.line([(ax, ay), (ax + 20, ay)], fill=(140, 160, 175), width=4)
        draw.polygon([(ax + 20, ay - 7), (ax + 30, ay), (ax + 20, ay + 7)], fill=(140, 160, 175))

output_png = os.path.join(OUT_DIR, 'hinh_2_1_quy_trinh_nghiep_vu.png')
img.save(output_png, 'PNG')
print(f'Saved {output_png}')

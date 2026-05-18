from PIL import Image
import os

LOGO_SRC = r"E:\BracketWorks Logos\logo.png"
ICONS_DIR = r"E:\BracketWorks\frontend\public\icons"
BG_COLOR = (30, 30, 30, 255)  # #1e1e1e with full opacity
LOGO_SCALE = 0.62  # logo occupies 62% of icon — fits within Android safe zone

def make_icon(size):
    canvas = Image.new("RGBA", (size, size), BG_COLOR)
    logo = Image.open(LOGO_SRC).convert("RGBA")
    logo_size = int(size * LOGO_SCALE)
    logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
    offset = (size - logo_size) // 2
    canvas.paste(logo, (offset, offset), logo)
    return canvas.convert("RGB")

if not os.path.exists(ICONS_DIR):
    os.makedirs(ICONS_DIR)

icon512 = make_icon(512)
icon512.save(os.path.join(ICONS_DIR, "icon-512.png"), "PNG", optimize=True)
print("Saved icon-512.png")

icon192 = make_icon(192)
icon192.save(os.path.join(ICONS_DIR, "icon-192.png"), "PNG", optimize=True)
print("Saved icon-192.png")

icon180 = make_icon(180)
icon180.save(os.path.join(ICONS_DIR, "apple-touch-icon.png"), "PNG", optimize=True)
print("Saved apple-touch-icon.png")

apple_root = r"E:\BracketWorks\frontend\public\apple-touch-icon.png"
icon180.save(apple_root, "PNG", optimize=True)
print("Saved public/apple-touch-icon.png")

print("Done.")

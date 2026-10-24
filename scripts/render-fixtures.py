#!/usr/bin/env python3
"""
Render deterministic test fixtures for real OCR-pipeline validation.

These are SYNTHETIC rendered labels (not photographs of real packages) used to
exercise the real tesseract.js OCR + v2 parser end-to-end. Values mirror the
public Maggi 2-Minute Masala Noodles 70 g label.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "fixtures")
os.makedirs(OUT, exist_ok=True)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def draw_page(name, lines, size=(900, 1200), blur=None):
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    y = 60
    for line in lines:
        font = ImageFont.truetype(FONT if line.get("bold", False) else FONT_R, line.get("px", 44))
        d.text((line.get("x", 60), y), line["t"], fill="black", font=font)
        y += line.get("h", 74)
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    path = os.path.join(OUT, name)
    img.save(path)
    print("wrote", path)

# --- Maggi front package ---
img = Image.new("RGB", (1100, 1500), "white")
d = ImageDraw.Draw(img)
d.text((80, 100), "MAGGI", fill="black", font=ImageFont.truetype(FONT, 84))
d.text((80, 260), "2-Minute Masala Noodles", fill="black", font=ImageFont.truetype(FONT_R, 56))
d.text((80, 360), "70 g", fill="black", font=ImageFont.truetype(FONT, 56))
d.text((80, 480), "Nestle India Ltd", fill="black", font=ImageFont.truetype(FONT_R, 44))
d.text((80, 560), "Simply Good", fill="black", font=ImageFont.truetype(FONT_R, 44))
img.save(os.path.join(OUT, "maggi-front.png"))
print("wrote", os.path.join(OUT, "maggi-front.png"))

# --- Maggi back: two-column nutrition table + ingredients (Indian layout) ---
back = [
    {"t": "MAGGI", "bold": True, "px": 70, "h": 110},
    {"t": "Nutrition Information", "bold": True, "px": 42, "h": 80},
]
# Header row: columns at fixed x positions, wide gaps so OCR preserves them
table = [
    ("",              "Per 100g",      "Per Serving (30g)"),
    ("Energy",        "406 kcal",      "122 kcal"),
    ("Protein",       "9.1 g",         "2.7 g"),
    ("Total Fat",     "14.8 g",        "4.4 g"),
    ("Saturated Fat", "6.9 g",         "2.1 g"),
    ("Trans Fat",     "0 g",           "0 g"),
    ("Sodium",        "910 mg",        "273 mg"),
    ("Total Carbohydrate", "60.2 g",   "18.1 g"),
    ("Dietary Fibre", "3.4 g",         "1.0 g"),
    ("Total Sugars",  "4.1 g",         "1.2 g"),
    ("Added Sugars",  "2.2 g",         "0.7 g"),
]
img = Image.new("RGB", (1500, 1700), "white")
d = ImageDraw.Draw(img)
f_big = ImageFont.truetype(FONT, 70)
f_hdr = ImageFont.truetype(FONT_R, 48)
f_row = ImageFont.truetype(FONT_R, 52)
d.text((80, 60), "MAGGI", fill="black", font=f_big)
d.text((80, 180), "Nutrition Information", fill="black", font=f_hdr)
COL = [(80, 0), (760, 0), (1150, 0)]
y = 280
for i, (label, c1, c2) in enumerate(table):
    font = f_hdr if i == 0 else f_row
    d.text((COL[0][0], y), label, fill="black", font=font)
    d.text((COL[1][0], y), c1, fill="black", font=font)
    d.text((COL[2][0], y), c2, fill="black", font=font)
    y += 80
y += 60
d.text((80, y), "INGREDIENTS: Wheat Flour (58%), Palm Oil, Mineral Salts,", fill="black", font=f_row)
y += 70
d.text((60, y), "Guar Gum, Chilli Powder", fill="black", font=f_row)
y += 90
d.text((80, y), "ALLERGY ADVICE: Contains wheat. May contain milk and mustard.", fill="black", font=f_row)
img.save(os.path.join(OUT, "maggi-back.png"))
print("wrote", os.path.join(OUT, "maggi-back.png"))

# --- Blurry label (quality-gate + OCR-failure fixture) ---
draw_page("blurry-label.png", [
    {"t": "Nutrition Information", "bold": True},
    {"t": "Energy  406 kcal"},
    {"t": "Protein 9.1 g"},
    {"t": "Per 100g"},
], blur=8)

# --- Food-like image with NO text (ambiguity fixture) ---
img = Image.new("RGB", (800, 600), (240, 235, 225))
d = ImageDraw.Draw(img)
d.ellipse((200, 180, 600, 460), fill=(194, 138, 68))
d.polygon([(300, 250), (500, 250), (400, 180)], fill=(150, 100, 50))
img.filter(ImageFilter.GaussianBlur(0.6)).save(os.path.join(OUT, "no-text-food.png"))
print("wrote", os.path.join(OUT, "no-text-food.png"))

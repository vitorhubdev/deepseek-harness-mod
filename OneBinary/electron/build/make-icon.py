"""Cut checkerboard from the whale JPEG and write PNG + multi-size ICO."""
from pathlib import Path

from PIL import Image

root = Path(r"C:\Users\jzv\.grok\sessions")
hits = list(root.rglob("images/2.jpg"))
if not hits:
    hits = list(root.rglob("images/1.jpg"))
if not hits:
    raise SystemExit("source whale jpg not found")
src = hits[0]

img = Image.open(src).convert("RGBA")
px = img.load()
w, h = img.size
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        # white / near-white paper becomes transparent; keep the black whale and white eye
        if r > 230 and g > 230 and b > 230:
            px[x, y] = (0, 0, 0, 0)

# crop to content
bbox = img.getbbox()
if bbox is None:
    raise SystemExit("empty after chroma")
img = img.crop(bbox)
# pad square
side = max(img.size) + 48
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
ox = (side - img.size[0]) // 2
oy = (side - img.size[1]) // 2
canvas.paste(img, (ox, oy), img)

out_dir = Path(__file__).resolve().parent
png = out_dir / "icon.png"
canvas.resize((512, 512), Image.Resampling.LANCZOS).save(png)
splash = out_dir.parent / "assets" / "whale.png"
splash.parent.mkdir(parents=True, exist_ok=True)
canvas.resize((256, 256), Image.Resampling.LANCZOS).save(splash)

ico_path = out_dir / "icon.ico"
canvas.resize((256, 256), Image.Resampling.LANCZOS).save(ico_path, format="ICO", sizes=[(256, 256), (64, 64), (48, 48), (32, 32), (16, 16)])

# NSIS portable extract splash: 24-bit BMP, no alpha.
from PIL import ImageDraw, ImageFont
bmp = Image.new("RGB", (560, 360), (10, 10, 12))
whale = canvas.resize((180, 180), Image.Resampling.LANCZOS)
bmp.paste(whale, ((560 - 180) // 2, 48), whale)
draw = ImageDraw.Draw(bmp)
draw.text((280, 250), "DeepMod", fill=(230, 230, 230), anchor="mm")
draw.text((280, 286), "A abrir… a extrair pela primeira vez", fill=(139, 139, 148), anchor="mm")
bmp_path = out_dir / "portable-splash.bmp"
bmp.save(bmp_path, format="BMP")
print(f"wrote {png} {ico_path} {splash} {bmp_path} ico={ico_path.stat().st_size}")

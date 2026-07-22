from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "bsa-logo.png"
ICONS = ROOT / "public" / "icons"
WINE = (38, 7, 17, 255)


def make_icon(size: int, filename: str, safe_scale: float = 0.82) -> None:
    logo = Image.open(SOURCE).convert("RGBA")
    canvas = Image.new("RGBA", (size, size), WINE)
    max_width = int(size * safe_scale)
    max_height = int(size * safe_scale)
    ratio = min(max_width / logo.width, max_height / logo.height)
    resized = logo.resize(
        (max(1, round(logo.width * ratio)), max(1, round(logo.height * ratio))),
        Image.Resampling.LANCZOS,
    )
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    canvas.convert("RGB").save(ICONS / filename, "PNG", optimize=True)


ICONS.mkdir(parents=True, exist_ok=True)
make_icon(512, "icon-512.png")
make_icon(192, "icon-192.png")
make_icon(512, "maskable-512.png", 0.68)
make_icon(192, "maskable-192.png", 0.68)
make_icon(180, "apple-touch-icon.png", 0.78)
make_icon(32, "favicon-32.png", 0.82)

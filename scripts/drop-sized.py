"""Regenerate drop-art/sized/*.webp (480/800 wide) from mockups + previews. Skips held designs. Run: python3 scripts/drop-sized.py"""
from PIL import Image; import os, glob
HELD: list[str] = []  # file prefixes of held designs (none since 2026-11-02)
os.makedirs("drop-art/sized", exist_ok=True)
for src in glob.glob("drop-art/mockups/*.jpg") + glob.glob("drop-art/preview/*.webp"):
    base = os.path.basename(src).rsplit(".", 1)[0]
    if any(base.startswith(h) for h in HELD): continue
    im = Image.open(src).convert("RGB")
    for w in (480, 800):
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(f"drop-art/sized/{base}-{w}.webp", "WEBP", quality=78, method=6)

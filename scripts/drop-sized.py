"""Regenerate drop-art/sized/*.webp (480/800 wide) from mockups + previews. Skips held designs.
Run: python3 scripts/drop-sized.py [file-prefix ...]   (e.g. v5- to only (re)build the v5 designs)"""
from PIL import Image; import os, glob, sys
HELD = []  # file prefixes of held designs (v5 released by Cooper on 2026-11-12)
ONLY = sys.argv[1:]
os.makedirs("drop-art/sized", exist_ok=True)
for src in glob.glob("drop-art/mockups/*.jpg") + glob.glob("drop-art/preview/*.webp"):
    base = os.path.basename(src).rsplit(".", 1)[0]
    if any(base.startswith(h) for h in HELD): continue
    if ONLY and not any(base.startswith(o) for o in ONLY): continue
    im = Image.open(src).convert("RGB")
    for w in (480, 800):
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(f"drop-art/sized/{base}-{w}.webp", "WEBP", quality=78, method=6)

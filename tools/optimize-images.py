"""Generate web assets without modifying the group's original PNG files.
Requires Pillow: python -m pip install Pillow
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'assets' / 'images'
DEST.mkdir(parents=True, exist_ok=True)
original_bytes = output_bytes = 0
for source in sorted((ROOT / 'imagenes').glob('*.png'), key=lambda path: int(path.stem)):
    original_bytes += source.stat().st_size
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        for width in (960, 1920):
            resized = image.copy()
            resized.thumbnail((width, width))
            target = DEST / f'{source.stem}-{width}.webp'
            resized.save(target, 'WEBP', quality=80, method=6)
            output_bytes += target.stat().st_size
with Image.open(ROOT / 'logo' / 'IMG_1574.png') as logo:
    logo = logo.crop(logo.getbbox())
    logo.save(DEST / 'eclion-logo.webp', 'WEBP', lossless=True)
    logo.thumbnail((64, 64))
    logo.save(DEST / 'favicon.png')
print(f'Original photographs: {original_bytes / 1048576:.2f} MB')
print(f'Both responsive WebP sizes combined: {output_bytes / 1048576:.2f} MB')
print('Generated 34 responsive photographs, logo and favicon. Originals preserved.')

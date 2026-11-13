"""Genera icona, icone adattive Android, splash e favicon di AccessBZ.

Usa il glifo "wheelchair-accessibility" di Material Design Icons (lo stesso set dell'app).
Uso (dalla cartella app):  ..\\backend\\.venv\\Scripts\\python scripts\\make_icons.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
VI = ROOT / "node_modules" / "@expo" / "vector-icons" / "build" / "vendor" / "react-native-vector-icons"
FONT = VI / "Fonts" / "MaterialCommunityIcons.ttf"
GLYPHS = json.loads((VI / "glyphmaps" / "MaterialCommunityIcons.json").read_text(encoding="utf-8"))

TOP = (46, 104, 240)     # #2E68F0
BOTTOM = (26, 63, 174)   # #1A3FAE (colors.primaryDark)
WHITE = (255, 255, 255, 255)
GLYPH = chr(GLYPHS["wheelchair-accessibility"])


def gradient(size):
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))  # diagonale
            px[x, y] = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,)
    return img


def glyph(size, glyph_px, color=WHITE):
    """Glifo centrato otticamente su una tela trasparente."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    font = ImageFont.truetype(str(FONT), glyph_px)
    d = ImageDraw.Draw(layer)
    l, t, r, b = d.textbbox((0, 0), GLYPH, font=font)
    d.text(((size - (r - l)) / 2 - l, (size - (b - t)) / 2 - t), GLYPH, font=font, fill=color)
    return layer


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def main():
    # Icona principale (iOS/Android legacy): quadrata, senza trasparenza
    icon = gradient(1024)
    icon.alpha_composite(glyph(1024, 640))
    icon.convert("RGB").save(ASSETS / "icon.png")

    # Android adaptive icon: il contenuto deve stare nel cerchio centrale (~66%)
    fg = glyph(1024, 470)
    fg.save(ASSETS / "android-icon-foreground.png")
    gradient(1024).convert("RGB").save(ASSETS / "android-icon-background.png")
    glyph(1024, 470, color=(255, 255, 255, 255)).save(ASSETS / "android-icon-monochrome.png")

    # Splash: tessera arrotondata con il logo, su sfondo chiaro
    tile = gradient(1024)
    tile.alpha_composite(glyph(1024, 600))
    tile.putalpha(rounded_mask(1024, 230))
    tile.save(ASSETS / "splash-icon.png")

    # Favicon per la versione web di prova
    fav = gradient(192)
    fav.alpha_composite(glyph(192, 128))
    fav.putalpha(rounded_mask(192, 44))
    fav.resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png")
    print("Icone generate in", ASSETS)


if __name__ == "__main__":
    main()

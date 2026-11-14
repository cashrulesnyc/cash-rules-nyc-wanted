#!/usr/bin/env python3
"""Build dist/index.html (one self-contained file) from src/.

SHARED scripts run on the main thread AND inside the chunk-generation Web Worker,
so they must never touch the DOM, WebGL, or anything in the MAIN scripts.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
SHARED = ['data.js', 'map.js', 'chunkgen.js']
MAIN = ['gl.js', 'world.js', 'vehicles.js', 'game.js']


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


shared = '\n'.join(read(f) for f in SHARED)
main = '\n'.join(read(f) for f in MAIN)
for label, code in (('SHARED', shared), ('MAIN', main)):
    if '</script' in code:
        raise SystemExit(f'{label} code contains "</script" which would break the inline <script> tag')

html = read('index.html').replace('/*SHARED*/', shared).replace('/*MAIN*/', main)
DIST = os.path.join(ROOT, 'dist')
os.makedirs(DIST, exist_ok=True)
with open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print(f'built dist/index.html ({len(html) // 1024} KB)')

# ---- optional PWA extras (Add to Home Screen + offline). The game itself stays one file:
# index.html still runs on its own (file://, Netlify Drop, artifacts); these only add install/offline.
import hashlib, json, shutil
version = hashlib.sha1(html.encode('utf-8')).hexdigest()[:10]
os.makedirs(os.path.join(DIST, 'icons'), exist_ok=True)
icons = sorted(os.listdir(os.path.join(ROOT, 'assets', 'icons')))
for n in icons:
    shutil.copyfile(os.path.join(ROOT, 'assets', 'icons', n), os.path.join(DIST, 'icons', n))
manifest = {
    'name': 'CASH RULES NYC: WANTED', 'short_name': 'CR NYC', 'id': './', 'start_url': './', 'scope': './',
    'display': 'fullscreen', 'orientation': 'landscape', 'background_color': '#0b0d10', 'theme_color': '#0b0d10',
    'description': 'Police chase across all five NYC boroughs. Lose the heat at Cash Rules Customs.',
    'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any maskable'},
              {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}],
}
with open(os.path.join(DIST, 'manifest.webmanifest'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=1)
precache = ['./', 'index.html', 'manifest.webmanifest'] + ['icons/' + n for n in icons]
with open(os.path.join(SRC, 'sw.js'), encoding='utf-8') as f:
    sw = f.read().replace('__VERSION__', version).replace('__PRECACHE__', json.dumps(precache))
with open(os.path.join(DIST, 'sw.js'), 'w', encoding='utf-8') as f:
    f.write(sw)
print(f'built PWA extras (sw {version}, {len(icons)} icons)')

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
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
with open(os.path.join(ROOT, 'dist', 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print(f'built dist/index.html ({len(html) // 1024} KB)')

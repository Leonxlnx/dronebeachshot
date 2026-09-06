#!/usr/bin/env python3
"""Restore losslessly archived runtime assets. Run from any directory."""
from pathlib import Path
import hashlib, io, json, zipfile
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'recovery/asset-parts/manifest.json').read_text())
chunks = []
for part in manifest['parts']:
    data = (root / 'recovery' / part['path']).read_bytes()
    if len(data) != part['size'] or hashlib.sha256(data).hexdigest() != part['sha256']:
        raise SystemExit('Asset part checksum failed: ' + part['path'])
    chunks.append(data)
data = b''.join(chunks)
if hashlib.sha256(data).hexdigest() != manifest['sha256']:
    raise SystemExit('Archive checksum failed')
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    for name in archive.namelist():
        dest = (root / name).resolve()
        if not dest.is_relative_to(root / 'public'):
            raise SystemExit('Unexpected archive path: ' + name)
    archive.extractall(root)
print('Restored public assets; all SHA-256 checks passed.')

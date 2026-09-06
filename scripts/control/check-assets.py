import hashlib,io,json,struct
from pathlib import Path
from PIL import Image
root=Path('public/assets');manifest=json.loads((root/'manifest.json').read_text());seen=[]
for item in manifest:
 p=Path(item['path']);assert p.is_file(),p
 raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==item['sha256'],f'Checksum mismatch {p}'
 assert item['license']=='CC0-1.0';assert item.get('sourcePage');seen.append(str(p))
 if p.suffix=='.webp':
  image=Image.open(p);assert max(image.size)<=2048
  if item.get('dimensions'):assert list(image.size)==item['dimensions']
 if p.suffix=='.glb':
  assert raw[:4]==b'glTF';n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);pos=20+n;binary=raw[pos+8:]
  assert all('uri' not in b for b in doc.get('buffers',[]));assert all('uri' not in im for im in doc.get('images',[]))
  for mat in doc.get('materials',[]):
   if mat.get('alphaMode')=='MASK':
    texture=doc['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']];imageIndex=texture.get('extensions',{}).get('EXT_texture_webp',{}).get('source',texture.get('source'))
    im=doc['images'][imageIndex];v=doc['bufferViews'][im['bufferView']];off=v.get('byteOffset',0);image=Image.open(io.BytesIO(binary[off:off+v['byteLength']]))
    assert image.mode=='RGBA',f'{p} masked texture has no alpha';assert image.getextrema()[3]==(0,255),f'{p} alpha is not meaningful'
  for im in doc.get('images',[]):
   v=doc['bufferViews'][im['bufferView']];off=v.get('byteOffset',0);image=Image.open(io.BytesIO(binary[off:off+v['byteLength']]))
   limit=item.get('maxTextureDimension',1024);assert limit in [1024,2048]
   assert max(image.size)<=limit
assert set(seen)=={str(p) for p in root.rglob('*') if p.is_file() and p.name!='manifest.json'}
print(f'ASSET_CHECK_PASS: {len(seen)} vendored files; checksums, CC0 sources, embedded GLB resources and leaf alpha verified')

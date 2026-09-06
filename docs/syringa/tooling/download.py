"""Download original CC0 Tree Small 02 assets without changing their bytes."""
import pathlib,json,subprocess,hashlib,concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'source'
BASE='https://dl.polyhaven.org/file/ph-assets/Models'
gltf=SRC/'tree_small_02_1k.gltf'
SRC.mkdir(parents=True,exist_ok=True)
if not gltf.exists():subprocess.run(['curl','-fsSL','--retry','2','--max-time','60',BASE+'/gltf/1k/tree_small_02/tree_small_02_1k.gltf','-o',str(gltf)],check=True)
j=json.loads(gltf.read_text())
items=[(gltf,BASE+'/gltf/1k/tree_small_02/tree_small_02_1k.gltf')]
for im in j['images']:
 items.append((SRC/im['uri'],BASE+'/jpg/1k/tree_small_02/'+pathlib.Path(im['uri']).name))
items += [(SRC/'tree_small_02.bin',BASE+'/gltf/8k/tree_small_02/tree_small_02.bin')]
for map in ['diff','alpha']:
 name=f'tree_small_02_leaves_{map}_1k.png'
 items.append((SRC/'textures'/name,BASE+'/png/1k/tree_small_02/'+name))
def download(it):
 p,url=it;p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():subprocess.run(['curl','-fsSL','--retry','2','--max-time','180',url,'-o',str(p)],check=True)
 data=p.read_bytes();print(p.name,len(data),flush=True)
 return {'file':str(p.relative_to(ROOT)),'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:manifest=list(ex.map(download,items))
(ROOT/'download-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

import urllib.request,json,hashlib,concurrent.futures,io
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).parent
ua={'User-Agent':'LastLightBay-material-research/1.0 (creative CC0 material inspection)'}
def get(url):return urllib.request.urlopen(urllib.request.Request(url,headers=ua),timeout=45).read()
def item(name):
 info=json.loads((root/(name+'-info.json')).read_text());files=json.loads((root/(name+'-files.json')).read_text());(root/(name+'-info.json')).write_text(json.dumps(info,indent=2));(root/(name+'-files.json')).write_text(json.dumps(files,indent=2))
 entry=files['Diffuse']['1k']['jpg'];raw=get(entry['url']);assert len(raw)==entry['size'];assert hashlib.md5(raw).hexdigest()==entry['md5'];(root/(name+'-diff-1k.jpg')).write_bytes(raw);return name
names=['sand_02','sand_03','aerial_sand']
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
 for name in ex.map(item,names):print(name,flush=True)
out=Image.new('RGB',(768,288),'#333333');draw=ImageDraw.Draw(out)
for i,name in enumerate(names):out.paste(Image.open(root/(name+'-diff-1k.jpg')).resize((256,256)),(i*256,32));draw.text((i*256+8,8),name,fill='white')
out.save(root/'sand-candidates.jpg',quality=94)

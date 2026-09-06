import json,pathlib,struct,hashlib
root=pathlib.Path('/workspace/scratch/2b912ce37941/native-render');src=root/'hero-rock-source/rock_moss_set_01_2k.glb';raw=src.read_bytes();jl=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+jl]);original=raw[28+jl:];payload=bytearray();meshes=[]
def stream(accessor_id):
 a=gltf['accessors'][accessor_id];assert 'sparse' not in a
 v=gltf['bufferViews'][a['bufferView']];components={'SCALAR':1,'VEC3':3}[a['type']];bytes_per={5126:4,5123:2,5125:4}[a['componentType']]
 assert v.get('byteStride',components*bytes_per)==components*bytes_per
 start=v.get('byteOffset',0)+a.get('byteOffset',0);length=a['count']*components*bytes_per
 data=original[start:start+length];assert len(data)==length
 while len(payload)%4:payload.append(0)
 info={'byteOffset':len(payload),'byteLength':length,'count':a['count'],'componentType':a['componentType'],'itemSize':components,'sha256':hashlib.sha256(data).hexdigest()};payload.extend(data);return info
for node_id in gltf['scenes'][gltf.get('scene',0)]['nodes']:
 node=gltf['nodes'][node_id];assert not node.get('children') and 'skin' not in node
 m=gltf['meshes'][node['mesh']];assert len(m['primitives'])==1;p=m['primitives'][0];assert p.get('mode',4)==4
 meshes.append({'name':node['name'],'geometryName':m.get('name',''),'transform':{k:node[k] for k in ['translation','rotation','scale','matrix'] if k in node},'position':stream(p['attributes']['POSITION']),'index':stream(p['indices'])})
while len(payload)%4:payload.append(0)
metadata={'format':'rock-geometry-v1','family':'rock_moss_set_01','sourceGlbSha256':hashlib.sha256(raw).hexdigest(),'source':'https://polyhaven.com/a/rock_moss_set_01','license':'CC0-1.0','sceneName':gltf['scenes'][gltf.get('scene',0)].get('name',''),'byteOrder':'little-endian','payloadBytes':len(payload),'meshes':meshes,'omitted':['normals','UVs','images','materials'],'changes':'Only original POSITION and index byte ranges copied. No reordering, simplification, quantization or transformation.'}
encoded=json.dumps(metadata,separators=(',',':')).encode();header=struct.pack('<4sIII',b'RKG1',1,len(encoded),len(payload));padding=b'\x00'*((-(16+len(encoded)))%4);pack=header+encoded+padding+payload
out=root/'hero-rock-source/rock_moss_set_01_geometry.bin';out.write_bytes(pack)
metadata['pack']={'path':str(out),'bytes':len(pack),'sha256':hashlib.sha256(pack).hexdigest(),'metadataBytes':len(encoded),'payloadOffset':16+len(encoded)+len(padding)}
(root/'hero-rock-source/rock_moss_set_01_geometry.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({'pack':metadata['pack'],'meshes':len(meshes),'positionBytes':sum(m['position']['byteLength'] for m in meshes),'indexBytes':sum(m['index']['byteLength'] for m in meshes)},indent=2))

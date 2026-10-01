from pathlib import Path
import json,datetime,numpy as np
out=Path(__file__).resolve().parent
m=json.loads((out/'metrics.json').read_text());r=m['frames']
manifest=json.loads((out/'manifest-snapshot.json').read_text())
inspected=[13,14,15,22,24,26,45,46,47,103,104,105,179,180,181,212,213,214,248,249,250]
candidates=[
 {'transition':[13,14],'time':[13/24,14/24],'status':'not_confirmed','evidence':'Strongest local-patch anomaly, robust z 5.227; full-frame normalized z 2.678. Worst patch is sky/sun column around native (320,80), and estimated horizontal translation hits search limit (+8 analysis pixels). Original frames 13/14/15 show continuous camera tilt and sky motion; no discrete forest/lighting pop apparent.'},
 {'transition':[23,24],'time':[23/24,24/24],'status':'explained_camera_composition','evidence':'Largest whole-frame mean luma step -0.012778 (display proxy, 1.278% full scale) and RGB channel mean step 0.017274. Adjacent steps 22–29 form a smooth decrease as bright horizon exits the top of the view; original frames 22/24/26 agree. No isolated flash.'},
 {'transition':[45,46],'time':[45/24,46/24],'status':'no_resume_discontinuity_found','evidence':'Capture restart boundary. Motion-normalized MAE 0.005626, local robust z -0.213, 17.8th percentile of prefix residuals. Original frames 45/46/47 show consistent geometry, light and motion.'},
 {'transition':[103,105],'time':[103/24,105/24],'status':'not_confirmed','evidence':'Raised normalized residuals 0.017144/0.017481 around 4.33–4.375 s, local robust z 2.290/1.996. Worst patch native (80,280) is near foliage/terrain with parallax and thin leaves. Original frames 103/104/105 show continuous near-canopy motion; small foliage shimmer remains a visual-quality concern, but no discrete LOD replacement is established.'},
 {'transition':[179,181],'time':[179/24,181/24],'status':'explained_animated_water_candidate','evidence':'Normalized robust z 2.451/2.397, strongest patch native (80,80) over animated reflective water. Original frames 179/180/181 show smooth wave/camera progression, not an isolated flash.'},
 {'transition':[212,214],'time':[212/24,214/24],'status':'explained_camera_and_water_motion','evidence':'Prefix raw MAE maximum 0.045269 occurs at frame 213, but motion-normalized MAE falls to 0.012032 with local robust z 0.008. Original frames 212/213/214 show strong consistent coastal tracking and animated water, no abrupt state change.'},
 {'transition':[248,249],'time':[248/24,249/24],'status':'not_confirmed','evidence':'Local-patch robust z 4.371, while mean normalized residual z is -0.145. Worst patch native (320,280) is moving reflective water, correlation 0.571. Original frames 248/249/250 show stable shore/forest geometry and lighting; water motion explains the low match confidence.'},
 {'transition':[252,253],'time':[252/24,253/24],'status':'endpoint_candidate_only','evidence':'Mean normalized robust z 3.358 at snapshot endpoint has one-sided neighborhood support and modest absolute residual 0.016972; no subsequent committed frames were included. Do not classify this as a confirmed jump.'}
]
summary={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':m['scope'],'result':'No confidently identified abrupt LOD pop or whole-frame lighting flash in the reviewed prefix. This is a limited screening result, not temporal-quality acceptance.','checks':{'all254PngHashesVerified':all(x['hashVerified'] for x in r),'consecutiveIndicesAnd24fpsTimes':all(x['index']==i and abs(x['time']-i/24)<1e-7 for i,x in enumerate(r)),'uniquePngHashes':len(set(x['sha256'] for x in manifest['frames'])),'noExactDuplicateFrames':len(set(x['sha256'] for x in manifest['frames']))==len(r),'maxAbsoluteFrameMeanLumaStep':max(abs(x['signedLuma']) for x in r[1:]),'maxAbsoluteFrameMeanRGBChannelStep':max(float(max(abs(np.array(r[i]['meanRGB'])-np.array(r[i-1]['meanRGB'])))) for i in range(1,len(r))),'resumeBoundaryIndex':46,'fullOriginalPngsVisuallyInspected':inspected},'candidates':candidates,'limitations':['Only frames 0–253 (0–10.54166667 s), 254/480 nominal frames; remaining flight not reviewed.','Statistics use 160x90 analysis arrays and local translation compensation, not full optical flow; subpixel leaves, parallax and shader animation may escape or trigger the screen.','Twenty-one original full-resolution PNGs inspected individually, not a complete real-time video playback.','Pinned candidate-10 source ee114c8d7bf6eca95ce22fe39a35e16f00e779974c773861829e36c84c1dfbd8; new coastal reflection, sand drying, cloud morphology and other pending studies are absent.','No active film, lock, encoding output, source file, browser or GPU modified.']}
(out/'review.json').write_text(json.dumps(summary,indent=2)+'\n')
md='''# Motion prefix review 01

**No confidently identified abrupt LOD pop or whole-frame lighting flash in this prefix.** This is screening evidence, not a quality acceptance or review of the complete 20-second film.

Snapshot: **254 frames, indices 0–253, 0–10.54166667 s at 24 fps**, 640×360. All 254 PNG SHA-256 hashes match the single manifest snapshot; indices/timestamps are consecutive; all PNG hashes are distinct. Source is pinned candidate 10 (`ee114c8d7bf6eca95ce22fe39a35e16f00e779974c773861829e36c84c1dfbd8`). New visual studies are absent.

Analysis uses 160×90 RGB arrays, display-luma/color/edge measurements and 15 local translation matches per adjacent pair. Raw difference is normalized using ±8-pixel patch correlation with a subpixel peak. The analysis never edits the actual PNGs. Twenty-one original 640×360 PNGs were inspected.

| Transition | Time | Evidence and judgment |
|---|---|---|
| 13→14 | 0.5417→0.5833 s | Strongest local outlier (z 5.23) lies in sky/sun column; matching hits search bound. Frames 13/14/15 show continuous tilt, no confirmed pop. |
| 23→24 | 0.9583→1.0000 s | Largest mean luma step, −1.278% of display scale; part of smooth multi-frame decrease as bright horizon exits. No isolated flash. |
| 45→46 | 1.8750→1.9167 s | Restart boundary is unremarkable: normalized residual 0.005626, local z −0.21, prefix 17.8th percentile. Original frames 45/46/47 agree. |
| 103–105 | 4.2917–4.3750 s | Elevated residual in lower-left foreground leaves/terrain; parallax and fine foliage are visible. No discrete LOD replacement established. Foliage shimmer still merits video-level assessment. |
| 179–181 | 7.4583–7.5417 s | Strongest patch is reflective animated water; frames show continuous waves and camera movement. |
| 212–214 | 8.8333–8.9167 s | Largest raw difference at 213 drops from 0.04527 to 0.01203 after local motion compensation; normalized local z 0.008. Coastal tracking remains consistent. |
| 248→249 | 10.3333→10.3750 s | Local z 4.37 comes from moving water at native pixel center (320,280), low correlation 0.571. Whole-patch mean z −0.145 and original frames 248/249/250 show stable shore/forest. |
| 252→253 | 10.5000→10.5417 s | Endpoint-only normalized z 3.36; one-sided neighborhood and no following frames in snapshot. Candidate only, not a confirmed defect. |

The patch model cannot fully remove perspective, occlusion, parallax or animated water. Downsampling can hide fine foliage flicker. This was individual-frame inspection rather than complete video playback. Remaining 226 nominal frames were not read or reviewed.

Evidence: `manifest-snapshot.json`, complete numeric `metrics.json`, concise `review.json`, reproducible `analyze.py` and `summarize.py`. CPU/file work only; active film, lock, encoding, browser and GPU untouched.
'''
(out/'review.md').write_text(md)
print(json.dumps({'scope':summary['scope'],'result':summary['result'],'evidence':str(out/'review.md')},indent=2))

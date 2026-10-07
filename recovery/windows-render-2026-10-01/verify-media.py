import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
out = root / 'outputs'
repo = root / 'work' / 'dronebeachshot'
checkpoint = out / 'local-render-1440p60'
manifest = json.loads((checkpoint / 'manifest.json').read_text())
profile = json.loads((repo / 'profiles/last-light-bay.json').read_text())
assert manifest['captureSucceeded'] and manifest['offlineAfterLoad']
assert not manifest['errors'] and not manifest['failedRequests']
assert manifest['contract']['profile'] == profile
assert manifest['contract']['backend'] == manifest['graphics']['backend'] == 'hardware'
assert 'AMD Radeon 780M' in manifest['graphics']['renderer']
assert manifest['contract']['fps'] == 60 and manifest['contract']['duration'] == 20
assert len(manifest['frames']) == 1200
assert len({f['sha256'] for f in manifest['frames']}) == 1200
for i, frame in enumerate(manifest['frames']):
    assert frame['index'] == i and abs(frame['time'] - i / 60) < 1e-8
    assert frame['stats']['ready'] and frame['stats']['quality'] == 'high'
    assert frame['sourceIdentity'] == manifest['build']['sourceIdentity']
    linear = frame['stats']['linearMainOutput']
    assert linear['enabled'] and linear['supported'] and linear['sampleScale'] == 1
    assert linear['samples'] == 4 and linear['framebufferValidated']
    assert (linear['width'], linear['height']) == (2560, 1440)
    assert hashlib.sha256((checkpoint / frame['path']).read_bytes()).hexdigest() == frame['sha256']
for item in manifest['bundleFiles']:
    assert hashlib.sha256((checkpoint / 'render-bundle' / item['path']).read_bytes()).hexdigest() == item['sha256']

report = {'commit': subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip(),
          'sourceIdentity': manifest['build']['sourceIdentity'], 'graphics': manifest['graphics'],
          'profileSHA256': hashlib.sha256((repo / 'profiles/last-light-bay.json').read_bytes()).hexdigest(),
          'checkpointFramesVerified': 1200, 'media': []}
decoded = []
for name, dimensions in [('last-light-bay-1440p60.mp4', (2560, 1440)), ('last-light-bay-1080p60.mp4', (1920, 1080))]:
    file = out / name
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(file)]))
    (out / (name + '.ffprobe.json')).write_text(json.dumps(probe, indent=2) + '\n')
    assert len(probe['streams']) == 1
    stream = probe['streams'][0]
    assert stream['codec_type'] == 'video' and stream['codec_name'] == 'h264' and stream['pix_fmt'] == 'yuv420p'
    assert (stream['width'], stream['height']) == dimensions
    assert stream['avg_frame_rate'] == '60/1' and int(stream['nb_read_frames']) == 1200
    assert abs(float(probe['format']['duration']) - 20) < .001
    decode = subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(file), '-map', '0:v:0', '-f', 'null', '-'], capture_output=True, text=True)
    (out / (name + '.decode.log')).write_text(decode.stderr)
    assert decode.returncode == 0 and not decode.stderr, decode.stderr
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-xerror', '-i', str(file), '-map', '0:v:0', '-vf', 'scale=64:36:flags=lanczos', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
    frame_size = 64 * 36 * 3
    assert len(raw) == 1200 * frame_size
    frames = [raw[i*frame_size:(i+1)*frame_size] for i in range(1200)]
    black = [i for i, f in enumerate(frames) if sum(f) / len(f) < 2]
    duplicates = [i for i in range(1, 1200) if frames[i] == frames[i-1]]
    assert not black and not duplicates
    decoded.append(frames)
    report['media'].append({'path': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                            'sizeBytes': file.stat().st_size, 'dimensions': dimensions, 'fps': '60/1',
                            'decodedFrames': 1200, 'durationSeconds': float(probe['format']['duration']),
                            'decodeErrors': [], 'blackFrames': black, 'adjacentDuplicateFramesAt64x36': duplicates})
    print(name + ': 1200 frames, 20 seconds, 60 fps, full decode passed', flush=True)
differences = [sum(abs(a-b) for a,b in zip(master, web)) / len(master) for master,web in zip(*decoded)]
report['masterWebRGBDifferenceAt64x36'] = {'meanOn255Scale': sum(differences)/1200, 'maxFrameMeanOn255Scale': max(differences)}
(out / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2), flush=True)

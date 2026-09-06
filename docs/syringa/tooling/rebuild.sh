#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
python download.py
node prepare.mjs
python bake_far.py
node finalize_far.mjs
node finalize_format.mjs
python verify_render.py
python multiangle.py

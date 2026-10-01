# Island direct-response study recovery payload

This third recovery archive stores the two finished runtime files for the default-off Island Tree 02 direct-response study. It does not store the 192 raw bake layers or imply visual acceptance.

| Runtime file | Bytes | SHA-256 |
| --- | ---: | --- |
| `public/assets/studies/island-response/island-direct-response.rgba16f` | 25,165,824 | `9f1e04acf3995292adb4a7bba6c28ba28088cd37a3e7e90374a4fac3d564f63f` |
| `public/assets/studies/island-response/response-manifest.json` | 335,275 | `1935e1b8bd002959861fb97b768f8e9e184a71e08a5906f5eaa5987e65144601` |

The binary contains 192 layers of 128×128 RGBA16F, little-endian, in sun-major/view-major/bottom-first order. The manifest records its exact encoding, source hashes, sampling recipe, per-layer evidence and limitations. Both files derive from the existing CC0-1.0 Poly Haven Island Tree 02 asset by Rico Cilliers and Rob Tuytel; original source links and near-model SHA remain in their master asset-manifest entries. Existing runtime atlas alpha is unchanged; response behavior remains a separate inspection study.

The archive is ordinary non-ZIP64 ZIP with DEFLATE level 9. Entries have sorted exact runtime paths, fixed DOS timestamp `1980-01-01 00:00:00`, Unix regular-file permissions `0644`, and no extra fields/comments. It was encoded twice with Python's `zipfile`; both archives were byte-identical. The **3,713,278-byte** result was split into three 1,048,576-byte parts plus a 567,550-byte final part. `manifest.json` records every part hash and the combined archive SHA:

`f93b6e0676f2140bd9b3b5880cd0dcb9fe7df6819a23484426f0ceeed5e78c8b`

The master `public/assets/manifest.json` now contains 43 runtime assets, and `recovery/archives.json` appends this archive after the unchanged historical asset and derived-atlas archives. A fresh call to `restoreAssets({repositoryRoot, outputRoot})` in an empty temporary directory restored all 43 assets plus the master manifest. Both new files matched their original bytes and hashes exactly. A second call restored zero files; the temporary output was removed. `python3 scripts/control/check-assets.py` then passed for all 43 assets.

`packaging-audit.json` preserves the exact staged entries, source-model verification, deterministic/CRC checks, historical manifest hashes and fresh-restore results. Reassemble the ZIP by concatenating parts in `manifest.json` order; regular build/prebuild restoration uses the existing dependency-free `recovery/restore-assets.mjs`.

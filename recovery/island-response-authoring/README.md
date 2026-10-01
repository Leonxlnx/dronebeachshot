# Compact Island response authoring recovery

This package reconstructs the exact33 inputs used to bake the completed Island response study. It freezes **all24 source-text inputs**, so future application or authoring-script edits do not change reconstruction. Five installed Three modules and four published source assets remain hash-pinned. No installed node_modules, GLB/atlas copies, raw layer renders, browser binaries, or generated runtime payload are bundled. Completed runtime assets restore separately through `island-response-parts` in `recovery/archives.json`; the four original source assets use the existing asset archives.

Run after repository dependencies and stock assets are restored:

```sh
node recovery/island-response-authoring/reconstruct.mjs --verify-only
node recovery/island-response-authoring/reconstruct.mjs --output /tmp/island-response-authoring-frozen
node --test recovery/island-response-authoring/reconstruct.test.mjs
```

The output directory must not exist. Reconstruction validates every input before creating it, then copies and rehashes all33 pinned inputs into a temporary sibling before publishing by rename. **All24 source files always come from exact frozen fixtures**, including the unchanged original driver and original diagnostics. Their current production versions are never substituted. Changed/missing installed Three or published assets, corrupt fixtures, changed tool fingerprints, and existing destinations fail closed. No browser starts during reconstruction or its test.

The package contains24 source fixtures plus two Node-resolution support fixtures (`package.json` and `scripts/control/ts-resolve.mjs`), totaling **150,347bytes**. The support files are separate from the original33 source hashes. The old response helper intentionally predates its pending-load guard and URL correction; it is used only in the isolated OFF bake and is never copied into production.

Five pinned Three modules are physical copies in reconstructed `node_modules/three/`, alongside a verified installed package.json. TypeScript5.9.3, Playwright1.63.0, and Playwright-core1.63.0 are linked after package/entry fingerprints are checked. Runtime-support fingerprints are additional reconstruction evidence, not retroactively part of the original33 ledger. Links depend on those installed tools; reconstruction does not vendor an npm installation. All copied identities appear in the output's `reconstruction.json`.

The reconstructed CPU entry point is unchanged:

```sh
cd /tmp/island-response-authoring-frozen
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs scripts/control/check-source-direct-response.mjs
```

It passes the original17 CPU checks. A new GPU bake uses the same entry point with `--gpu --bake-island --output ABSOLUTE_NEW_OUTPUT_DIRECTORY`, only during a separately cleared GPU window and under the unchanged memory/time guards. It is never launched automatically by source recovery. The original33 ledger exactly matches `authoring.sourceHashes` in the completed runtime manifest. Browser/driver binaries are not archived, so identical inputs do not guarantee identical GPU pixels across different environments.

The focused recovery test reconstructs a temporary tree, hashes all33 files, runs its17 CPU checks, rejects existing output, rejects a corrupted installed dependency before output creation, uses frozen source despite a changed repository copy, and rejects a corrupt frozen fixture. It removes only its own temporary files. `verification.json` records the audit. `stage-paths.json` lists exact feature/proof paths; do not stage the raw authoring artifact directory.

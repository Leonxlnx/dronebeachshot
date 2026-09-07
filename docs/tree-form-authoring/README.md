# Island growth-form authoring

The `fork-open` form opens a secondary crown with one continuous, root-fixed
deformation. All three geometric LODs use that same field. Coarse wood triangles
receive conforming subdivision where needed; source UVs remain on their original
surface. The far LOD uses views rendered from the deformed near model.

The initial runtime cohort contains 213 Island trees in the opening core forest.
Selection depends only on existing coordinates; it does not consume the placement
random stream. Other tree families and remote forest retain their existing forms.

`island-fork-open.json` binds the source model, deformation, framing and output
checksums. `npm run check:tree-form` rejects a geometry/atlas mismatch. The three
production atlas files are restored from `recovery/derived-parts` during builds.
They derive from Poly Haven's CC0 Island Tree 02, with the source attribution
retained in the asset manifest.

## Rebuilding

Install the optional native diagnostic dependencies and configure a working EGL
implementation as described in `../native-render/README.md`. From the repository
root, use Node 24 with the existing TypeScript resolver:

```sh
node --experimental-strip-types --loader ./scripts/control/ts-resolve.mjs \
  docs/tree-form-authoring/bake-tree.mjs \
  --family island --form fork-open --form-module ./src/world/tree-form.ts \
  --mode atlas --cell 256 --visibility-cell 128 --supersample 4
```

Choose a fresh `--output` directory when repeating a bake. The default is under
the ignored `artifacts/tree-form-authoring` directory. Partial runs can use
`--views 0 --suns 0`; they are explicitly marked incompatible with a complete
runtime atlas. Do not install partial output.

A complete bake renders 24 source views for albedo and normals and all eight
sun directions for visibility: 240 passes. Coverage is integrated in linear
space at four times the output dimensions with four MSAA samples. Visibility
uses the fixed scene sun elevation. Packed RG8 stores visibility times coverage
in red and coverage in green, bottom-first. The JSON describes the exact layout.

The full asset was baked with the recorded generation script. The checked-in
portable script changes only the default source/output locations; a repeat of
view 0 and sun 0 matched all seven source and encoded files byte for byte.
The provenance distinguishes these two script hashes. Native authoring and
scene comparisons do not establish browser acceptance or final film approval.

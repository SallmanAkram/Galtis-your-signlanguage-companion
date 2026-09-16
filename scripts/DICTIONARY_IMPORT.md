# StudioGalt dictionary import

Run from the project folder with Node 24 (Node 22 also supports the APIs used):

```sh
npm run convert:dictionary
npm run lint
npm run test:dictionary
npm run build
```

The default input is `public/animations/SignLanguage_Dictionary/`. Use
`npm run convert:dictionary -- --source "another/folder"` to change it. Source
FBXs and Unity sidecar files remain untouched. The converter reads the first
AnimationClip from each FBX and records the number of source clips in its report.

Three workers process one FBX each at a time. Use `--workers 1` on a memory-limited
computer (maximum 4). No DOM, Blender, Python, or additional npm dependencies are
needed for the supplied meshless FBX archive.

## Outputs and naming

- `public/animations/full_mesh/*.json`: Galtis full mesh and Charcoal Suit clips.
- `public/animations/*.json`: matching clips for the alternate Galtis avatar.
- `src/data/studioGaltDictionaryData.json`: successful dictionary imports, merged
  with the existing curated entries and their pose metadata.
- `scripts/reports/dictionary-conversion.json`: outcome, input/output hashes,
  source rig, duration, bone count, size, and output filename for **every** FBX.

The archive has 2,654 FBXs representing 2,456 distinct labels, including numbered
variants. Multiple rig exports and dates of the same label are kept as separate
clips. The newest recording is the dictionary default; for matching dates, Full,
Mixamo, Mini, UEPlus, UE Mannequin, then Rigify is the preference order. Existing
curated signs keep their original animation. Suffixes and short hashes resolve
filename collisions. `animationVariants` preserves the alternative recordings.

The script checkpoints its report every 25 conversions and retries transient
Windows/OneDrive rename locks. Rerunning resumes only outputs whose source hash,
converter version, target meshes, and output hashes still match. `--force`
regenerates outputs. `--match "^(APPLE 1|DABBLE)$"` or `--limit 10` runs a pilot
without replacing the dictionary index. A failed file is reported, excluded from
new dictionary entries, and causes a nonzero process exit code.

## Retargeting and precision

The target uses actual deform bones such as `Bicep_R`, `Forearm_R`, `Hand_R`, and
`Index1_R`. The converter recognizes StudioGalt/Mini, Mixamo namespaces (including
numbered namespaces), Unreal, intermediate `*inte*` bones, and Rigify names.
Missing essential arms or fingers fail conversion instead of silently producing
a partial sign.

It transfers world rotations in hierarchy order, using inverse bind matrices
where available. Meshless Mini/Mixamo/intermediate and Rigify files use anatomical
axis calibration: their bone roll differs between export generations even when
the names match. The first arm/finger pose is **not** treated as a T-pose. Body
motion is relative to the source rest pose. Unmapped deform helpers receive
constant bind rotations to prevent stale poses leaking between signs.
Nonuniform bone lengths, translations, and scales
are not copied onto Galtis. These outputs animate the body and fingers; facial
blendshape animation is not synthesized from the archive.

Clips are sampled at 30 Hz, reduced with a maximum 0.001-radian quaternion
interpolation error at sample points, and quantized to four decimal places.
Track time precision is five decimal places. All serialized clips are checked
for valid, finite values, normalized quaternions, and target bone bindings.
Clips also carry deterministic UUIDs so Three.js never confuses successive signs.
File size depends on motion complexity; it is not guaranteed to be below 50 KB.

The older `retarget-full-body.mjs` skips files registered in the import report,
so it cannot overwrite the optimized dictionary clips during routine legacy
retargeting.

## Playback and review

Both dictionary views read the same registry and expose its categories. Speech
matching uses whole labels and longest matching phrases. A dictionary click
selects the exact recording label, including parentheses and variant numbers.
Signs with a trailing `1` also have an unnumbered speech alias when that alias
does not shadow an exact label.

Only the original small clip set is preloaded. New clips load on demand, with
deduplicated requests, a bounded cache, a loading message, and failure feedback.
The sign timer starts after loading and uses the recorded duration. A cancelled
queue or avatar switch cannot start a stale network response.

With the dev server running, open `/scripts/preview-animations.html` to play or
scrub APPLE 1, ASSIGN 1, and DABBLE on the production Galtis controller. This QA
page is not included in the production build. Automated playback tests cover
the same samples, dictionary lookup, file integrity, finite transforms, fixed
bone lengths, arm/finger motion, request failures, and avatar changes. Visual
checks of samples do not establish linguistic accuracy for every ASL recording.

Production builds exclude `SignLanguage_Dictionary` (about 1.7 GB of source FBX
assets). The local source folder and all generated playback JSONs are retained.
Vite ignores animation/report writes so a batch conversion does not repeatedly
reload the preview.

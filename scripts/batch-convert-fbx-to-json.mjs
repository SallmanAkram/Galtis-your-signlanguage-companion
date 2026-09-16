import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { loadFBX, targetRig, validateClip, assignClipIdentity } from './lib/retarget.mjs';

// A bounded worker pool holds one FBX per worker, never the entire archive.
// node scripts/batch-convert-fbx-to-json.mjs [--source path] [--workers 3] [--match regex] [--limit n] [--force]
const ROOT = fileURLToPath(new URL('../', import.meta.url));
process.chdir(ROOT);
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const sourceDir = resolve(option('--source', 'public/animations/SignLanguage_Dictionary'));
const outputDir = resolve('public/animations/full_mesh');
const secondaryDir = resolve('public/animations');
const reportPath = resolve('scripts/reports/dictionary-conversion.json');
const dictionaryPath = resolve('src/data/studioGaltDictionaryData.json');
const partial = args.includes('--match') || args.includes('--limit');
const hash = value => createHash('sha256').update(value).digest('hex');
const slug = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'sign';
const atomicJSON = (path, data) => {
  writeFileSync(path + '.tmp', JSON.stringify(data, null, 2) + '\n');
  // OneDrive/virus scanners briefly hold destination files open on Windows.
  for (let attempt = 0; ; attempt++) {
    try { renameSync(path + '.tmp', path); return; }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 29) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
};
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : /\.fbx$/i.test(e.name) ? [join(dir, e.name)] : []); }
const paths = walk(sourceDir).sort();
if (!paths.length) throw new Error(`No FBX files in ${sourceDir}`);
const records = paths.map(path => {
  const sourceFile = relative(sourceDir, path).replaceAll('\\', '/');
  const label = basename(path, '.fbx').replace(/^SG[ _]ASL[ _]/i, '');
  const match = label.match(/^(.*?)(?: (\d{4}-\d{1,2}-\d{1,2}))? (No Mesh .+|Rigify APose)$/i);
  if (!match) throw new Error(`Cannot derive sign name from ${sourceFile}`);
  const word = match[1].replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const date = match[2] ? match[2].split('-').map((p, i) => i ? p.padStart(2, '0') : p).join('-') : '';
  return { path, sourceFile, word, date, rig: match[3] };
});
const groups = Map.groupBy(records, r => r.word);
const priority = rig => ['No Mesh Full', 'No Mesh Mixamo', 'No Mesh Mini', 'No Mesh UEPlus', 'No Mesh UE Mannequin', 'Rigify APose'].indexOf(rig);
const oldDictionary = JSON.parse(readFileSync(dictionaryPath, 'utf8'));
const reserved = new Set(oldDictionary.filter(e => e.source !== 'StudioGalt FBX Dictionary').map(e => e.animationFile ?? slug(e.word) + '.json'));
reserved.add('turn_off.json'); reserved.add('rest_pose.json');
const used = new Set(reserved);
for (const [word, variants] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  variants.sort((a, b) => b.date.localeCompare(a.date) || priority(a.rig) - priority(b.rig) || a.sourceFile.localeCompare(b.sourceFile));
  variants.forEach((r, i) => {
    let name = slug(word);
    if (i) name += '__' + slug(`${r.date} ${r.rig}`);
    if (used.has(name + '.json')) name += '__' + hash(r.sourceFile).slice(0, 8);
    r.animationFile = name + '.json'; used.add(r.animationFile);
  });
}
mkdirSync(outputDir, { recursive: true }); mkdirSync('scripts/reports', { recursive: true });
const version = hash(readFileSync('scripts/lib/retarget.mjs') + hash(readFileSync('public/models/galtis_mesh.fbx')) + hash(readFileSync('public/models/galtis_hello.fbx')));
const previous = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};
const results = previous.version === version && previous.sourceDirectory === sourceDir ? previous.files ?? {} : {};
const full = targetRig(loadFBX('public/models/galtis_mesh.fbx'));
let processed = 0, failed = 0;
const started = Date.now();
const selected = records.filter(r => !args.includes('--match') || new RegExp(option('--match'), 'i').test(r.word)).slice(0, Number(option('--limit', Infinity)));
const saveReport = () => atomicJSON(reportPath, { version, sourceDirectory: sourceDir, sourceFiles: records.length, distinctLabels: groups.size, files: results });
console.log(`Found ${records.length} FBXs / ${groups.size} distinct sign labels. Processing ${selected.length}.`);
async function convert(r, worker) {
  try {
    const inputHash = hash(readFileSync(r.path));
    const outputPath = join(outputDir, r.animationFile), secondaryPath = join(secondaryDir, r.animationFile);
    const cached = results[r.sourceFile];
    if (!args.includes('--force') && cached?.inputHash === inputHash && cached.animationFile === r.animationFile && cached.status === 'ok' && existsSync(outputPath) && existsSync(secondaryPath)
      && hash(readFileSync(outputPath)) === cached.outputHash && hash(readFileSync(secondaryPath)) === cached.secondaryHash) {
      const output = JSON.parse(readFileSync(outputPath, 'utf8'));
      const secondary = JSON.parse(readFileSync(secondaryPath, 'utf8'));
      if (!output.uuid || !secondary.uuid) {
        const outputText = JSON.stringify(assignClipIdentity(output)), secondaryText = JSON.stringify(assignClipIdentity(secondary));
        writeFileSync(outputPath, outputText); writeFileSync(secondaryPath, secondaryText);
        cached.outputHash = hash(outputText); cached.secondaryHash = hash(secondaryText); cached.bytes = Buffer.byteLength(outputText);
        if ((processed + 1) % 25 === 0) saveReport();
      }
      processed++; return;
    }
    const baked = await new Promise((resolve, reject) => {
      const onError = error => { worker.off('message', onMessage); reject(error); };
      const onMessage = result => { worker.off('error', onError); result.error ? reject(new Error(result.error)) : resolve(result); };
      worker.once('message', onMessage); worker.once('error', onError);
      worker.postMessage({ path: r.path, word: r.word });
    });
    const { outputText, secondaryText } = baked;
    writeFileSync(outputPath, outputText); writeFileSync(secondaryPath, secondaryText);
    results[r.sourceFile] = { status: 'ok', word: r.word, date: r.date, rig: r.rig, animationFile: r.animationFile, inputHash,
      outputHash: hash(outputText), secondaryHash: hash(secondaryText), family: baked.family, durationSec: baked.durationSec,
      mappedBones: baked.mappedBones, bytes: Buffer.byteLength(outputText), sourceClips: baked.sourceClips };
  } catch (error) {
    failed++; results[r.sourceFile] = { status: 'error', word: r.word, message: error.message };
    console.error(`${r.sourceFile}: ${error.message}`);
  }
  processed++;
  if (processed % 25 === 0) { saveReport(); console.log(`${processed}/${selected.length}; ${failed} failures; ${Math.round((Date.now() - started) / 1000)}s`); global.gc?.(); }
}
let next = 0;
const workerCount = Number(option('--workers', 3));
if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > 4) throw new Error('--workers must be 1–4');
await Promise.all(Array.from({ length: Math.min(workerCount, selected.length) }, async () => {
  const worker = new Worker(new URL('./lib/conversion-worker.mjs', import.meta.url));
  try { while (next < selected.length) await convert(selected[next++], worker); }
  finally { await worker.terminate(); }
}));
saveReport();
if (!partial) {
  // Index only clips proven to exist and bind correctly. Retain the original
  // curated dictionary (including its pose metadata), replacing only our entries.
  const dictionary = oldDictionary.filter(e => e.source !== 'StudioGalt FBX Dictionary');
  for (const entry of dictionary) entry.animationFile ??= slug(entry.word) + '.json';
  const words = new Set(dictionary.map(e => e.word.toUpperCase()));
  for (const [word, variants] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (words.has(word) || word === 'TURN OFF') continue;
    const successful = variants.map(r => results[r.sourceFile]).filter(r => r?.status === 'ok');
    if (!successful.length) continue;
    const best = successful[0];
    const output = JSON.parse(readFileSync(join(outputDir, best.animationFile), 'utf8'));
    validateClip(output, full.root);
    dictionary.push({ id: 'sg-import-' + best.animationFile.replace('.json', ''), word, gloss: word,
      category: /^\d/.test(word) ? 'Numbers' : /^[A-Z]$/.test(word) ? 'Alphabet' : `Dictionary ${word[0]}`,
      source: 'StudioGalt FBX Dictionary', parentMotion: variants.find(r => r.animationFile === best.animationFile).sourceFile,
      description: `StudioGalt motion-capture recording for ${word.toLowerCase()}.`, animationFile: best.animationFile,
      animationVariants: successful.map(r => ({ animationFile: r.animationFile, rig: r.rig, date: r.date })),
      fps: 30, durationSec: best.durationSec, facs: {}, keyposes: [],
    });
  }
  atomicJSON(dictionaryPath, dictionary);
  const bytes = Object.values(results).filter(r => r.status === 'ok').reduce((sum, r) => sum + r.bytes, 0);
  console.log(`Indexed ${dictionary.length} entries (+ TURN OFF in TS). Full-mesh output: ${(bytes / 1024 / 1024).toFixed(1)} MiB.`);
}
console.log(`Finished ${selected.length} files; ${failed} failures. Report: ${relative(ROOT, reportPath)}`);
if (failed) process.exitCode = 1;

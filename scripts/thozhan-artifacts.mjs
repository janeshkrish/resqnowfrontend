import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';

const wakeFiles = [
  'worker.js', 'detector.js', 'ort.wasm.min.js', 'ort-wasm.js', 'ort-wasm.wasm',
  'melspectrogram.onnx', 'embedding_model.onnx', 'hey-resqnow.bin', 'THIRD_PARTY_LICENSES.txt',
];
// The ONNX Runtime Web 1.31.1 binary pairs with its loader; the models pair with detector.js.
const binaryDigests = {
  'ort-wasm.wasm': '4b884c203b0fa48d057be3332c65513ff85aa3c5bddd6946acc0fab7ecda001d',
  'melspectrogram.onnx': 'ba2b0e0f8b7b875369a2c89cb13360ff53bac436f2895cced9f479fa65eb176f',
  'embedding_model.onnx': '70d164290c1d095d1d4ee149bc5e00543250a7316b59f31d056cff7bd3075c1f',
  'hey-resqnow.bin': '7df1278de4955138d36091022cd98aae4cf27db9a9f55cb33ae48bb29a82b0d1',
};

/** Return the files actually loaded by this build, including the lazy voice route. */
export async function verifyThozhanDist({dist, publicDir}) {
  const manifest = JSON.parse(await fs.readFile(path.join(dist, '.vite/manifest.json'), 'utf8'));
  const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  const entry = manifest['index.html'];
  if (!entry?.isEntry || !html.includes('src="/' + entry.file + '"')) {
    throw Error('Thozhan build entry does not match the emitted index.html');
  }
  const pending = ['index.html'];
  const visited = new Set();
  const files = new Set(['index.html']);
  let loadsWorker = false;
  while (pending.length) {
    const key = pending.pop();
    if (visited.has(key)) continue;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw Error('Missing Vite manifest entry ' + key);
    const code = await fs.readFile(path.join(dist, chunk.file), 'utf8');
    loadsWorker ||= code.includes('/hey-resqnow/') && code.includes('worker.js');
    files.add(chunk.file);
    for (const css of chunk.css ?? []) {
      await fs.access(path.join(dist, css));
      files.add(css);
    }
    pending.push(...(chunk.imports ?? []), ...(chunk.dynamicImports ?? []));
  }
  if (!visited.has('src/pages/VoiceThozhanPage.tsx')) throw Error('VoiceThozhanPage is absent from the app entry graph');
  if (!loadsWorker) throw Error('The app entry graph does not load the Hey ResQNow worker.js');

  for (const name of wakeFiles) {
    const relative = 'hey-resqnow/' + name;
    const source = await fs.readFile(path.join(publicDir, relative));
    const emitted = await fs.readFile(path.join(dist, relative));
    if (!source.length || !source.equals(emitted)) throw Error('Missing or changed Thozhan asset ' + relative);
    if (binaryDigests[name] && createHash('sha256').update(emitted).digest('hex') !== binaryDigests[name]) {
      throw Error('Incorrect Hey ResQNow binary ' + relative);
    }
    files.add(relative);
  }
  return files;
}

/** Inspect the APK bytes Gradle produced, including the native speech plugin. */
export async function verifyThozhanApk({root, apk}) {
  const dist = path.join(root, 'dist');
  const files = await verifyThozhanDist({dist, publicDir: path.join(root, 'public')});
  const prefix = 'assets/public/';
  const dex = /^classes(?:[2-9]|[1-9][0-9]+)?\.dex$/;
  const archive = unzipSync(await fs.readFile(apk), {
    filter: ({name}) => dex.test(name) || (name.startsWith(prefix) && files.has(name.slice(prefix.length))),
  });
  for (const name of files) {
    const packed = archive[prefix + name];
    if (!packed || !(await fs.readFile(path.join(dist, name))).equals(packed)) {
      throw Error('APK has missing or changed Thozhan file ' + prefix + name);
    }
  }
  if (!Object.entries(archive).some(([name, bytes]) =>
    dex.test(name) && Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes('Lcom/resqnow1/app/VoiceThozhanPlugin;'))) {
    throw Error('APK is missing the native VoiceThozhanPlugin');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const [apk] = process.argv.slice(2);
  const check = apk ? verifyThozhanApk({root, apk}) : verifyThozhanDist({dist: path.join(root, 'dist'), publicDir: path.join(root, 'public')});
  check.then(() => console.log('Verified Thozhan ' + (apk ? 'APK' : 'web dist'))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

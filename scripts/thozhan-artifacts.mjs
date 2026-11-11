import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';

const wakeFiles = [
  'worker.js', 'sherpa-onnx-kws.js', 'sherpa-onnx-wasm-kws-main.js',
  'sherpa-onnx-wasm-kws-main.wasm', 'sherpa-onnx-wasm-kws-main.data', 'THIRD_PARTY_LICENSES.txt',
];
// These two files ship as a pair with the vendored sherpa-onnx 1.13.8 loader.
const binaryDigests = {
  'sherpa-onnx-wasm-kws-main.wasm': '2b2f64fcf58f3a143754f5b4e8347425eb6ce856715f5136254b13b03cc684a0',
  'sherpa-onnx-wasm-kws-main.data': 'abac2cd839175424fc4a5091c20d1ae4a2248ffbfc616ac6357e5d74cf6c3933',
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
      throw Error('Incorrect sherpa-onnx binary ' + relative);
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

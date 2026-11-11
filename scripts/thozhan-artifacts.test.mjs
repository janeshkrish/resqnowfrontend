import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {zipSync} from 'fflate';
import {verifyThozhanApk} from './thozhan-artifacts.mjs';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const worker = 'hey-resqnow/worker.js';
const model = 'hey-resqnow/sherpa-onnx-wasm-kws-main.data';
// Use a real production-mode Vite build without depending on a developer's dotenv.
process.env.VITE_API_URL = 'https://resqnowbackend-production-c392.up.railway.app';
process.env.VITE_NATIVE_BUILD = 'true';

async function fixture(t) {
  // Some Windows sandbox temp directories contain '#', a URL fragment to Vite.
  const parent = path.join(frontend, 'output/quality');
  await fs.mkdir(parent, {recursive: true});
  const root = await fs.mkdtemp(path.join(parent, 'thozhan-build-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  await fs.cp(path.join(frontend, 'public/hey-resqnow'), path.join(root, 'public/hey-resqnow'), {recursive: true});
  await fs.mkdir(path.join(root, 'src/pages'), {recursive: true});
  await fs.writeFile(path.join(root, 'index.html'), '<script type="module" src="/src/main.js"></script>');
  await fs.writeFile(path.join(root, 'src/main.js'), "window.talk = () => import('./pages/VoiceThozhanPage.tsx'); window.listen = () => new Worker('/hey-resqnow/worker.js');");
  await fs.writeFile(path.join(root, 'src/pages/VoiceThozhanPage.tsx'), "export default () => 'Thozhan';");
  return root;
}

const buildWeb = root => build({
  configFile: path.join(frontend, 'vite.config.ts'), root, logLevel: 'silent',
  mode: 'production', envDir: false,
});

test('production Vite build refuses to emit a site without its wake worker', async t => {
  const root = await fixture(t);
  await fs.unlink(path.join(root, 'public', worker));
  await assert.rejects(buildWeb(root), /worker\.js/);
});

test('production Vite build refuses a site whose entry no longer imports the voice page', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'src/main.js'), "window.listen = () => new Worker('/hey-resqnow/worker.js');");
  await assert.rejects(buildWeb(root), /VoiceThozhanPage/);
});

test('APK verification rejects a stale model, missing voice chunk or missing native plugin', async t => {
  const root = await fixture(t);
  await buildWeb(root);
  const dist = path.join(root, 'dist');
  const files = {};
  for (const name of await fs.readdir(dist, {recursive: true})) {
    const file = path.join(dist, name);
    if ((await fs.stat(file)).isFile()) files['assets/public/' + name.replaceAll('\\', '/')] = await fs.readFile(file);
  }
  files['classes.dex'] = Buffer.from('Lcom/resqnow1/app/VoiceThozhanPlugin;');
  const archivedPage = Object.keys(files).find(name => name.includes('/VoiceThozhanPage-') && name.endsWith('.js'));
  assert.ok(archivedPage, 'Vite emitted a lazy voice page');
  const apk = path.join(root, 'app.apk');
  const run = () => verifyThozhanApk({root, apk});
  const writeApk = entries => fs.writeFile(apk, zipSync(entries, {level: 0}));
  await writeApk(files);
  await run();
  await writeApk({...files, ['assets/public/' + model]: Buffer.from('old model')});
  await assert.rejects(run(), /sherpa-onnx-wasm-kws-main\.data/);
  const missingPage = {...files};
  delete missingPage[archivedPage];
  await writeApk(missingPage);
  await assert.rejects(run(), /VoiceThozhanPage/);
  await writeApk({...files, 'classes.dex': Buffer.from('unrelated native app')});
  await assert.rejects(run(), /VoiceThozhanPlugin/);
});

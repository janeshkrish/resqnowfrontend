import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as api from './android-release-build.mjs';

async function fixture(body) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'resqnow-sdk-'));
  try { await body(root); } finally { await fs.rm(root, {recursive:true, force:true}); }
}

test('hosted SDK setup uses the installed manager without needing it on PATH and forwards no credentials', () => fixture(async root => {
  assert.equal(typeof api.prepareAndroidSdk, 'function');
  const manager = path.join(root, 'cmdline-tools/latest/bin/sdkmanager');
  await fs.mkdir(path.dirname(manager), {recursive:true});
  await fs.writeFile(manager, 'owned SDK fixture');
  const calls = [];
  await api.prepareAndroidSdk({root, platform:'linux', env:{ANDROID_HOME:root, PATH:'/usr/bin', JAVA_HOME:path.join(root,'jdk'), GITHUB_TOKEN:'synthetic-token', ANDROID_KEYSTORE_BASE64:'synthetic-key', RESQNOW_ANDROID_STORE_PASSWORD:'synthetic-password'}, run:async(command,args,options) => calls.push({command,args,options})});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, manager);
  assert.deepEqual(calls[0].args, ['platforms;android-36','build-tools;36.0.0']);
  assert.equal(calls[0].options.cwd, root);
  assert.equal(calls[0].options.env.JAVA_HOME, path.join(root,'jdk'));
  assert.equal(calls[0].options.env.PATH, '/usr/bin');
  for(const key of ['GITHUB_TOKEN','ANDROID_KEYSTORE_BASE64','RESQNOW_ANDROID_STORE_PASSWORD']) assert.equal(calls[0].options.env[key], undefined);
  assert.equal(calls[0].options.timeout, 600000);
}));

test('hosted SDK setup fails clearly before running anything when the SDK or manager is missing', () => fixture(async root => {
  assert.equal(typeof api.prepareAndroidSdk, 'function');
  let called = false;
  const run = async () => { called = true; };
  await assert.rejects(() => api.prepareAndroidSdk({root,platform:'linux',env:{},run}), /SDK root/);
  await assert.rejects(() => api.prepareAndroidSdk({root,platform:'linux',env:{ANDROID_SDK_ROOT:root},run}), /command-line tools/);
  assert.equal(called, false);
}));

test('SDK installation helper does not change the local Windows toolchain', () => fixture(async root => {
  assert.equal(typeof api.prepareAndroidSdk, 'function');
  let called = false;
  await assert.rejects(() => api.prepareAndroidSdk({root,platform:'win32',env:{ANDROID_HOME:root},run:async()=>{called=true;}}), /hosted Linux/);
  assert.equal(called, false);
}));

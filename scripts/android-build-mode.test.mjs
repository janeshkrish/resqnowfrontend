import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {zipSync} from 'fflate';
const api=await import('./android-build-mode.mjs').catch(()=>({}));
const enabled={schemaVersion:1,nativeBuild:true,updatesEnabled:true,mapplsEnabled:true};
async function fixture(body){const root=await fs.mkdtemp(path.join(os.tmpdir(),'resqnow-build-mode-'));try{await fs.mkdir(path.join(root,'dist'),{recursive:true});await fs.mkdir(path.join(root,'android/app/src/main/assets/public'),{recursive:true});await body(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
test('Vite emits an explicit mode artifact from the actual build settings and rejects typos',()=>{
  assert.equal(typeof api.createNativeBuildModePlugin,'function');let emitted;
  const plugin=api.createNativeBuildModePlugin({VITE_NATIVE_BUILD:'true',VITE_APP_UPDATES_ENABLED:'true',VITE_NATIVE_MAPPLS_ENABLED:'false'});
  plugin.generateBundle.call({emitFile:value=>emitted=value});assert.equal(emitted.fileName,'resqnow-build-mode.json');assert.deepEqual(JSON.parse(emitted.source),{...enabled,mapplsEnabled:false});
  assert.throws(()=>api.createNativeBuildModePlugin({VITE_NATIVE_MAPPLS_ENABLED:'FALSE'}),/mappls/i);
});
test('synced artifacts with stale or missing mode cannot be released even if current process flags agree',()=>fixture(async root=>{
  assert.equal(typeof api.verifyNativeBuildMode,'function');
  const write=async value=>{for(const file of ['dist/resqnow-build-mode.json','android/app/src/main/assets/public/resqnow-build-mode.json'])await fs.writeFile(path.join(root,file),JSON.stringify(value));};
  await assert.rejects(()=>api.verifyNativeBuildMode({root,mapplsEnabled:false}),/mode/i);
  await write(enabled);await assert.rejects(()=>api.verifyNativeBuildMode({root,mapplsEnabled:false}),/mode/i);
  await write({...enabled,mapplsEnabled:false});await api.verifyNativeBuildMode({root,mapplsEnabled:false});
  await fs.writeFile(path.join(root,'android/app/src/main/assets/public/resqnow-build-mode.json'),JSON.stringify(enabled));await assert.rejects(()=>api.verifyNativeBuildMode({root,mapplsEnabled:false}),/mode/i);
  for(const patch of [{updatesEnabled:false},{nativeBuild:false},{extra:true}]){await write({...enabled,...patch});await assert.rejects(()=>api.verifyNativeBuildMode({root,mapplsEnabled:true}),/mode/i);}
}));
test('the final APK must retain the same verified map/updater mode marker',()=>fixture(async root=>{
  assert.equal(typeof api.verifyNativeBuildMode,'function');const value=JSON.stringify({...enabled,mapplsEnabled:false});
  for(const file of ['dist/resqnow-build-mode.json','android/app/src/main/assets/public/resqnow-build-mode.json'])await fs.writeFile(path.join(root,file),value);
  const apk=path.join(root,'candidate.apk');await fs.writeFile(apk,zipSync({'assets/public/resqnow-build-mode.json':Buffer.from(JSON.stringify(enabled))}));
  await assert.rejects(()=>api.verifyNativeBuildMode({root,mapplsEnabled:false,apk}),/mode/i);
  await fs.writeFile(apk,zipSync({'assets/public/resqnow-build-mode.json':Buffer.from(value)}));await api.verifyNativeBuildMode({root,mapplsEnabled:false,apk});
}));

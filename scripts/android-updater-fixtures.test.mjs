import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import vm from 'node:vm';
const api=await import('./android-updater-fixtures.mjs').catch(()=>({}));
test('fixture builder refuses private dotenv configuration before generating keys or invoking tools',async()=>{
  assert.equal(typeof api.buildNativeFixtures,'function');const root=await fs.mkdtemp(path.join(os.tmpdir(),'updater-fixture-'));
  try{await fs.writeFile(path.join(root,'.env.local'),'synthetic private configuration');let touched=false;await assert.rejects(()=>api.buildNativeFixtures({root,env:{},run:async()=>{touched=true;}}),/dotenv/);assert.equal(touched,false);}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('fixture build environments cannot inherit production signing credentials or API tokens',()=>{
  assert.equal(typeof api.fixtureEnvironment,'function');const result=api.fixtureEnvironment({PATH:'synthetic-path',JAVA_HOME:'jdk',ANDROID_HOME:'sdk',GITHUB_TOKEN:'never-forward',RESQNOW_ANDROID_STORE_PASSWORD:'never-forward',VITE_FIREBASE_API_KEY:'never-forward'});
  assert.equal(result.PATH,'synthetic-path');assert.equal(result.GITHUB_TOKEN,undefined);assert.equal(result.RESQNOW_ANDROID_STORE_PASSWORD,undefined);assert.equal(result.VITE_FIREBASE_API_KEY,undefined);assert.equal(result.RESQNOW_UPDATER_ACCEPTANCE_ONLY,'true');
});
test('the seeded old worker serves cached A navigation/code but never API, images or cross-origin data',async()=>{
  assert.equal(typeof api.acceptanceWorker,'function');const listeners={},added=[];const cache={addAll:async paths=>added.push(...paths),match:async key=>'cached A '+key};
  vm.runInNewContext(api.acceptanceWorker(['index.html','assets/entry.js']),{URL,caches:{open:async name=>{assert.equal(name,'workbox-precache-resqnow-acceptance-A');return cache;}},self:{location:{origin:'https://localhost'},addEventListener:(type,fn)=>listeners[type]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}}});
  let pending;listeners.install({waitUntil:p=>pending=p});await pending;assert.deepEqual(added,['/index.html','/assets/entry.js']);
  async function fetch(url,mode){let response;listeners.fetch({request:{url,mode},respondWith:p=>response=p});return response===undefined?undefined:await response;}
  assert.equal(await fetch('https://localhost/settings','navigate'),'cached A /index.html');assert.equal(await fetch('https://localhost/assets/entry.js','cors'),'cached A /assets/entry.js');
  for(const url of ['https://localhost/api/account','https://localhost/images/photo.png','https://api.example.test/assets/entry.js'])assert.equal(await fetch(url,'cors'),undefined);
  assert.throws(()=>api.acceptanceWorker(['../private']),/code asset/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {build} from 'vite';
import {zipSync} from 'fflate';
const api=await import('./mappls-artifacts.mjs').catch(()=>({}));
const KEY='controlled-public-mappls-key';

async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'resqnow-mappls-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const dist=path.join(root,'dist');await fs.mkdir(path.join(dist,'.vite'),{recursive:true});await fs.mkdir(path.join(dist,'assets'));
  await fs.writeFile(path.join(dist,'index.html'),'<script type="module" src="/assets/app.js"></script>');
  await fs.writeFile(path.join(dist,'assets/app.js'),'window.app=true;');
  await fs.writeFile(path.join(dist,'assets/map.js'),`window.label="VITE_MAPPLS_MAP_SDK_KEY";window.loader={readKey:()=>${JSON.stringify(KEY)}};`);
  const manifest={'index.html':{isEntry:true,file:'assets/app.js',dynamicImports:['map']},map:{file:'assets/map.js'}};
  await fs.writeFile(path.join(dist,'.vite/manifest.json'),JSON.stringify(manifest));
  const assets=path.join(root,'android/app/src/main/assets');await fs.mkdir(assets,{recursive:true});await fs.cp(dist,path.join(assets,'public'),{recursive:true});
  const config={appId:'com.resqnow1.app',server:{androidScheme:'https'}};
  await fs.writeFile(path.join(assets,'capacitor.config.json'),JSON.stringify(config));
  return {root,dist,assets,manifest,config};
}
async function apkFiles(f){
  const files={'assets/capacitor.config.json':Buffer.from(JSON.stringify(f.config))};
  for(const name of ['index.html','assets/app.js','assets/map.js'])files['assets/public/'+name]=await fs.readFile(path.join(f.dist,name));
  return files;
}
test('Mappls verification reads reachable compiled key readers, not merely a matching string',async t=>{
  const f=await fixture(t);assert.equal(typeof api.verifyMapplsDist,'function');
  const files=await api.verifyMapplsDist({dist:f.dist,key:KEY});assert.ok(files.has('assets/map.js'));
  await fs.writeFile(path.join(f.dist,'assets/map.js'),`window.label="VITE_MAPPLS_MAP_SDK_KEY";window.decoy=${JSON.stringify(KEY)};window.loader={readKey:()=>"stale-key"};`);
  await assert.rejects(()=>api.verifyMapplsDist({dist:f.dist,key:KEY}),error=>/Mappls.*key/i.test(error.message)&&!error.message.includes(KEY)&&!error.message.includes('stale-key'));
});
test('Mappls verification refuses missing settings, missing readers and orphan chunks',async t=>{
  const f=await fixture(t);assert.equal(typeof api.verifyMapplsDist,'function');
  for(const key of [undefined,'','  '])await assert.rejects(()=>api.verifyMapplsDist({dist:f.dist,key}),/Mappls.*key/i);
  await fs.writeFile(path.join(f.dist,'assets/map.js'),'window.label="VITE_MAPPLS_MAP_SDK_KEY";');
  await assert.rejects(()=>api.verifyMapplsDist({dist:f.dist,key:KEY}),/Mappls/);
  delete f.manifest['index.html'].dynamicImports;await fs.writeFile(path.join(f.dist,'.vite/manifest.json'),JSON.stringify(f.manifest));
  await assert.rejects(()=>api.verifyMapplsDist({dist:f.dist,key:KEY}),/Mappls/);
});
test('Mappls verification refuses stale index and manifest paths outside dist',async t=>{
  const f=await fixture(t);assert.equal(typeof api.verifyMapplsDist,'function');
  await fs.writeFile(path.join(f.dist,'index.html'),'<script type="module" src="/assets/old.js"></script>');
  await assert.rejects(()=>api.verifyMapplsDist({dist:f.dist,key:KEY}),/entry|index/i);
  await fs.writeFile(path.join(f.dist,'index.html'),'<script type="module" src="/assets/app.js"></script>');
  f.manifest.map.file='../outside.js';await fs.writeFile(path.join(f.dist,'.vite/manifest.json'),JSON.stringify(f.manifest));
  await assert.rejects(()=>api.verifyMapplsDist({dist:f.dist,key:KEY}),/path|outside/i);
});
test('synced Android assets must match the built map and keep the local HTTPS origin',async t=>{
  const f=await fixture(t);assert.equal(typeof api.verifyMapplsNativeAssets,'function');
  await api.verifyMapplsNativeAssets({root:f.root,key:KEY});
  await fs.writeFile(path.join(f.assets,'public/assets/map.js'),'old bundle');
  await assert.rejects(()=>api.verifyMapplsNativeAssets({root:f.root,key:KEY}),/stale|changed|match/i);
  await fs.copyFile(path.join(f.dist,'assets/map.js'),path.join(f.assets,'public/assets/map.js'));
  for(const server of [{androidScheme:'http'},{androidScheme:'https',hostname:'www.resqnow.org'},{androidScheme:'https',url:'http://192.0.2.1:8080'}]){
    await fs.writeFile(path.join(f.assets,'capacitor.config.json'),JSON.stringify({...f.config,server}));
    await assert.rejects(()=>api.verifyMapplsNativeAssets({root:f.root,key:KEY}),/origin|localhost|server/i);
  }
});
test('the finished APK must contain the verified map files and correct native configuration',async t=>{
  const f=await fixture(t);assert.equal(typeof api.verifyMapplsApk,'function');
  const entries=await apkFiles(f),apk=path.join(f.root,'candidate.apk');
  const write=files=>fs.writeFile(apk,zipSync(files,{level:0}));
  await write(entries);await api.verifyMapplsApk({root:f.root,apk,key:KEY});
  await write({...entries,'assets/public/assets/map.js':Buffer.from('stale map bundle')});
  await assert.rejects(()=>api.verifyMapplsApk({root:f.root,apk,key:KEY}),/stale|changed|match/i);
  const absent={...entries};delete absent['assets/public/assets/map.js'];await write(absent);
  await assert.rejects(()=>api.verifyMapplsApk({root:f.root,apk,key:KEY}),/missing|changed|match/i);
  await write({...entries,'assets/capacitor.config.json':Buffer.from(JSON.stringify({appId:'com.resqnow1.app',server:{url:'https://other.example'}}))});
  await assert.rejects(()=>api.verifyMapplsApk({root:f.root,apk,key:KEY}),/origin|localhost|server/i);
});
test('Mappls verification accepts an actual minified Vite output with all configured readers',async t=>{
  const f=await fixture(t);assert.equal(typeof api.verifyMapplsDist,'function');
  await fs.mkdir(path.join(f.root,'src'));
  await fs.writeFile(path.join(f.root,'index.html'),'<script type="module" src="/src/main.js"></script>');
  await fs.writeFile(path.join(f.root,'src/main.js'),'window.label="VITE_MAPPLS_MAP_SDK_KEY";window.readers=[{readKey:()=>import.meta.env.VITE_MAPPLS_MAP_SDK_KEY},{readKey:()=>import.meta.env.VITE_MAPPLS_MAP_SDK_KEY},{readKey:()=>import.meta.env.VITE_MAPPLS_MAP_SDK_KEY}];');
  await build({root:f.root,configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'import.meta.env.VITE_MAPPLS_MAP_SDK_KEY':JSON.stringify(KEY)},build:{manifest:true}});
  await api.verifyMapplsDist({dist:f.dist,key:KEY});
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {zipSync} from 'fflate';
import {createHash} from 'node:crypto';
const api=await import('./android-release-build.mjs').catch(()=>({}));
async function fixture(body){const root=await fs.mkdtemp(path.join(os.tmpdir(),'resqnow-native-build-'));try{await body(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
const MAP_KEY='controlled-public-sdk-key';
async function mapBuildFiles(root,{staleNative=false,staleApk=false,nativeConfiguration=true,mapplsEnabled=true}={}){
  const dist=path.join(root,'dist'),assets=path.join(root,'android/app/src/main/assets');
  await fs.mkdir(path.join(root,'config'),{recursive:true});
  await fs.writeFile(path.join(root,'config/mappls-public-key.json'),JSON.stringify({schemaVersion:1,sha256:createHash('sha256').update(MAP_KEY).digest('hex')}));
  await fs.mkdir(path.join(dist,'.vite'),{recursive:true});await fs.mkdir(path.join(dist,'assets'),{recursive:true});
  const html='<script type="module" src="/assets/map.js"></script>',code=`window.label="VITE_MAPPLS_MAP_SDK_KEY";window.loader={readKey:()=>${JSON.stringify(MAP_KEY)}};`;
  await fs.writeFile(path.join(dist,'index.html'),html);await fs.writeFile(path.join(dist,'assets/map.js'),code);
  await fs.writeFile(path.join(dist,'.vite/manifest.json'),JSON.stringify({'index.html':{isEntry:true,file:'assets/map.js'}}));
  await fs.mkdir(assets,{recursive:true});await fs.cp(dist,path.join(assets,'public'),{recursive:true});
  const mode=JSON.stringify({schemaVersion:1,nativeBuild:true,updatesEnabled:true,mapplsEnabled});
  await fs.writeFile(path.join(dist,'resqnow-build-mode.json'),mode);await fs.writeFile(path.join(assets,'public/resqnow-build-mode.json'),mode);
  if(nativeConfiguration){
    await fs.writeFile(path.join(root,'android/app/fixture-app.a.conf'),'synthetic configuration; not a provider credential');
    await fs.writeFile(path.join(root,'android/app/fixture-app.a.olf'),'synthetic license; not valid for Mappls');
  }
  if(staleNative)await fs.writeFile(path.join(assets,'public/assets/map.js'),'stale native bundle');
  const config=JSON.stringify({appId:'com.resqnow1.app',server:{androidScheme:'https'}});
  await fs.writeFile(path.join(assets,'capacitor.config.json'),config);
  const apk=path.join(root,'android/app/build/outputs/apk/release/app-release.apk');await fs.mkdir(path.dirname(apk),{recursive:true});
  await fs.writeFile(apk,zipSync({'assets/capacitor.config.json':Buffer.from(config),'assets/public/index.html':Buffer.from(html),'assets/public/assets/map.js':Buffer.from(staleApk?'stale APK bundle':code),'assets/public/resqnow-build-mode.json':Buffer.from(mode)},{level:0}));
}
test('build/sign commands receive explicit versions, isolated settings and no token/password command arguments',()=>fixture(async root=>{
  assert.equal(typeof api.createAndroidBuildRunner,'function');const key=path.join(root,'synthetic-key');await fs.writeFile(key,'not a private key');const calls=[];
  const env={PATH:process.env.PATH,JAVA_HOME:root,ANDROID_HOME:root,GITHUB_TOKEN:'synthetic-api-token',RESQNOW_ANDROID_KEYSTORE_PATH:key,RESQNOW_ANDROID_KEY_ALIAS:'synthetic-alias',RESQNOW_ANDROID_STORE_PASSWORD:'synthetic-store-password',RESQNOW_ANDROID_KEY_PASSWORD:'synthetic-key-password'};
  await mapBuildFiles(root);
  const runner=api.createAndroidBuildRunner({root,env,run:async(command,args,options)=>{calls.push({command,args,env:options.env});}});
  const apk=await runner.build({version:{versionCode:112,versionName:'1.4.112'},publicSettings:{VITE_NATIVE_BUILD:'true',VITE_APP_UPDATES_ENABLED:'true',VITE_MAPPLS_MAP_SDK_KEY:MAP_KEY},googleServices:{public:'synthetic config'}});
  assert.equal(apk,path.join(root,'android/app/build/outputs/apk/release/app-release.apk'));assert.equal(calls.length,3);
  assert.equal(calls[0].env.GITHUB_TOKEN,undefined);assert.equal(calls[0].env.RESQNOW_ANDROID_STORE_PASSWORD,undefined);assert.equal(calls[2].env.GITHUB_TOKEN,undefined);assert.equal(calls[2].env.RESQNOW_ANDROID_STORE_PASSWORD,'synthetic-store-password');
  assert.ok(calls[2].args.includes('-PRESQNOW_ANDROID_VERSION_CODE=112'));assert.ok(calls[2].args.includes('-PRESQNOW_ANDROID_VERSION_NAME=1.4.112'));assert.ok(!JSON.stringify(calls.map(c=>c.args)).includes('password'));
}));
test('native preparation refuses missing Mappls settings before any build or sync command',()=>fixture(async root=>{
  assert.equal(typeof api.prepareAndroidWebAssets,'function');let called=false;
  await assert.rejects(()=>api.prepareAndroidWebAssets({root,publicSettings:{VITE_NATIVE_BUILD:'true'},env:{},run:async()=>{called=true;}}),/Mappls.*key/i);
  assert.equal(called,false);
}));
test('native preparation refuses a stale CI Mappls setting before any command',()=>fixture(async root=>{
  await mapBuildFiles(root);let called=false;
  await assert.rejects(()=>api.prepareAndroidWebAssets({root,publicSettings:{VITE_NATIVE_BUILD:'true',VITE_MAPPLS_MAP_SDK_KEY:'old-sdk-setting'},env:{},run:async()=>{called=true;}}),/fingerprint/i);
  assert.equal(called,false);
}));
test('stale synced maps stop the release before Gradle/signing and a stale APK is never returned',()=>fixture(async root=>{
  const key=path.join(root,'synthetic-key');await fs.writeFile(key,'not a private key');
  const env={JAVA_HOME:root,ANDROID_HOME:root,RESQNOW_ANDROID_KEYSTORE_PATH:key,RESQNOW_ANDROID_KEY_ALIAS:'alias',RESQNOW_ANDROID_STORE_PASSWORD:'synthetic-password',RESQNOW_ANDROID_KEY_PASSWORD:'synthetic-password'};
  const settings={version:{versionCode:112,versionName:'1.4.112'},publicSettings:{VITE_NATIVE_BUILD:'true',VITE_MAPPLS_MAP_SDK_KEY:MAP_KEY},googleServices:{public:'synthetic config'}};
  let calls=0;const runner=api.createAndroidBuildRunner({root,env,run:async()=>{calls++;}});
  await mapBuildFiles(root,{staleNative:true});
  await assert.rejects(()=>runner.build(settings),/Mappls.*stale|Mappls.*changed/i);assert.equal(calls,2);
  await mapBuildFiles(root,{staleApk:true});calls=0;
  await assert.rejects(()=>runner.build(settings),/Mappls.*stale|Mappls.*changed/i);assert.equal(calls,3);
}));
test('missing signing credentials stop before any command or config write',()=>fixture(async root=>{
  assert.equal(typeof api.createAndroidBuildRunner,'function');let called=false;
  const runner=api.createAndroidBuildRunner({root,env:{JAVA_HOME:root,ANDROID_HOME:root},run:async()=>{called=true;}});await assert.rejects(()=>runner.build({version:{versionCode:112,versionName:'1.4.112'},publicSettings:{},googleServices:{}}));assert.equal(called,false);await assert.rejects(()=>fs.stat(path.join(root,'android/app/google-services.json')));
}));

test('release refuses missing native Mappls configuration before web build, signing or provider config writes',()=>fixture(async root=>{
  await mapBuildFiles(root,{nativeConfiguration:false});
  const key=path.join(root,'synthetic-key');await fs.writeFile(key,'not a private key');
  let commands=0;
  const runner=api.createAndroidBuildRunner({root,env:{JAVA_HOME:root,ANDROID_HOME:root,RESQNOW_ANDROID_KEYSTORE_PATH:key,RESQNOW_ANDROID_KEY_ALIAS:'alias',RESQNOW_ANDROID_STORE_PASSWORD:'synthetic-password',RESQNOW_ANDROID_KEY_PASSWORD:'synthetic-password'},run:async()=>{commands++;}});
  await assert.rejects(()=>runner.build({version:{versionCode:112,versionName:'1.4.112'},publicSettings:{VITE_NATIVE_BUILD:'true',VITE_MAPPLS_MAP_SDK_KEY:MAP_KEY},googleServices:{public:'synthetic config'}}),/Mappls Android configuration/i);
  assert.equal(commands,0);
  await assert.rejects(()=>fs.stat(path.join(root,'android/app/google-services.json')));
}));

test('explicit map-disabled release preserves signing/asset checks and forwards the matching native flag without a provider pair',()=>fixture(async root=>{
  await mapBuildFiles(root,{nativeConfiguration:false,mapplsEnabled:false});
  const key=path.join(root,'synthetic-key');await fs.writeFile(key,'not a private key');const calls=[];
  const env={JAVA_HOME:root,ANDROID_HOME:root,RESQNOW_ANDROID_KEYSTORE_PATH:key,RESQNOW_ANDROID_KEY_ALIAS:'alias',RESQNOW_ANDROID_STORE_PASSWORD:'synthetic-password',RESQNOW_ANDROID_KEY_PASSWORD:'synthetic-password'};
  const runner=api.createAndroidBuildRunner({root,env,run:async(command,args,options)=>{calls.push({args,env:options.env});}});
  await runner.build({version:{versionCode:112,versionName:'1.4.112'},publicSettings:{VITE_NATIVE_BUILD:'true',VITE_APP_UPDATES_ENABLED:'true',VITE_NATIVE_MAPPLS_ENABLED:'false',VITE_MAPPLS_MAP_SDK_KEY:MAP_KEY},googleServices:{public:'synthetic config'}});
  assert.equal(calls.length,3);assert.ok(calls[2].args.includes('-PRESQNOW_MAPPLS_ENABLED=false'));
  for(const call of calls)assert.equal(call.env.VITE_NATIVE_MAPPLS_ENABLED,'false');
  assert.equal(calls[0].env.RESQNOW_ANDROID_STORE_PASSWORD,undefined);
  assert.equal(calls[2].env.RESQNOW_ANDROID_STORE_PASSWORD,'synthetic-password');
}));

test('invalid map release settings fail before commands or provider config writes',()=>fixture(async root=>{
  const key=path.join(root,'synthetic-key');await fs.writeFile(key,'not a private key');let calls=0;
  const env={JAVA_HOME:root,ANDROID_HOME:root,RESQNOW_ANDROID_KEYSTORE_PATH:key,RESQNOW_ANDROID_KEY_ALIAS:'alias',RESQNOW_ANDROID_STORE_PASSWORD:'synthetic-password',RESQNOW_ANDROID_KEY_PASSWORD:'synthetic-password'};
  const runner=api.createAndroidBuildRunner({root,env,run:async()=>{calls++;}});
  for(const value of ['FALSE','0','', 'disabled'])await assert.rejects(()=>runner.build({version:{versionCode:112,versionName:'1.4.112'},publicSettings:{VITE_NATIVE_MAPPLS_ENABLED:value},googleServices:{}}),/VITE_NATIVE_MAPPLS_ENABLED/);
  assert.equal(calls,0);await assert.rejects(()=>fs.stat(path.join(root,'android/app/google-services.json')));
}));

test('native Mappls configuration rejects incomplete, ambiguous, empty or non-file pairs without reading credential contents',()=>fixture(async root=>{
  assert.equal(typeof api.verifyMapplsAndroidConfiguration,'function');
  const app=path.join(root,'android/app');await fs.mkdir(app,{recursive:true});
  await fs.writeFile(path.join(app,'fixture-app.a.conf'),'synthetic config');
  await fs.writeFile(path.join(app,'different-app.a.olf'),'synthetic license');
  await assert.rejects(()=>api.verifyMapplsAndroidConfiguration({root}),/Mappls Android configuration/i);
  await fs.rename(path.join(app,'different-app.a.olf'),path.join(app,'fixture-app.a.olf'));
  assert.deepEqual(await api.verifyMapplsAndroidConfiguration({root}),{appId:'fixture-app'});
  await fs.writeFile(path.join(app,'another-app.a.conf'),'synthetic config');
  await assert.rejects(()=>api.verifyMapplsAndroidConfiguration({root}),/Mappls Android configuration/i);
  await fs.rm(path.join(app,'another-app.a.conf'));
  await fs.writeFile(path.join(app,'fixture-app.a.olf'),'');
  await assert.rejects(()=>api.verifyMapplsAndroidConfiguration({root}),/Mappls Android configuration/i);
  await fs.rm(path.join(app,'fixture-app.a.olf'));await fs.mkdir(path.join(app,'fixture-app.a.olf'));
  await assert.rejects(()=>api.verifyMapplsAndroidConfiguration({root}),/Mappls Android configuration/i);
}));
test('synthetic native verification setup refuses to overwrite an owner configuration',()=>fixture(async root=>{
  assert.equal(typeof api.prepareAndroidChecks,'function');await assert.rejects(()=>api.prepareAndroidChecks({root,env:{}}));
  const owner=path.join(root,'android/app/google-services.json');await fs.mkdir(path.dirname(owner),{recursive:true});await fs.writeFile(owner,'owner public configuration');
  await api.prepareAndroidChecks({root,env:{CI:'true',ANDROID_CHECKS_ONLY:'true'}});const file=path.join(root,'android/app/src/debug/google-services.json');const first=await fs.readFile(file,'utf8');assert.equal(JSON.parse(first).client[0].client_info.android_client_info.package_name,'com.resqnow1.app');await assert.rejects(()=>api.prepareAndroidChecks({root,env:{CI:'true',ANDROID_CHECKS_ONLY:'true'}}));assert.equal(await fs.readFile(file,'utf8'),first);assert.equal(await fs.readFile(owner,'utf8'),'owner public configuration');
}));
test('ephemeral signing files are private, scoped to runner temp, and removed even after build failure',()=>fixture(async root=>{
  assert.equal(typeof api.withSigningFile,'function');const env={GITHUB_ACTIONS:'true',RUNNER_TEMP:root,ANDROID_KEYSTORE_BASE64:Buffer.from('synthetic keystore bytes').toString('base64')};let file;
  await assert.rejects(()=>api.withSigningFile(env,async scoped=>{file=scoped.RESQNOW_ANDROID_KEYSTORE_PATH;assert.equal(path.dirname(file),root);assert.equal(await fs.readFile(file,'utf8'),'synthetic keystore bytes');throw Error('synthetic build failed');}));await assert.rejects(()=>fs.stat(file));assert.deepEqual(await fs.readdir(root),[]);
}));

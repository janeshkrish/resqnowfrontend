import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
const api=await import('./android-release-build.mjs').catch(()=>({}));
async function fixture(body){const root=await fs.mkdtemp(path.join(os.tmpdir(),'resqnow-native-build-'));try{await body(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
test('build/sign commands receive explicit versions, isolated settings and no token/password command arguments',()=>fixture(async root=>{
  assert.equal(typeof api.createAndroidBuildRunner,'function');const key=path.join(root,'synthetic-key');await fs.writeFile(key,'not a private key');const calls=[];
  const env={PATH:process.env.PATH,JAVA_HOME:root,ANDROID_HOME:root,GITHUB_TOKEN:'synthetic-api-token',RESQNOW_ANDROID_KEYSTORE_PATH:key,RESQNOW_ANDROID_KEY_ALIAS:'synthetic-alias',RESQNOW_ANDROID_STORE_PASSWORD:'synthetic-store-password',RESQNOW_ANDROID_KEY_PASSWORD:'synthetic-key-password'};
  const runner=api.createAndroidBuildRunner({root,env,run:async(command,args,options)=>{calls.push({command,args,env:options.env});}});
  const apk=await runner.build({version:{versionCode:112,versionName:'1.4.112'},publicSettings:{VITE_NATIVE_BUILD:'true',VITE_APP_UPDATES_ENABLED:'true'},googleServices:{public:'synthetic config'}});
  assert.equal(apk,path.join(root,'android/app/build/outputs/apk/release/app-release.apk'));assert.equal(calls.length,3);
  assert.equal(calls[0].env.GITHUB_TOKEN,undefined);assert.equal(calls[0].env.RESQNOW_ANDROID_STORE_PASSWORD,undefined);assert.equal(calls[2].env.GITHUB_TOKEN,undefined);assert.equal(calls[2].env.RESQNOW_ANDROID_STORE_PASSWORD,'synthetic-store-password');
  assert.ok(calls[2].args.includes('-PRESQNOW_ANDROID_VERSION_CODE=112'));assert.ok(calls[2].args.includes('-PRESQNOW_ANDROID_VERSION_NAME=1.4.112'));assert.ok(!JSON.stringify(calls.map(c=>c.args)).includes('password'));
}));
test('missing signing credentials stop before any command or config write',()=>fixture(async root=>{
  assert.equal(typeof api.createAndroidBuildRunner,'function');let called=false;
  const runner=api.createAndroidBuildRunner({root,env:{JAVA_HOME:root,ANDROID_HOME:root},run:async()=>{called=true;}});await assert.rejects(()=>runner.build({version:{versionCode:112,versionName:'1.4.112'},publicSettings:{},googleServices:{}}));assert.equal(called,false);await assert.rejects(()=>fs.stat(path.join(root,'android/app/google-services.json')));
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

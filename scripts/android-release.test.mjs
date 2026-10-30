import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const api=await import('./android-release.mjs').catch(()=>({}));
function version(input){assert.equal(typeof api.prepareAndroidVersion,'function');return api.prepareAndroidVersion(input);}
test('allocates deterministic increasing Android codes, never timestamps or rerun overwrites',()=>{
  assert.deepEqual(version({floor:100,runNumber:12,latestVersionCode:110}),{versionCode:112,versionName:'1.4.112',tag:'android-v112'});
  for(const input of [{floor:4,runNumber:1,latestVersionCode:5},{floor:2147483647,runNumber:1,latestVersionCode:4},{floor:4,runNumber:0,latestVersionCode:4},{floor:4.5,runNumber:1,latestVersionCode:4},{floor:4,runNumber:2,latestVersionCode:null}])assert.throws(()=>version(input));
});
const settings={VITE_API_URL:'https://resqnowbackend-production-c392.up.railway.app',VITE_FRONTEND_ONLY:'false',VITE_APP_UPDATES_ENABLED:'true',VITE_NATIVE_BUILD:'true',VITE_FIREBASE_API_KEY:'AIzaSyApprovedPublicConfigKey12345678901',VITE_FIREBASE_AUTH_DOMAIN:'resqnow-prod.firebaseapp.com',VITE_FIREBASE_PROJECT_ID:'resqnow-prod',VITE_FIREBASE_MESSAGING_SENDER_ID:'123456789012',VITE_FIREBASE_APP_ID:'1:123456789012:web:abcdef123456',VITE_MAPPLS_MAP_SDK_KEY:'approved-public-map-key',VITE_RAZORPAY_KEY_ID:'rzp_live_1234567890'};
test('production builds require explicit public settings and reject test/demo overrides',()=>{
  assert.equal(typeof api.validateProductionSettings,'function');assert.doesNotThrow(()=>api.validateProductionSettings(settings));
  for(const patch of [{VITE_API_URL:'http://localhost:5000'},{VITE_FRONTEND_ONLY:'true'},{VITE_FIREBASE_PROJECT_ID:'resqnow-e2e'},{VITE_FIREBASE_API_KEY:''},{VITE_NATIVE_BUILD:'false'},{VITE_RAZORPAY_KEY_ID:'rzp_test_example'}])assert.throws(()=>api.validateProductionSettings({...settings,...patch}));
});
const badging="package: name='com.resqnow1.app' versionCode='112' versionName='1.4.112'\nsdkVersion:'24'\ntargetSdkVersion:'36'\n";
const signature='Verifies\nSigner #1 certificate DN: CN=ResQNow\nSigner #1 certificate SHA-256 digest: '+ 'b'.repeat(64)+'\n';
const expected={schemaVersion:1,channel:'stable',applicationId:'com.resqnow1.app',versionCode:112,versionName:'1.4.112',minSdk:24,targetSdk:36,signingCertificateSha256:'b'.repeat(64),sourceCommit:'c'.repeat(40),publishedAt:'2026-10-30T12:00:00Z',apkUrl:'https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v112/resqnow.apk'};
const context={actions:true,repository:'janeshkrish/resqnowfrontend',ref:'refs/heads/main',event:'workflow_dispatch',sha:'c'.repeat(40),checksPassed:true,attempt:1};
const releaseSettings={public:settings,floor:100,runNumber:12,reviewedMaxVersionCode:4,distributionConfirmed:true,certificateSha256:'b'.repeat(64),googleServices:{project_info:{project_id:'resqnow-prod',project_number:'123456789012'},client:[{client_info:{android_client_info:{package_name:'com.resqnow1.app'}},api_key:[{current_key:'AIzaSyApprovedPublicNativeKey'}]}]}};
async function artifact(body){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'resqnow-release-test-'));const apk=path.join(dir,'resqnow.apk');await fs.writeFile(apk,'apk test bytes!!');try{return await body(apk);}finally{await fs.rm(dir,{recursive:true,force:true});}}
test('verifies real APK bytes against independent Android tool outputs before generating metadata',()=>artifact(async apk=>{
  assert.equal(typeof api.verifyAndroidArtifact,'function');const result=await api.verifyAndroidArtifact({apk,expectedManifest:expected,tools:{badging:async()=>badging,signature:async()=>signature}});
  assert.deepEqual(result,{...expected,sizeBytes:16,sha256:'fa33f24e6a2c7164c08ffd861085fdc5bdae59c424d53944fb8edc4ffb4f756c'});
}));
test('rejects debug packages, wrong signatures, package/version/SDK, and missing signature verification',()=>artifact(async apk=>{
  assert.equal(typeof api.verifyAndroidArtifact,'function');
  const cases=[{badging:badging+'application-debuggable\n'},{badging:badging.replace('com.resqnow1.app','evil.app')},{badging:badging.replace("versionCode='112'","versionCode='111'")},{badging:badging.replace("sdkVersion:'24'","sdkVersion:'26'")},{signature:signature.replace('b'.repeat(64),'a'.repeat(64))},{signature:signature.replace('CN=ResQNow','CN=Android Debug')},{signature:'DOES NOT VERIFY'}];
  for(const entry of cases)await assert.rejects(()=>api.verifyAndroidArtifact({apk,expectedManifest:expected,tools:{badging:async()=>entry.badging??badging,signature:async()=>entry.signature??signature}}));
}));
test('rejects a same-size APK replacement during external verification',()=>artifact(async apk=>{
  assert.equal(typeof api.verifyAndroidArtifact,'function');await assert.rejects(()=>api.verifyAndroidArtifact({apk,expectedManifest:expected,tools:{badging:async()=>badging,signature:async()=>{await fs.writeFile(apk,'different bytes!');return signature;}}}),/changed/);
}));
test('CLI refuses an untrusted local release invocation without signing/building/publishing',()=>{
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./android-release.mjs',import.meta.url)),'--dry-run'],{encoding:'utf8',env:{...process.env,GITHUB_ACTIONS:'false',ANDROID_AUTO_RELEASE_ENABLED:'false'}});assert.notEqual(result.status,0);assert.match(result.stderr,/trusted|GitHub|release context/i);
});
test('dry-run builds and verifies but cannot create, upload or publish a release',()=>artifact(async apk=>{
  assert.equal(typeof api.runAndroidRelease,'function');const calls=[];
  const runner={build:async()=>{calls.push('build');return apk;},tools:{badging:async()=>badging,signature:async()=>signature}};
  const github={listReleases:async()=>[{tag_name:'android-v110'}],tagExists:async()=>false,createDraft:async()=>{throw Error('dry-run wrote externally');},upload:async()=>{throw Error('dry-run uploaded');},publish:async()=>{throw Error('dry-run published');}};
  const result=await api.runAndroidRelease({context,settings:releaseSettings,runner,github,dryRun:true,now:()=>new Date('2026-10-30T12:00:00Z')});assert.equal(result.dryRun,true);assert.equal(result.manifest.versionCode,112);assert.deepEqual(calls,['build']);
}));
test('unknown/inaccessible history, tag reuse and unconfirmed distribution identity stop before building',()=>artifact(async apk=>{
  assert.equal(typeof api.runAndroidRelease,'function');let builds=0;const runner={build:async()=>{builds++;return apk;}};
  const variations=[{settings:{...releaseSettings,distributionConfirmed:false}},{list:async()=>null},{list:async()=>{throw Error('offline');}},{list:async()=>[{tag_name:'android-v0110'}]},{list:async()=>[{tag_name:'android-v112'}]},{tag:async()=>true}];
  for(const v of variations)await assert.rejects(()=>api.runAndroidRelease({context,settings:v.settings??releaseSettings,runner,github:{listReleases:v.list??(async()=>[]),tagExists:v.tag??(async()=>false)},dryRun:true}));assert.equal(builds,0);
}));
test('PR, non-main, disabled, failed checks and rerun contexts cannot build or publish',async()=>{
  let touched=false;const options={context,settings:releaseSettings,runner:{build:async()=>{touched=true;}},github:{listReleases:async()=>{touched=true;}}};
  for(const patch of [{event:'pull_request'},{ref:'refs/heads/friend'},{repository:'fork/frontend'},{checksPassed:false},{attempt:2},{actions:false}])await assert.rejects(()=>api.runAndroidRelease({...options,context:{...context,...patch},enabled:true}));
  await assert.rejects(()=>api.runAndroidRelease({...options,enabled:false}));assert.equal(touched,false);
});
test('reserves a new tag, drafts, uploads and independently checks both assets before stable publication',()=>artifact(async apk=>{
  const calls=[];const assets=new Map();const github={listReleases:async()=>[],tagExists:async()=>false,
    reserveTag:async(tag,sha)=>{assert.equal(tag,'android-v112');assert.equal(sha,'c'.repeat(40));calls.push('reserve');},
    createDraft:async value=>{assert.deepEqual(value,{tag:'android-v112',sha:'c'.repeat(40),versionName:'1.4.112'});calls.push('draft');return {id:123};},
    upload:async(id,name,bytes)=>{assert.equal(id,123);calls.push('upload:'+name);assets.set(name,bytes);return {id:name,name,size:bytes.length,state:'uploaded'};},
    readAsset:async id=>{calls.push('read:'+id);return assets.get(id);},publish:async id=>{assert.equal(id,123);calls.push('publish');return {html_url:'https://github.com/janeshkrish/resqnowfrontend/releases/tag/android-v112'};}};
  const result=await api.runAndroidRelease({context,settings:releaseSettings,enabled:true,github,runner:{build:async()=>apk,tools:{badging:async()=>badging,signature:async()=>signature}}});
  assert.equal(result.dryRun,false);assert.deepEqual(calls,['reserve','draft','upload:resqnow.apk','read:resqnow.apk','upload:android-release.json','read:android-release.json','publish']);
  const uploaded=JSON.parse(assets.get('android-release.json').toString());assert.equal(uploaded.sha256,'fa33f24e6a2c7164c08ffd861085fdc5bdae59c424d53944fb8edc4ffb4f756c');
}));
test('failed upload, changed remote bytes or wrong remote metadata never publish over the previous release',()=>artifact(async apk=>{
  for(const fault of ['upload','bytes','metadata']){
    let published=false,touched=false;const github={listReleases:async()=>[],tagExists:async()=>false,reserveTag:async()=>{},createDraft:async()=>({id:123}),
      upload:async(_id,name,bytes)=>{touched=true;if(fault==='upload')throw Error('upload disconnected');return {id:name,name,size:bytes.length+(fault==='metadata'?1:0),state:'uploaded'};},
      readAsset:async()=>fault==='bytes'?Buffer.from('corrupt remote'):await fs.readFile(apk),publish:async()=>{published=true;}};
    await assert.rejects(()=>api.runAndroidRelease({context,settings:releaseSettings,enabled:true,github,runner:{build:async()=>apk,tools:{badging:async()=>badging,signature:async()=>signature}}}));assert.equal(touched,true);assert.equal(published,false);
  }
}));

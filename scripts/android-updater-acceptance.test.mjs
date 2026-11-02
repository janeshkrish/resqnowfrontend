import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const api=await import('./android-updater-acceptance.mjs').catch(()=>({}));
const context={ci:true,github:true,serial:'emulator-5554',avd:'resqnow-updater-acceptance'};
test('device acceptance refuses local, physical, ambiguous and unrelated emulator targets',()=>{
  assert.equal(typeof api.requireHostedEmulator,'function');assert.doesNotThrow(()=>api.requireHostedEmulator(context));
  for(const patch of [{ci:false},{github:false},{serial:'physical-phone'},{serial:''},{avd:'personal-avd'}])assert.throws(()=>api.requireHostedEmulator({...context,...patch}));
});
test('system UI coordinates are selected from explicit enabled controls, never a blind fixed tap',()=>{
  assert.equal(typeof api.androidControl,'function');const xml='<hierarchy><node text="Update" enabled="false" resource-id="android:id/button1" bounds="[0,0][1,1]"/><node text="Update" enabled="true" resource-id="android:id/button1" bounds="[10,20][110,80]"/></hierarchy>';
  assert.deepEqual(api.androidControl(xml,{text:'Update',resourceId:'android:id/button1'}),{x:60,y:50});assert.throws(()=>api.androidControl(xml,{text:'Delete',resourceId:'android:id/button1'}));
});
function release(code,bytes){return {schemaVersion:1,channel:'stable',applicationId:'com.resqnow1.app',versionCode:code,versionName:'ci.'+code,minSdk:24,targetSdk:36,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signingCertificateSha256:'b'.repeat(64),sourceCommit:'c'.repeat(40),publishedAt:'2026-10-30T12:00:00Z',apkUrl:`https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v${code}/resqnow.apk`};}
test('owned fixture service serves immutable metadata, resumable real bytes and no account headers',async()=>{
  assert.equal(typeof api.startFixtureService,'function');const bytes=Buffer.from('0123456789abcdef');const manifest=release(1006,bytes);const service=await api.startFixtureService({candidates:[{manifest,bytes}],port:0});
  try{const response=await fetch(service.url+'/api/public/android-app/update');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{state:'ready',release:manifest});
    const partial=await fetch(service.url+'/assets/1006.apk',{headers:{Range:'bytes=4-'}});assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 4-15/16');assert.equal(await partial.text(),'456789abcdef');
    assert.equal((await fetch(service.url+'/assets/1006.apk',{headers:{Range:'bytes=99-'}})).status,416);assert.equal(service.requests[0].authorization,false);
  }finally{await service.close();}
});
test('fixture pause/cancel is bounded and closes all owned sockets',async()=>{
  assert.equal(typeof api.startFixtureService,'function');const bytes=Buffer.alloc(256*1024,7);const service=await api.startFixtureService({candidates:[{manifest:release(1007,bytes),bytes}],port:0});
  try{service.pause(1007,65536);const controller=new AbortController();const response=await fetch(service.url+'/assets/1007.apk',{signal:controller.signal});const reader=response.body.getReader();assert.ok((await reader.read()).value.length>0);controller.abort();await reader.cancel().catch(()=>{});service.resume(1007);}
  finally{await service.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const api=await import('./android-release-guards.mjs').catch(()=>({}));
async function fixture(body){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'resqnow-gradle-guard-'));
  try{await fs.mkdir(path.join(root,'android/app'),{recursive:true});await body(root);}
  finally{await fs.rm(root,{recursive:true,force:true});}
}
const rejection='Release requires approved matching Mappls Android configuration/license files';

test('map-disabled producer checks cover native/web mismatch, typo, valid dry-run and preserved updater/signing gates',()=>fixture(async root=>{
  const calls=[];
  const result=await api.verifyAndroidReleaseGuards({root,env:{CI:'true',ANDROID_CHECKS_ONLY:'true',JAVA_HOME:root},run:async(_c,args,options)=>{
    calls.push({args,env:options.env});
    return graphResult(args,options.env);
  }});
  assert.equal(result.checked,14);
  const disabled=calls.filter(c=>c.args.includes('-PRESQNOW_MAPPLS_ENABLED=false'));
  assert.equal(disabled.filter(c=>c.env.VITE_NATIVE_MAPPLS_ENABLED==='true').length,5);
  assert.ok(disabled.some(c=>c.env.VITE_APP_UPDATES_ENABLED==='false'));
  assert.ok(disabled.some(c=>!c.env.RESQNOW_ANDROID_KEYSTORE_PATH));
  assert.ok(disabled.some(c=>c.env.VITE_APP_UPDATES_ENABLED==='true'&&c.env.VITE_NATIVE_MAPPLS_ENABLED==='false'&&c.env.RESQNOW_ANDROID_KEYSTORE_PATH));
  assert.ok(calls.every(c=>c.args.includes('--dry-run')));
}));

function graphResult(args,env){
  const mode=args.find(a=>a.startsWith('-PRESQNOW_MAPPLS_ENABLED='))?.split('=')[1];
  if(mode===undefined)return {code:1,output:rejection};
  if(mode!=='false')return {code:1,output:'RESQNOW_MAPPLS_ENABLED must be true or false'};
  if(env.VITE_NATIVE_MAPPLS_ENABLED!=='false')return {code:1,output:'Release requires matching web/native Mappls mode'};
  if(env.VITE_APP_UPDATES_ENABLED!=='true')return {code:1,output:'Release requires checked version overrides and enabled packaged/native updater build flags'};
  if(!env.RESQNOW_ANDROID_KEYSTORE_PATH)return {code:1,output:'Release requires the existing owner signing key through environment-only configuration'};
  return {code:0,output:'BUILD SUCCESSFUL'};
}
test('negative release checks exercise every direct producer without real signing or credential propagation',()=>fixture(async root=>{
  assert.equal(typeof api.verifyAndroidReleaseGuards,'function');
  const tasks=[];let fixtureKey;
  const result=await api.verifyAndroidReleaseGuards({root,env:{CI:'true',ANDROID_CHECKS_ONLY:'true',JAVA_HOME:root,GITHUB_TOKEN:'do-not-forward',RESQNOW_ANDROID_STORE_PASSWORD:'owner-do-not-forward'},run:async(command,args,options)=>{
    assert.ok(command.startsWith(root+path.sep));assert.ok(args.includes('--dry-run'));
    assert.equal(options.env.GITHUB_TOKEN,undefined);assert.notEqual(options.env.RESQNOW_ANDROID_STORE_PASSWORD,'owner-do-not-forward');
    if(options.env.RESQNOW_ANDROID_KEYSTORE_PATH){fixtureKey=options.env.RESQNOW_ANDROID_KEYSTORE_PATH;assert.ok((await fs.readFile(fixtureKey,'utf8')).startsWith('Not a keystore.'));}
    assert.ok(!JSON.stringify(args).includes('password'));
    if(!args.some(arg=>arg.startsWith('-PRESQNOW_MAPPLS_ENABLED=')))tasks.push(args.find(arg=>arg.startsWith(':app:')));
    return graphResult(args,options.env);
  }});
  assert.deepEqual(tasks,[':app:assembleRelease',':app:bundleRelease',':app:packageRelease',':app:signReleaseBundle',':app:packageReleaseBundle']);
  assert.equal(result.checked,14);await assert.rejects(()=>fs.stat(fixtureKey));
}));
test('a successful graph or an unrelated failure never passes the release guard check and cleans its fixture',()=>fixture(async root=>{
  assert.equal(typeof api.verifyAndroidReleaseGuards,'function');
  for(const outcome of [{code:0,output:'BUILD SUCCESSFUL'},{code:1,output:'dependency download failed'}]){
    let fixtureKey;
    await assert.rejects(()=>api.verifyAndroidReleaseGuards({root,env:{CI:'true',ANDROID_CHECKS_ONLY:'true',JAVA_HOME:root},run:async(_c,_a,options)=>{fixtureKey=options.env.RESQNOW_ANDROID_KEYSTORE_PATH;return outcome;}}),/not verified/);
    await assert.rejects(()=>fs.stat(fixtureKey));
  }
}));
test('negative release checks refuse a non-verification context, private dotenv or real provider-file directory',()=>fixture(async root=>{
  assert.equal(typeof api.verifyAndroidReleaseGuards,'function');let commands=0;
  const run=async()=>{commands++;return {code:1,output:rejection};};
  await assert.rejects(()=>api.verifyAndroidReleaseGuards({root,env:{JAVA_HOME:root},run}));
  const env={CI:'true',ANDROID_CHECKS_ONLY:'true',JAVA_HOME:root};
  await fs.writeFile(path.join(root,'.env'),'private-fixture-do-not-load');
  await assert.rejects(()=>api.verifyAndroidReleaseGuards({root,env,run}));
  await fs.rm(path.join(root,'.env'));
  await fs.writeFile(path.join(root,'android/app/provider.a.conf'),'do-not-read-provider-fixture');
  await assert.rejects(()=>api.verifyAndroidReleaseGuards({root,env,run}));
  assert.equal(commands,0);
  assert.equal(await fs.readFile(path.join(root,'android/app/provider.a.conf'),'utf8'),'do-not-read-provider-fixture');
}));

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
test('negative release checks exercise every direct producer without real signing or credential propagation',()=>fixture(async root=>{
  assert.equal(typeof api.verifyAndroidReleaseGuards,'function');
  const tasks=[];let fixtureKey;
  const result=await api.verifyAndroidReleaseGuards({root,env:{CI:'true',ANDROID_CHECKS_ONLY:'true',JAVA_HOME:root,GITHUB_TOKEN:'do-not-forward',RESQNOW_ANDROID_STORE_PASSWORD:'owner-do-not-forward'},run:async(command,args,options)=>{
    assert.ok(command.startsWith(root+path.sep));assert.ok(args.includes('--dry-run'));
    assert.equal(options.env.GITHUB_TOKEN,undefined);assert.notEqual(options.env.RESQNOW_ANDROID_STORE_PASSWORD,'owner-do-not-forward');
    fixtureKey=options.env.RESQNOW_ANDROID_KEYSTORE_PATH;
    assert.ok((await fs.readFile(fixtureKey,'utf8')).startsWith('Not a keystore.'));
    assert.ok(!JSON.stringify(args).includes('password'));
    tasks.push(args.find(arg=>arg.startsWith(':app:')));
    return {code:1,output:rejection};
  }});
  assert.deepEqual(tasks,[':app:assembleRelease',':app:bundleRelease',':app:packageRelease',':app:signReleaseBundle',':app:packageReleaseBundle']);
  assert.equal(result.checked,5);await assert.rejects(()=>fs.stat(fixtureKey));
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

import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {requireHostedEmulator,androidControl,startFixtureService} from './android-updater-acceptance.mjs';import {fixtureEnvironment} from './android-updater-fixtures.mjs';
const APP='com.resqnow1.app';const exec=promisify(execFile);
async function command(cmd,args,options){return (await exec(cmd,args,{...options,timeout:120000,maxBuffer:1024*1024,windowsHide:true})).stdout;}
async function until(action,{timeout=120000,label='acceptance condition'}={}){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await action();if(value)return value;}catch(error){last=error;}await new Promise(r=>setTimeout(r,500));}throw Error('Timed out: '+label+(last?' ('+last.message+')':''));}
export async function createEmulatorDriver({env=process.env,run=command,connect}={}){
  requireHostedEmulator({ci:env.CI==='true',github:env.GITHUB_ACTIONS==='true',serial:env.ANDROID_SERIAL,avd:'resqnow-updater-acceptance'});
  const sdk=env.ANDROID_HOME??env.ANDROID_SDK_ROOT;if(!sdk)throw Error('Android SDK required');const adb=path.join(sdk,'platform-tools',process.platform==='win32'?'adb.exe':'adb'),serial=env.ANDROID_SERIAL;
  const call=(...args)=>run(adb,['-s',serial,...args],{env:fixtureEnvironment(env)});const avd=(await call('emu','avd','name')).trim().split(/\r?\n/)[0];
  requireHostedEmulator({ci:true,github:true,serial,avd});
  const version=async()=>{const info=await call('shell','dumpsys','package',APP);const raw=/\bversionCode=(\d+)\b/.exec(info);return raw?Number(raw[1]):null;};
  if(await version()!==null)throw Error('ResQNow is already installed: refusing to uninstall, clear or replace it');
  const forwards=new Set();let seeded=false;
  async function xml(){await call('shell','uiautomator','dump','/sdcard/resqnow-updater-acceptance.xml');return call('shell','cat','/sdcard/resqnow-updater-acceptance.xml');}
  async function tapSystem(packages,selectors){return until(async()=>{
    const focus=await call('shell','dumpsys','window','windows');if(!packages.some(pkg=>new RegExp('mCurrentFocus=.*\\b'+pkg.replaceAll('.','\\.')+'/').test(focus)))return false;
    const tree=await xml();for(const selector of selectors){try{const point=androidControl(tree,selector);await call('shell','input','tap',String(point.x),String(point.y));return true;}catch{/* This explicit control may use a different supported platform ID. */}}return false;
  },{timeout:30000,label:'expected Android system control'});}
  return {version,
    async installSeed(apk){if(seeded||path.basename(apk)!=='1001.apk')throw Error('Only seed A may be installed once through ADB');seeded=true;await call('install','-t',apk);assert.equal(await version(),1001);},
    start:()=>call('shell','am','start','-n',APP+'/.MainActivity'),forceStop:()=>call('shell','am','force-stop',APP),
    async runConsentInstrumentation(apk){
      if(!seeded||path.basename(apk)!=='legacy-consent-androidTest.apk')throw Error('Only the explicit consent test APK is allowed');
      await call('install','-t',apk);
      const output=await call('shell','am','instrument','-w','-r','-e','resqnowHostedAcceptanceOnly','true','-e','class','com.resqnow1.app.updates.LegacyUpdateConsentTest',APP+'.test/androidx.test.runner.AndroidJUnitRunner');
      if(!/OK \(1 test\)/.test(output)||/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(output))throw Error('Real Android consent instrumentation failed: '+output.slice(-4000));
      assert.equal(await version(),1001);
    },
    async attach(){
      const pid=await until(async()=>{const value=(await call('shell','pidof',APP)).trim();return /^[0-9]+$/.test(value)&&value;},{label:'owned app process'});
      const port=(await call('forward','tcp:0','localabstract:webview_devtools_remote_'+pid)).trim();if(!/^[1-9][0-9]{0,4}$/.test(port)||Number(port)>65535)throw Error('Invalid owned CDP port');forwards.add(port);
      const attach=connect??(await import('@playwright/test')).chromium.connectOverCDP.bind((await import('@playwright/test')).chromium);
      const browser=await until(()=>attach('http://127.0.0.1:'+port,{timeout:5000}),{label:'native WebView CDP'});
      const page=await until(async()=>browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('https://localhost/')),{label:'packaged local WebView'});return {browser,page};
    },
    async allowSource(){
      const tree=await until(async()=>{const value=await xml();return value.includes('Allow from this source')&&value;},{timeout:30000,label:'unknown-app source settings'});
      if(!/checked="false"/.test(tree))throw Error('Install source permission was not initially denied');
      await tapSystem(['com.android.settings'],[{resourceId:'android:id/switch_widget'},{resourceId:'com.android.settings:id/switch_widget'}]);await call('shell','input','keyevent','KEYCODE_BACK');
    },
    async returnFromDeniedSource(){
      await until(async()=>{const focus=await call('shell','dumpsys','window','windows');return /mCurrentFocus=.*\bcom\.android\.settings\//.test(focus);},{timeout:30000,label:'install source settings'});
      await call('shell','input','keyevent','KEYCODE_BACK');
    },
    cancelInstaller:()=>tapSystem(['com.android.packageinstaller','com.google.android.packageinstaller'],[{text:'Cancel',resourceId:'android:id/button2'},{text:'Cancel',resourceId:'com.android.packageinstaller:id/cancel_button'},{text:'Cancel',resourceId:'com.google.android.packageinstaller:id/cancel_button'}]),
    confirmUpdate:()=>tapSystem(['com.android.packageinstaller','com.google.android.packageinstaller'],[{text:'Update',resourceId:'android:id/button1'},{text:'Update',resourceId:'com.android.packageinstaller:id/ok_button'},{text:'Update',resourceId:'com.google.android.packageinstaller:id/ok_button'}]),
    async close(){for(const port of forwards)await call('forward','--remove','tcp:'+port).catch(()=>{});},
  };
}
export async function runNativeUpgrade({fixtures,env=process.env,reportFile}){
  // Validate the device before starting the server or installing even the synthetic seed.
  const device=await createEmulatorDriver({env});let service,connection;const checks=[];
  try{
    const candidates=await Promise.all(fixtures.candidates.map(async c=>({...c,bytes:await fs.readFile(c.apk)})));service=await startFixtureService({candidates});service.select(1000);
    await device.installSeed(fixtures.seedApk);await device.start();connection=await device.attach();let page=connection.page;
    const button=name=>page.getByRole('button',{name,exact:true});
    const state=()=>page.evaluate(()=>window.__acceptance.status());
    const phase=(value)=>until(async()=>{const s=await state();return s.phase===value&&s;},{label:'native phase '+value});
    const check=async()=>{await button('Check for updates').click();await button('Check for updates').waitFor({state:'visible'});};
    await page.getByTestId('native-marker').waitFor();assert.equal(await page.getByTestId('native-marker').textContent(),'A');
    // Let initial native version stamping complete BEFORE seeding the old code worker.
    await until(()=>page.evaluate(()=>window.__resqnowNativeCode?.phase==='done'),{label:'initial native code stamp'});
    await button('Create synthetic identity and settings').click();await button('Synthetic identity and settings saved').waitFor();
    await until(()=>page.getByTestId('fixture-worker').textContent().then(t=>t==='old worker ready'),{label:'seeded A service worker'});
    const identity=await page.evaluate(()=>window.__acceptance.identity());assert.ok(identity);assert.equal((await state()).installedVersionCode,1001);
    assert.equal(service.requests.some(r=>r.path==='/assets/1000.apk'),false);checks.push('no-downgrade');
    for(const code of [1002,1003,1004]){service.select(code);await check();const rejected=await phase('failed');assert.equal(rejected.release.versionCode,code);assert.ok(service.requests.some(r=>r.path===`/assets/${code}.apk`));assert.equal(await device.version(),1001);checks.push('rejected-'+code);}
    service.select(1005);await check();assert.equal(service.requests.some(r=>r.path==='/assets/1005.apk'),false);assert.equal(await device.version(),1001);checks.push('unsupported-sdk');
    service.select(1006);await check();await phase('ready');
    service.setWork({customer:true});await button('Update now').click();await page.getByRole('status').filter({hasText:'Finish your current request or job'}).waitFor();assert.equal((await state()).phase,'ready');service.setWork({});checks.push('authoritative-customer-work-deferral');
    await button('Technician account').click();await button('Simulate accepted job').click();assert.equal(await button('Update now').isDisabled(),true);await button('Clear simulated job').click();
    service.setWork({technician:true});await button('Update now').click();await page.getByRole('status').filter({hasText:'Finish your current request or job'}).waitFor();assert.equal((await state()).phase,'ready');service.setWork({});checks.push('technician-job-deferral');
    await button('Enter payment flow').click();assert.equal(await button('Update now').isDisabled(),true);await button('Return to settings').click();checks.push('payment-deferral');
    await button('Customer account').click();assert.equal((await page.evaluate(()=>window.__acceptance.storage())).blocked,true);checks.push('storage-guard');
    await page.evaluate(()=>window.__acceptance.evict());await phase('failed');await button('Retry download').click();await phase('ready');checks.push('evicted-candidate-recovery');
    await button('Update now').click();await phase('permission-required');assert.equal(await device.version(),1001);await button('Allow app updates').click();await device.returnFromDeniedSource();await phase('permission-required');assert.equal(await device.version(),1001);checks.push('permission-denied-return');
    await button('Allow app updates').click();await device.allowSource();await phase('ready');assert.equal(await device.version(),1001);checks.push('permission-return-does-not-install');
    await button('Update now').click();await device.cancelInstaller();await phase('ready');assert.equal(await device.version(),1001);checks.push('android-installer-cancel-does-not-retry');
    await button('Update now').click();await device.confirmUpdate();await until(async()=>await device.version()===1006,{label:'Android-installed B version'});
    await connection.browser.close().catch(()=>{});connection=null;await device.start();connection=await device.attach();page=connection.page;
    await until(()=>page.getByTestId('native-marker').textContent().then(t=>t==='B'),{label:'new packaged frontend B, not cached A'});
    assert.equal(await page.evaluate(()=>window.__acceptance.identity()),identity);const retained=await page.evaluate(async()=>({theme:localStorage.getItem('vite-ui-theme'),setting:localStorage.getItem('resqnow-acceptance-setting'),api:await(await(await caches.open('resqnow-api-cache')).match('/synthetic/api')).text(),image:await(await(await caches.open('resqnow-image-cache')).match('/synthetic/image')).text(),oldCode:(await caches.keys()).some(n=>n==='workbox-precache-resqnow-acceptance-A'),workers:(await navigator.serviceWorker.getRegistrations()).length}));
    assert.deepEqual(retained,{theme:'dark',setting:'synthetic-retained-setting',api:'synthetic-api-data',image:'synthetic-image-data',oldCode:false,workers:0});checks.push('android-confirmed-A-to-B','native-identity-and-user-data-retained','old-worker-code-refreshed');
    service.pause(1007);service.select(1007);await check();await until(()=>page.evaluate(async()=>{const c=await window.__acceptance.cache();return c.partialBytes>0&&!c.verified;}),{label:'real partial C download'});
    await button('Cancel download').click();await phase('cancelled');service.resume(1007);assert.equal((await page.evaluate(()=>window.__acceptance.cache())).verified,false);checks.push('cancelled-generation-not-promoted');
    service.pause(1007);await button('Download using mobile data').click();await until(()=>page.evaluate(async()=>{const c=await window.__acceptance.cache();return c.partialBytes>0&&!c.verified;}),{label:'second partial C download'});
    service.interruptOnce(1007);service.resume(1007);await until(async()=>{const s=await state(),cache=await page.evaluate(()=>window.__acceptance.cache());return s.phase==='queued'&&cache.partialBytes>0;},{label:'interrupted worker queued with saved partial'});
    await device.forceStop();await connection.browser.close().catch(()=>{});connection=null;await device.start();connection=await device.attach();page=connection.page;await phase('ready');assert.equal((await state()).release.versionCode,1007);
    assert.ok(service.requests.some(r=>r.path==='/assets/1007.apk'&&/^bytes=[1-9][0-9]*-$/.test(r.range??'')));assert.equal(await device.version(),1006);assert.ok(service.requests.every(r=>!r.authorization&&!r.cookie));checks.push('resume-after-process-death','public-transfer-without-account-credentials');
    await fs.mkdir(path.dirname(reportFile),{recursive:true});await fs.writeFile(reportFile,JSON.stringify({completedAt:new Date().toISOString(),deviceSdk:36,installedVersionCode:1006,checks},null,2));
  }finally{await connection?.browser.close().catch(()=>{});await service?.close();await device.close();}
}
export async function runLegacyConsent({fixtures,env=process.env,reportFile}){
  const device=await createEmulatorDriver({env});
  try{await device.installSeed(fixtures.seedApk);await device.runConsentInstrumentation(fixtures.legacyTestApk);await fs.mkdir(path.dirname(reportFile),{recursive:true});await fs.writeFile(reportFile,JSON.stringify({completedAt:new Date().toISOString(),installedVersionCode:1001,checks:['real-AppUpdater-plugin','permission-denied-return','legacy-or-per-source-settings','permission-grant-no-auto-install','android-installer-cancel-no-retry']},null,2));}
  finally{await device.close();}
}

import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const api=await import('./android-updater-native-flow.mjs').catch(()=>({}));
const env={CI:'true',GITHUB_ACTIONS:'true',ANDROID_SERIAL:'emulator-5554',ANDROID_HOME:'/synthetic-sdk'};
const composePermission=await fs.readFile(new URL('./fixtures/android16-install-source.xml',import.meta.url),'utf8');

test('owned WebView attachment preserves Android context defaults instead of requesting desktop download management',async()=>{
  const commands=[];let attachment;
  const page={url:()=> 'https://localhost/index.html'};
  const driver=await api.createEmulatorDriver({env,
    run:async(_command,args)=>{commands.push(args);if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';if(args.includes('pidof'))return '4242';if(args.includes('tcp:0'))return '37127';return '';},
    connect:async(url,options)=>{attachment={url,options};return {contexts:()=>[{pages:()=>[page]}]};},
  });
  const attached=await driver.attach();assert.equal(attached.page,page);
  assert.deepEqual(attachment,{url:'http://127.0.0.1:37127',options:{timeout:5000,noDefaults:true}});
  assert.ok(commands.some(args=>args.includes('localabstract:webview_devtools_remote_4242')));
  await driver.close();assert.ok(commands.some(args=>args.includes('--remove')&&args.includes('tcp:37127')));
});
test('host driver performs no command outside an explicitly owned hosted emulator',async()=>{
  assert.equal(typeof api.createEmulatorDriver,'function');let calls=0;await assert.rejects(()=>api.createEmulatorDriver({env:{...env,GITHUB_ACTIONS:'false'},run:async()=>{calls++;}}));assert.equal(calls,0);
  await assert.rejects(()=>api.createEmulatorDriver({env,run:async()=>{calls++;return 'personal-avd\nOK';}}),/owned|hosted/i);assert.equal(calls,1);
});

test('Android 16 permission return uses the display focus dump rather than a window-only inventory', {timeout:40000},async()=>{
  // Android 16 moved display focus outside dumpWindowsLocked's window-only inventory.
  // A valid foreground Settings screen must lead to exactly one real Back action.
  const commands=[];
  const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{
    commands.push(args);
    if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';
    if(args.slice(2).join(' ')==='shell dumpsys window')return 'WINDOW MANAGER DISPLAY CONTENTS\n  mCurrentFocus=Window{123 u0 com.android.settings/.Settings}';
    if(args.slice(2).join(' ')==='shell dumpsys window windows')return 'WINDOW MANAGER WINDOWS\n Window #0 Window{123 u0 com.android.settings/.Settings}';
    return '';
  }});
  await driver.returnFromDeniedSource();
  assert.equal(commands.filter(args=>args.includes('KEYCODE_BACK')).length,1);
  assert.ok(commands.every(args=>!args.includes('start')&&!args.includes('appops')));
  await driver.close();
});

test('Android 16 installer cancellation uses current display focus and the explicit Cancel control', {timeout:40000},async()=>{
  const commands=[];
  const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{
    commands.push(args);
    const command=args.slice(2).join(' ');
    if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';
    if(command==='shell dumpsys window')return 'WINDOW MANAGER DISPLAY CONTENTS\n  mCurrentFocus=Window{123 u0 com.google.android.packageinstaller/.PackageInstallerActivity}';
    if(command==='shell dumpsys window windows')return 'WINDOW MANAGER WINDOWS\n Window #0 Window{123 u0 com.google.android.packageinstaller/.PackageInstallerActivity}';
    if(command.startsWith('shell cat '))return '<hierarchy><node text="INSTALL" enabled="true" resource-id="com.android.packageinstaller:id/ok_button" bounds="[233,584][312,632]"/><node text="CANCEL" enabled="true" resource-id="com.android.packageinstaller:id/cancel_button" bounds="[156,584][233,632]"/></hierarchy>';
    return '';
  }});
  await driver.cancelInstaller();
  assert.deepEqual(commands.filter(args=>args.includes('tap')).map(args=>args.slice(2)),[['shell','input','tap','194','608']]);
  assert.ok(commands.every(args=>!args.includes('start')&&!args.includes('appops')));
  await driver.close();
});

test('Android 16 install-source switch uses its AndroidX resource ID through the real UI driver', {timeout:40000},async()=>{
  const commands=[];
  const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{
    commands.push(args);
    const command=args.slice(2).join(' ');
    if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';
    if(command==='shell dumpsys window')return 'mCurrentFocus=Window{123 u0 com.android.settings/.Settings}';
    if(command.startsWith('shell cat '))return '<hierarchy><node text="Allow from this source" enabled="true" checked="false" resource-id="com.android.settings:id/switchWidget" bounds="[240,100][300,150]"/></hierarchy>';
    return '';
  }});
  await driver.allowSource();
  assert.deepEqual(commands.filter(args=>args.includes('tap')).map(args=>args.slice(2)),[['shell','input','tap','270','125']]);
  assert.equal(commands.filter(args=>args.includes('KEYCODE_BACK')).length,1);
  assert.ok(commands.every(args=>!args.includes('appops')&&!args.includes('start')));
  await driver.close();
});

test('Compose source permission is granted by one labelled UI tap and one Back, never appops', {timeout:40000},async()=>{
  const commands=[];
  const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{
    commands.push(args);
    const command=args.slice(2).join(' ');
    if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';
    if(command==='shell dumpsys window')return 'mCurrentFocus=Window{123 u0 com.android.settings/com.android.settings.spa.SpaActivity}';
    if(command.startsWith('shell cat '))return composePermission;
    return '';
  }});
  await driver.allowSource();
  assert.deepEqual(commands.filter(args=>args.includes('tap')).map(args=>args.slice(2)),[['shell','input','tap','160','410']]);
  assert.equal(commands.filter(args=>args.includes('KEYCODE_BACK')).length,1);
  assert.ok(commands.every(args=>!args.includes('appops')&&!args.includes('start')));
  await driver.close();
});

test('an unknown install-source switch stays a failure and includes foreground and hierarchy evidence', {timeout:40000},async()=>{
  const commands=[];
  const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{
    commands.push(args);
    const command=args.slice(2).join(' ');
    if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';
    if(command==='shell dumpsys window')return 'mCurrentFocus=Window{123 u0 com.android.settings/.Settings}';
    if(command.startsWith('shell cat '))return '<hierarchy><node text="Allow from this source" enabled="true" checked="false" resource-id="com.android.settings:id/unknown_control" bounds="[240,100][300,150]"/></hierarchy>';
    return '';
  }});
  await assert.rejects(()=>driver.allowSource(),error=>error.message.includes('mCurrentFocus=Window')&&error.message.includes('com.android.settings:id/unknown_control'));
  assert.equal(commands.filter(args=>args.includes('tap')||args.includes('KEYCODE_BACK')||args.includes('appops')||args.includes('start')).length,0);
  await driver.close();
});
test('an existing application is refused rather than uninstalled or replaced',async()=>{
  assert.equal(typeof api.createEmulatorDriver,'function');const commands=[];await assert.rejects(()=>api.createEmulatorDriver({env,run:async(_command,args)=>{commands.push(args);return args.includes('emu')?'resqnow-updater-acceptance\nOK':'Packages:\n versionCode=4 minSdk=24';}}),/already installed/);
  assert.equal(commands.length,2);assert.ok(commands.every(args=>args[0]==='-s'&&args[1]===env.ANDROID_SERIAL));assert.ok(commands.every(args=>!args.includes('install')&&!args.includes('uninstall')&&!args.includes('clear')));
});
test('ADB can seed A once but cannot install B or silently reinstall A',async()=>{
  assert.equal(typeof api.createEmulatorDriver,'function');let installed=false;const commands=[];const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{commands.push(args);if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';if(args.includes('install')){installed=true;return 'Success';}return installed?'versionCode=1001 minSdk=24':'';}});
  await assert.rejects(()=>driver.installSeed('/synthetic/1006.apk'),/seed/);await driver.installSeed('/synthetic/1001.apk');await assert.rejects(()=>driver.installSeed('/synthetic/1001.apk'),/seed/);
  assert.equal(commands.filter(args=>args.includes('install')).length,1);assert.ok(commands.every(args=>args[0]==='-s'&&args[1]===env.ANDROID_SERIAL));
});

test('ADB seed-transfer failures preserve bounded process diagnostics without exposing other error fields',async()=>{
  for(const failure of [
    {code:1,signal:null,killed:false,stdout:'Failure [INSTALL_FAILED_INTERNAL_ERROR: synthetic]',stderr:'synthetic adb stderr'},
    {code:null,signal:'SIGTERM',killed:true,stdout:'Performing Streamed Install',stderr:''},
  ]){
    const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{
      if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';
      if(args.includes('install'))throw Object.assign(Error('Seed transfer failed'),failure,{privateEnvironment:'must-not-be-logged'});
      return '';
    }});
    await assert.rejects(()=>driver.installSeed('/synthetic/1001.apk'),error=>error.message.includes(failure.stdout)&&error.message.includes('signal='+ (failure.signal??'none'))&&error.message.includes('terminated='+failure.killed)&&!error.message.includes('must-not-be-logged'));
    await driver.close();
  }
});

test('a system UI tap is never retried after uncertain ADB delivery', {timeout:40000},async()=>{
  let taps=0;
  const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{
    const command=args.slice(2).join(' ');
    if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';
    if(command==='shell dumpsys window')return 'mCurrentFocus=Window{123 u0 com.google.android.packageinstaller/.PackageInstallerActivity}';
    if(command.startsWith('shell cat '))return '<hierarchy><node text="Cancel" enabled="true" resource-id="android:id/button2" bounds="[10,20][110,80]"/></hierarchy>';
    if(args.includes('tap')){taps++;throw Object.assign(Error('UI delivery is uncertain'),{code:1,stderr:'synthetic transport failure'});}
    return '';
  }});
  await assert.rejects(()=>driver.cancelInstaller());
  assert.equal(taps,1);
  await driver.close();
});
test('consent tests must use the explicitly named test APK and keep the real app version unchanged',async()=>{
  let installed=false;const commands=[];const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{commands.push(args);if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';if(args.includes('install')){installed=true;return 'Success';}if(args.includes('instrument'))return 'OK (1 test)';return installed?'versionCode=1001 minSdk=24':'';}});
  assert.equal(typeof driver.runConsentInstrumentation,'function');await driver.installSeed('/synthetic/1001.apk');await assert.rejects(()=>driver.runConsentInstrumentation('/synthetic/1006.apk'),/test APK/);
  await driver.runConsentInstrumentation('/synthetic/legacy-consent-androidTest.apk');assert.equal(await driver.version(),1001);assert.equal(commands.filter(c=>c.includes('install')).length,2);assert.ok(commands.some(c=>c.includes('instrument')&&c.includes('resqnowHostedAcceptanceOnly')));
});

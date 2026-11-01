import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./android-updater-native-flow.mjs').catch(()=>({}));
const env={CI:'true',GITHUB_ACTIONS:'true',ANDROID_SERIAL:'emulator-5554',ANDROID_HOME:'/synthetic-sdk'};
test('host driver performs no command outside an explicitly owned hosted emulator',async()=>{
  assert.equal(typeof api.createEmulatorDriver,'function');let calls=0;await assert.rejects(()=>api.createEmulatorDriver({env:{...env,GITHUB_ACTIONS:'false'},run:async()=>{calls++;}}));assert.equal(calls,0);
  await assert.rejects(()=>api.createEmulatorDriver({env,run:async()=>{calls++;return 'personal-avd\nOK';}}),/owned|hosted/i);assert.equal(calls,1);
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
test('consent tests must use the explicitly named test APK and keep the real app version unchanged',async()=>{
  let installed=false;const commands=[];const driver=await api.createEmulatorDriver({env,run:async(_command,args)=>{commands.push(args);if(args.includes('emu'))return 'resqnow-updater-acceptance\nOK';if(args.includes('install')){installed=true;return 'Success';}if(args.includes('instrument'))return 'OK (1 test)';return installed?'versionCode=1001 minSdk=24':'';}});
  assert.equal(typeof driver.runConsentInstrumentation,'function');await driver.installSeed('/synthetic/1001.apk');await assert.rejects(()=>driver.runConsentInstrumentation('/synthetic/1006.apk'),/test APK/);
  await driver.runConsentInstrumentation('/synthetic/legacy-consent-androidTest.apk');assert.equal(await driver.version(),1001);assert.equal(commands.filter(c=>c.includes('install')).length,2);assert.ok(commands.some(c=>c.includes('instrument')&&c.includes('resqnowHostedAcceptanceOnly')));
});

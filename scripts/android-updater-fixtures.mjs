import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash,randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url';

const OS=new Set(['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','HOME','USERPROFILE','TEMP','TMP','TMPDIR','JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','ANDROID_USER_HOME','GRADLE_USER_HOME','NPM_CONFIG_CACHE','LANG','LC_ALL']);
export function fixtureEnvironment(env){return {...Object.fromEntries(Object.entries(env).filter(([k,v])=>OS.has(k.toUpperCase())&&typeof v==='string')),CI:'true',RESQNOW_UPDATER_ACCEPTANCE_ONLY:'true'};}
export function acceptanceWorker(files){
  if(!files.length||files.some(f=>typeof f!=='string'||!(f==='index.html'||/^assets\/[a-zA-Z0-9_.-]+$/.test(f))))throw Error('Invalid acceptance code asset');
  const paths=files.map(f=>'/'+f);
  return `const files=${JSON.stringify(paths)};const name='workbox-precache-resqnow-acceptance-A';self.addEventListener('install',e=>e.waitUntil(caches.open(name).then(c=>c.addAll(files)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;if(e.request.mode==='navigate')e.respondWith(caches.open(name).then(c=>c.match('/index.html')));else if(files.includes(u.pathname))e.respondWith(caches.open(name).then(c=>c.match(u.pathname)));});`;
}
async function execute(command,args,options){return new Promise((resolve,reject)=>{const child=spawn(command,args,{...options,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',c=>{output+=c;});child.stderr.on('data',c=>{output+=c;});child.once('error',reject);child.once('close',code=>{if(code===0)resolve(output);else reject(Error('Synthetic fixture command failed: '+path.basename(command)+'\n'+output.slice(-6000)));});});}
const google={project_info:{project_number:'100000000000',project_id:'resqnow-e2e',storage_bucket:'resqnow-e2e.appspot.com'},client:[{client_info:{mobilesdk_app_id:'1:100000000000:android:abcdef123456',android_client_info:{package_name:'com.resqnow1.app'}},api_key:[{current_key:'AIzaSySyntheticNativeChecksNotProduction123'}]}],configuration_version:'1'};
export async function buildNativeFixtures({root,env=process.env,run=execute}){
  root=await fs.realpath(root);
  if((await fs.readdir(root)).some(n=>/^\.env(?:\.|$)/i.test(n)&&!/^\.env(?:\..+)?\.example$/i.test(n)))throw Error('Fixture builds refuse private dotenv files; use a secret-free source snapshot');
  const base=fixtureEnvironment(env),sdk=base.ANDROID_HOME??base.ANDROID_SDK_ROOT;if(!base.JAVA_HOME||!sdk)throw Error('Fixtures require JDK21 and Android SDK36');
  const java=path.join(base.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'),keytool=path.join(base.JAVA_HOME,'bin',process.platform==='win32'?'keytool.exe':'keytool');
  const work=path.join(root,'output/quality/updater-native-fixtures',randomUUID());await fs.mkdir(work,{recursive:true});
  const primary=path.join(work,'synthetic-primary.p12'),other=path.join(work,'synthetic-other.p12');const pass=randomUUID();
  const keyed={...base,RESQNOW_ACCEPTANCE_KEY_ALIAS:'resqnow-fixture',RESQNOW_ACCEPTANCE_STORE_PASSWORD:pass,RESQNOW_ACCEPTANCE_KEY_PASSWORD:pass};
  const invoke=(cmd,args,extra={})=>run(cmd,args,{cwd:root,env:{...keyed,...extra}});
  const sign=async(input,output,key)=>invoke(java,['-jar',path.join(sdk,'build-tools/36.0.0/lib/apksigner.jar'),'sign','--ks',key,'--ks-key-alias','resqnow-fixture','--ks-pass','env:RESQNOW_ACCEPTANCE_STORE_PASSWORD','--key-pass','env:RESQNOW_ACCEPTANCE_KEY_PASSWORD','--out',output,input]);
  try{
    for(const key of [primary,other])await invoke(keytool,['-genkeypair','-keystore',key,'-storetype','PKCS12','-alias','resqnow-fixture','-storepass:env','RESQNOW_ACCEPTANCE_STORE_PASSWORD','-keypass:env','RESQNOW_ACCEPTANCE_KEY_PASSWORD','-dname','CN=ResQNow Synthetic Acceptance Only','-keyalg','RSA','-keysize','2048','-validity','30','-noprompt']);
    // Sync only a synthetic shell. Never read owner dotenv or build production provider code.
    const dist=path.join(root,'dist');await fs.mkdir(dist,{recursive:true});await fs.writeFile(path.join(dist,'index.html'),'<!doctype html><title>Synthetic native checks</title>');
    await invoke(process.execPath,['node_modules/@capacitor/cli/bin/capacitor','sync','android']);
    const source=path.join(root,'android/app/src/updaterAcceptance');await fs.mkdir(path.join(source,'assets'),{recursive:true});await fs.writeFile(path.join(source,'google-services.json'),JSON.stringify(google));
    const plugins=JSON.parse(await fs.readFile(path.join(root,'android/app/src/main/assets/capacitor.plugins.json'),'utf8'));
    plugins.push({pkg:'resqnow-fixture-only',classpath:'com.resqnow1.app.updates.UpdaterAcceptancePlugin'});
    await fs.writeFile(path.join(source,'assets/capacitor.plugins.json'),JSON.stringify(plugins));
    await fs.writeFile(path.join(source,'assets/capacitor.config.json'),JSON.stringify({appId:'com.resqnow1.app',appName:'ResQNow acceptance ONLY',webDir:'public',server:{androidScheme:'https',cleartext:true},android:{allowMixedContent:true,webContentsDebuggingEnabled:true},plugins:{SplashScreen:{launchShowDuration:0,launchAutoHide:true}}}));
    async function variant(code,marker,key){
      await invoke(process.execPath,['node_modules/vite/bin/vite.js','build','--config','vite.updater-native.config.ts'],{RESQNOW_ACCEPTANCE_MARKER:marker});
      if(marker==='A'){const assets=(await fs.readdir(path.join(source,'assets/public/assets'))).map(n=>'assets/'+n);await fs.writeFile(path.join(source,'assets/public/sw.js'),acceptanceWorker(['index.html',...assets]));}
      await invoke(java,['-classpath',path.join(root,'android/gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','-p','android',':app:assembleUpdaterAcceptance','-PRESQNOW_UPDATER_ACCEPTANCE=true','-PRESQNOW_APP_UPDATES_ENABLED=true',`-PRESQNOW_ANDROID_VERSION_CODE=${code}`,`-PRESQNOW_ANDROID_VERSION_NAME=ci.${code}`,'--no-daemon'],{RESQNOW_ACCEPTANCE_KEYSTORE_PATH:key});
      const apk=path.join(work,`${code}.apk`);await fs.copyFile(path.join(root,'android/app/build/outputs/apk/updaterAcceptance/app-updaterAcceptance.apk'),apk);return apk;
    }
    const a=await variant(1001,'A',primary),wrongSigner=await variant(1003,'B',other),b=await variant(1006,'B',primary),c=await variant(1007,'C',primary);
    const signature=await invoke(java,['-jar',path.join(sdk,'build-tools/36.0.0/lib/apksigner.jar'),'verify','--verbose','--print-certs',a]);
    const cert=/^Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})\s*$/m.exec(signature)?.[1];if(!cert)throw Error('Synthetic fixture signature unavailable');
    const manifest=path.join(work,'AndroidManifest.xml');await fs.writeFile(manifest,'<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.resqnow.synthetic.wrong" android:versionCode="1004" android:versionName="ci.1004"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/><application android:label="Wrong package fixture"/></manifest>');
    const unsigned=path.join(work,'wrong-unsigned.apk'),wrongPackage=path.join(work,'1004.apk');await invoke(path.join(sdk,'build-tools/36.0.0',process.platform==='win32'?'aapt2.exe':'aapt2'),['link','-o',unsigned,'-I',path.join(sdk,'platforms/android-36/android.jar'),'--manifest',manifest]);await sign(unsigned,wrongPackage,primary);
    const candidates=[];for(const [code,apk] of [[1000,a],[1002,b],[1003,wrongSigner],[1004,wrongPackage],[1005,b],[1006,b],[1007,c]]){
      const bytes=await fs.readFile(apk);candidates.push({apk,manifest:{schemaVersion:1,channel:'stable',applicationId:'com.resqnow1.app',versionCode:code,versionName:'ci.'+code,minSdk:code===1005?37:24,targetSdk:code===1005?37:36,sizeBytes:bytes.length,sha256:code===1002?'0'.repeat(64):createHash('sha256').update(bytes).digest('hex'),signingCertificateSha256:cert,sourceCommit:'c'.repeat(40),publishedAt:new Date().toISOString(),apkUrl:`https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v${code}/resqnow.apk`}});
    }
    const testAssets=path.join(root,'android/app/src/androidTestUpdaterAcceptance/assets');await fs.mkdir(testAssets,{recursive:true});
    await fs.copyFile(b,path.join(testAssets,'legacy-candidate.apk'));await fs.writeFile(path.join(testAssets,'legacy-release.json'),JSON.stringify(candidates.find(c=>c.manifest.versionCode===1006).manifest));
    await invoke(java,['-classpath',path.join(root,'android/gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','-p','android',':app:assembleUpdaterAcceptanceAndroidTest','-PRESQNOW_UPDATER_ACCEPTANCE=true','-PRESQNOW_APP_UPDATES_ENABLED=true','-PRESQNOW_ANDROID_VERSION_CODE=1001','-PRESQNOW_ANDROID_VERSION_NAME=ci.1001','--no-daemon'],{RESQNOW_ACCEPTANCE_KEYSTORE_PATH:primary});
    const legacyTestApk=path.join(work,'legacy-consent-androidTest.apk');await fs.copyFile(path.join(root,'android/app/build/outputs/apk/androidTest/updaterAcceptance/app-updaterAcceptance-androidTest.apk'),legacyTestApk);
    const result={seedApk:a,legacyTestApk,candidates};await fs.writeFile(path.join(work,'fixtures.json'),JSON.stringify(result,null,2));return result;
  }finally{await Promise.all([primary,other].map(file=>fs.rm(file,{force:true})));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildNativeFixtures({root:fileURLToPath(new URL('../',import.meta.url))}).then(result=>console.log('Synthetic fixture APKs built: '+path.dirname(result.seedApk))).catch(error=>{console.error(error.message);process.exitCode=1;});

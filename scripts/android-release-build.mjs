import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {createAndroidTools} from './android-release.mjs';
import {randomUUID} from 'node:crypto';
import {validateMapplsKey,verifyReviewedMapplsKey,verifyMapplsDist,verifyMapplsNativeAssets,verifyMapplsApk} from './mappls-artifacts.mjs';
const SIGNING=['RESQNOW_ANDROID_KEYSTORE_PATH','RESQNOW_ANDROID_KEY_ALIAS','RESQNOW_ANDROID_STORE_PASSWORD','RESQNOW_ANDROID_KEY_PASSWORD'];
const OS_KEYS=new Set(['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','HOME','USERPROFILE','TEMP','TMP','TMPDIR','JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','ANDROID_USER_HOME','GRADLE_USER_HOME','NPM_CONFIG_CACHE','LANG','LC_ALL']);
export async function withSigningFile(env,body){
  if(env.GITHUB_ACTIONS!=='true'||!env.RUNNER_TEMP||typeof env.ANDROID_KEYSTORE_BASE64!=='string'||!env.ANDROID_KEYSTORE_BASE64||!/^[A-Za-z0-9+/]+={0,2}$/.test(env.ANDROID_KEYSTORE_BASE64))throw Error('Signing material requires explicit trusted runner configuration');
  const data=Buffer.from(env.ANDROID_KEYSTORE_BASE64,'base64');if(data.length<1||data.length>1024*1024||data.toString('base64')!==env.ANDROID_KEYSTORE_BASE64)throw Error('Invalid signing material encoding/size');
  const root=await fs.realpath(env.RUNNER_TEMP);const file=path.join(root,`resqnow-signing-${randomUUID()}.keystore`);
  let owned=false;
  try{const handle=await fs.open(file,'wx',0o600);owned=true;try{await handle.writeFile(data);}finally{await handle.close();}data.fill(0);return await body({...env,RESQNOW_ANDROID_KEYSTORE_PATH:file});}
  finally{data.fill(0);if(owned)await fs.rm(file,{force:true});}
}
function execute(command,args,options){return new Promise((resolve,reject)=>{const child=spawn(command,args,{...options,stdio:'inherit',windowsHide:true});child.once('error',()=>reject(Error('Android release build command could not start')));child.once('exit',code=>code===0?resolve():reject(Error('Android release build command failed')));});}
export async function verifyMapplsAndroidConfiguration({root}){
  const app=path.join(root,'android/app');
  const fail=()=>{throw Error('Mappls Android configuration requires one matching, nonempty approved .a.conf/.a.olf pair');};
  let names;try{names=await fs.readdir(app);}catch{fail();}
  const configs=names.filter(name=>name.endsWith('.a.conf')),licenses=names.filter(name=>name.endsWith('.a.olf'));
  if(configs.length!==1||licenses.length!==1)fail();
  const appId=configs[0].slice(0,-'.a.conf'.length);
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(appId)||licenses[0]!==`${appId}.a.olf`)fail();
  for(const name of [configs[0],licenses[0]]){
    let info;try{info=await fs.lstat(path.join(app,name));}catch{fail();}
    if(!info.isFile()||info.size===0)fail();
  }
  // File presence is not provider/license acceptance; never read/log their contents.
  return {appId};
}
export async function prepareAndroidWebAssets({root,publicSettings,env=process.env,run=execute}){
  validateMapplsKey(publicSettings?.VITE_MAPPLS_MAP_SDK_KEY);
  if(publicSettings.VITE_NATIVE_BUILD!=='true')throw Error('Native web assets require VITE_NATIVE_BUILD=true');
  await verifyReviewedMapplsKey({root,key:publicSettings.VITE_MAPPLS_MAP_SDK_KEY});
  const base=Object.fromEntries(Object.entries(env).filter(([key,value])=>OS_KEYS.has(key.toUpperCase())&&typeof value==='string'));
  const settings=Object.fromEntries(Object.entries(publicSettings).filter(([key,value])=>key.startsWith('VITE_')&&typeof value==='string'));
  const publicEnv={...base,...settings,NODE_ENV:'production',CI:'true'};
  await run(process.execPath,['node_modules/vite/bin/vite.js','build'],{cwd:root,env:publicEnv});
  await verifyMapplsDist({dist:path.join(root,'dist'),key:settings.VITE_MAPPLS_MAP_SDK_KEY});
  await run(process.execPath,['node_modules/@capacitor/cli/bin/capacitor','sync','android'],{cwd:root,env:publicEnv});
  await verifyMapplsNativeAssets({root,key:settings.VITE_MAPPLS_MAP_SDK_KEY});
  return publicEnv;
}
export function createAndroidBuildRunner({root,env=process.env,run=execute}){
  return {tools:createAndroidTools({sdk:env.ANDROID_HOME??env.ANDROID_SDK_ROOT,javaHome:env.JAVA_HOME}),
    async build({version,publicSettings,googleServices}){
      for(const key of SIGNING)if(typeof env[key]!=='string'||!env[key])throw Error('Owner signing credentials are not configured');
      await verifyMapplsAndroidConfiguration({root});
      if(!(await fs.stat(env.RESQNOW_ANDROID_KEYSTORE_PATH)).isFile())throw Error('Owner signing file is unavailable');
      const file=path.join(root,'android/app/google-services.json');await fs.mkdir(path.dirname(file),{recursive:true});
      try{if(JSON.stringify(JSON.parse(await fs.readFile(file,'utf8')))!==JSON.stringify(googleServices))throw Error('Existing Android provider configuration differs from approved settings');}
      catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(file,JSON.stringify(googleServices),{flag:'wx'});}
      const publicEnv=await prepareAndroidWebAssets({root,publicSettings,env,run});
      const java=path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java');
      await run(java,['-classpath',path.join(root,'android/gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','-p','android',':app:assembleRelease',`-PRESQNOW_ANDROID_VERSION_CODE=${version.versionCode}`,`-PRESQNOW_ANDROID_VERSION_NAME=${version.versionName}`,'-PRESQNOW_APP_UPDATES_ENABLED=true','--no-daemon'],{cwd:root,env:{...publicEnv,...Object.fromEntries(SIGNING.map(key=>[key,env[key]]))}});
      const apk=path.join(root,'android/app/build/outputs/apk/release/app-release.apk');
      await verifyMapplsApk({root,apk,key:publicSettings.VITE_MAPPLS_MAP_SDK_KEY});
      return apk;
    }};
}
export async function prepareAndroidSdk({root,env=process.env,platform=process.platform,run=execute}){
  if(platform!=='linux')throw Error('SDK package setup is limited to hosted Linux; local Windows uses its installed SDK');
  const sdk=env.ANDROID_HOME||env.ANDROID_SDK_ROOT;
  if(typeof sdk!=='string'||!path.isAbsolute(sdk))throw Error('An absolute installed Android SDK root is required');
  // GitHub's runner image installs this tool here without promising it is on PATH.
  const manager=path.join(sdk,'cmdline-tools/latest/bin/sdkmanager');
  try{if(!(await fs.stat(manager)).isFile())throw Error('not a file');}catch{throw Error('Installed Android command-line tools are unavailable');}
  const safeEnv=Object.fromEntries(Object.entries(env).filter(([key,value])=>OS_KEYS.has(key.toUpperCase())&&typeof value==='string'));
  await run(manager,['platforms;android-36','build-tools;36.0.0'],{cwd:root,env:safeEnv,timeout:600000});
}
export async function prepareAndroidChecks({root,env=process.env}){
  if(env.CI!=='true'||env.ANDROID_CHECKS_ONLY!=='true')throw Error('Synthetic native setup is limited to explicit CI verification');
  // Google's debug source set takes precedence without modifying the tracked production config.
  const file=path.join(root,'android/app/src/debug/google-services.json');await fs.mkdir(path.dirname(file),{recursive:true});
  const value={project_info:{project_number:'100000000000',project_id:'resqnow-e2e',storage_bucket:'resqnow-e2e.appspot.com'},client:[{client_info:{mobilesdk_app_id:'1:100000000000:android:abcdef123456',android_client_info:{package_name:'com.resqnow1.app'}},api_key:[{current_key:'AIzaSySyntheticNativeChecksNotProduction123'}]}],configuration_version:'1'};
  await fs.writeFile(file,JSON.stringify(value),{flag:'wx'});
  const dist=path.join(root,'dist');await fs.mkdir(dist,{recursive:true});await fs.writeFile(path.join(dist,'index.html'),'<!doctype html><html><body>Native compile/instrumentation boundary. Not a production web build.</body></html>',{flag:'wx'});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('../',import.meta.url));
  const task=process.argv[2]==='--prepare-checks'?()=>prepareAndroidChecks({root}):process.argv[2]==='--prepare-sdk'?()=>prepareAndroidSdk({root}):null;
  if(!task){console.error('Only --prepare-checks or --prepare-sdk is supported');process.exitCode=1;}
  else task().catch(error=>{console.error(error.message);process.exitCode=1;});
}

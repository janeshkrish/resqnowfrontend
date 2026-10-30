import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {createAndroidTools} from './android-release.mjs';
import {randomUUID} from 'node:crypto';
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
export function createAndroidBuildRunner({root,env=process.env,run=execute}){
  const base=Object.fromEntries(Object.entries(env).filter(([key,value])=>OS_KEYS.has(key.toUpperCase())&&typeof value==='string'));
  return {tools:createAndroidTools({sdk:env.ANDROID_HOME??env.ANDROID_SDK_ROOT,javaHome:env.JAVA_HOME}),
    async build({version,publicSettings,googleServices}){
      for(const key of SIGNING)if(typeof env[key]!=='string'||!env[key])throw Error('Owner signing credentials are not configured');
      if(!(await fs.stat(env.RESQNOW_ANDROID_KEYSTORE_PATH)).isFile())throw Error('Owner signing file is unavailable');
      const file=path.join(root,'android/app/google-services.json');await fs.mkdir(path.dirname(file),{recursive:true});
      try{if(JSON.stringify(JSON.parse(await fs.readFile(file,'utf8')))!==JSON.stringify(googleServices))throw Error('Existing Android provider configuration differs from approved settings');}
      catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(file,JSON.stringify(googleServices),{flag:'wx'});}
      const publicEnv={...base,...publicSettings,NODE_ENV:'production',CI:'true'};
      await run(process.execPath,['node_modules/vite/bin/vite.js','build'],{cwd:root,env:publicEnv});
      await run(process.execPath,['node_modules/@capacitor/cli/bin/capacitor','sync','android'],{cwd:root,env:publicEnv});
      const java=path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java');
      await run(java,['-classpath',path.join(root,'android/gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','-p','android',':app:assembleRelease',`-PRESQNOW_ANDROID_VERSION_CODE=${version.versionCode}`,`-PRESQNOW_ANDROID_VERSION_NAME=${version.versionName}`,'-PRESQNOW_APP_UPDATES_ENABLED=true','--no-daemon'],{cwd:root,env:{...publicEnv,...Object.fromEntries(SIGNING.map(key=>[key,env[key]]))}});
      return path.join(root,'android/app/build/outputs/apk/release/app-release.apk');
    }};
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
  if(process.argv[2]!=='--prepare-checks'){console.error('Only --prepare-checks is supported');process.exitCode=1;}
  else prepareAndroidChecks({root:fileURLToPath(new URL('../',import.meta.url))}).catch(()=>{console.error('Synthetic native setup refused or could not finish');process.exitCode=1;});
}

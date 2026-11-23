import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createVerificationEnvironment} from './check-release-quality.mjs';

const producers=['assembleRelease','bundleRelease','packageRelease','signReleaseBundle','packageReleaseBundle'];
function execute(command,args,options){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{...options,stdio:['ignore','pipe','pipe'],windowsHide:true});
    let output='';
    const collect=chunk=>{output+=chunk;if(output.length>1024*1024)child.kill();};
    child.stdout.on('data',collect);child.stderr.on('data',collect);
    child.once('error',()=>reject(Error('Release guard Java process could not start')));
    child.once('close',code=>resolve({code,output}));
  });
}
/** Negative task-graph checks only: never execute a release/signing task. */
export async function verifyAndroidReleaseGuards({root,env=process.env,run=execute}){
  if(env.CI!=='true'||env.ANDROID_CHECKS_ONLY!=='true')throw Error('Release guard checks require explicit synthetic verification');
  root=await fs.realpath(root);
  if((await fs.readdir(root)).some(name=>/^\.env(?:\.|$)/i.test(name)&&!/^\.env(?:\..+)?\.example$/i.test(name)))throw Error('Release guard checks refuse private dotenv configuration');
  if((await fs.readdir(path.join(root,'android/app'))).some(name=>/\.a\.(?:conf|olf)$/.test(name)))throw Error('Release guard checks refuse provider configuration files');
  if(typeof env.JAVA_HOME!=='string'||!path.isAbsolute(env.JAVA_HOME))throw Error('An explicit installed JDK is required');
  const safe=createVerificationEnvironment(env);
  for(const key of ['JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','GRADLE_USER_HOME','ANDROID_USER_HOME','ANDROID_SDK_HOME'])if(typeof env[key]==='string')safe[key]=env[key];
  const directory=path.join(root,'output/quality');await fs.mkdir(directory,{recursive:true});
  const key=path.join(directory,`negative-release-graph-${randomUUID()}.fixture`);
  await fs.writeFile(key,'Not a keystore. Used only with --dry-run to verify rejection before release execution.',{flag:'wx',mode:0o600});
  try{
    const childEnv={...safe,VITE_NATIVE_BUILD:'true',VITE_APP_UPDATES_ENABLED:'true',RESQNOW_ANDROID_KEYSTORE_PATH:key,RESQNOW_ANDROID_KEY_ALIAS:'synthetic-alias',RESQNOW_ANDROID_STORE_PASSWORD:'synthetic-only',RESQNOW_ANDROID_KEY_PASSWORD:'synthetic-only'};
    for(const task of producers){
      const args=['-classpath',path.join(root,'android/gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','-p','android',`:app:${task}`,'-PRESQNOW_ANDROID_VERSION_CODE=112','-PRESQNOW_ANDROID_VERSION_NAME=1.4.112','-PRESQNOW_APP_UPDATES_ENABLED=true','--dry-run','--offline','--no-daemon'];
      const result=await run(path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'),args,{cwd:root,env:childEnv});
      if(result?.code!==1||typeof result.output!=='string'||!result.output.includes('Release requires approved matching Mappls Android configuration/license files'))throw Error(`Release guard not verified for ${task} (exit ${String(result?.code)})`);
    }
    return {checked:producers.length,apkBuilt:false,signing:false,install:false};
  }finally{await fs.rm(key,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyAndroidReleaseGuards({root:fileURLToPath(new URL('../',import.meta.url))}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}

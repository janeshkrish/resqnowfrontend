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
/** Task-graph checks only: even the valid disabled-mode case uses --dry-run. */
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
    const cases=producers.map(task=>({task,code:1,message:'Release requires approved matching Mappls Android configuration/license files'}));
    cases.push(...producers.map(task=>({task,mode:'false',patch:{VITE_NATIVE_MAPPLS_ENABLED:'true'},code:1,message:'Release requires matching web/native Mappls mode'})));
    cases.push(
      {task:'assembleRelease',mode:'FALSE',code:1,message:'RESQNOW_MAPPLS_ENABLED must be true or false'},
      {task:'assembleRelease',mode:'false',patch:{VITE_NATIVE_MAPPLS_ENABLED:'false',VITE_APP_UPDATES_ENABLED:'false'},code:1,message:'Release requires checked version overrides and enabled packaged/native updater build flags'},
      {task:'assembleRelease',mode:'false',patch:{VITE_NATIVE_MAPPLS_ENABLED:'false'},withoutSigning:true,code:1,message:'Release requires the existing owner signing key through environment-only configuration'},
      {task:'assembleRelease',mode:'false',patch:{VITE_NATIVE_MAPPLS_ENABLED:'false'},code:0,message:'BUILD SUCCESSFUL'},
    );
    for(const check of cases){
      const args=['-classpath',path.join(root,'android/gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','-p','android',`:app:${check.task}`,'-PRESQNOW_ANDROID_VERSION_CODE=112','-PRESQNOW_ANDROID_VERSION_NAME=1.4.112','-PRESQNOW_APP_UPDATES_ENABLED=true',...(check.mode===undefined?[]:[`-PRESQNOW_MAPPLS_ENABLED=${check.mode}`]),'--dry-run','--offline','--no-daemon'];
      const scoped={...childEnv,...check.patch};
      if(check.withoutSigning)for(const name of ['RESQNOW_ANDROID_KEYSTORE_PATH','RESQNOW_ANDROID_KEY_ALIAS','RESQNOW_ANDROID_STORE_PASSWORD','RESQNOW_ANDROID_KEY_PASSWORD'])delete scoped[name];
      const result=await run(path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'),args,{cwd:root,env:scoped});
      if(result?.code!==check.code||typeof result.output!=='string'||!result.output.includes(check.message))throw Error(`Release guard not verified for ${check.task}/${check.mode??'default'} (exit ${String(result?.code)})`);
    }
    return {checked:cases.length,apkBuilt:false,signing:false,install:false};
  }finally{await fs.rm(key,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyAndroidReleaseGuards({root:fileURLToPath(new URL('../',import.meta.url))}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}

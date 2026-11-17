import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {prepareAndroidWebAssets} from './android-release-build.mjs';

export function nativePublicSettings({root,load=loadEnv}){
  const settings=load('production',root,'VITE_');
  return {...Object.fromEntries(Object.entries(settings).filter(([key,value])=>key.startsWith('VITE_')&&typeof value==='string')),VITE_NATIVE_BUILD:'true'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('../',import.meta.url));
  prepareAndroidWebAssets({root,publicSettings:nativePublicSettings({root})})
    .then(()=>console.log('Native web assets built, Mappls-verified and synced. No APK signing, installation or publication performed.'))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}

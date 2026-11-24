import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {unzipSync} from 'fflate';
const NAME='resqnow-build-mode.json';
const fail=()=>{throw Error('Native build mode artifact is missing, stale or inconsistent');};
/** @returns {import('vite').Plugin} */
export function createNativeBuildModePlugin(env){
  const flag=(name,fallback)=>{const value=env[name]??fallback;if(!['true','false'].includes(value))throw Error('Invalid native build mode: '+name.toLowerCase());return value==='true';};
  const mode={schemaVersion:1,nativeBuild:flag('VITE_NATIVE_BUILD','false'),updatesEnabled:flag('VITE_APP_UPDATES_ENABLED','false'),mapplsEnabled:flag('VITE_NATIVE_MAPPLS_ENABLED','true')};
  return {name:'resqnow-native-build-mode',apply:'build',generateBundle(){this.emitFile({type:'asset',fileName:NAME,source:JSON.stringify(mode)+'\n'});}};
}
async function read(file){try{const s=await fs.lstat(file);if(!s.isFile()||s.size<1||s.size>4096)fail();return await fs.readFile(file);}catch{fail();}}
export async function verifyNativeBuildMode({root,mapplsEnabled,apk}){
  if(typeof mapplsEnabled!=='boolean')fail();
  const expected={schemaVersion:1,nativeBuild:true,updatesEnabled:true,mapplsEnabled};
  const bytes=await read(path.join(root,'dist',NAME));
  let mode;try{mode=JSON.parse(bytes);}catch{fail();}
  if(!mode||Object.keys(mode).length!==4||Object.keys(expected).some(key=>mode[key]!==expected[key]))fail();
  if(!(await read(path.join(root,'android/app/src/main/assets/public',NAME))).equals(bytes))fail();
  if(apk){
    let archive,found=0;
    try{const s=await fs.lstat(apk);if(!s.isFile()||s.size<1||s.size>200*1024*1024)fail();archive=unzipSync(await fs.readFile(apk),{filter:({name,originalSize})=>{
      if(name!=='assets/public/'+NAME)return false;if(++found!==1||originalSize<1||originalSize>4096)fail();return true;
    }});}catch{fail();}
    if(!archive['assets/public/'+NAME]||!Buffer.from(archive['assets/public/'+NAME]).equals(bytes))fail();
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const mode=process.argv[2];
  if(process.argv.length!==3||!['true','false'].includes(mode)){console.error('Choose an explicit native Mappls build mode');process.exitCode=1;}
  else verifyNativeBuildMode({root:fileURLToPath(new URL('../',import.meta.url)),mapplsEnabled:mode==='true'}).then(()=>console.log('Packaged native/updater/map mode verified.')).catch(error=>{console.error(error.message);process.exitCode=1;});
}

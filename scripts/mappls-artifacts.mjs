import fs from 'node:fs/promises';
import path from 'node:path';
import {parseAst} from 'rollup/parseAst';
import {unzipSync} from 'fflate';

const MAX_FILE=12*1024*1024,MAX_TOTAL=64*1024*1024,MAX_FILES=2048;
const fail=message=>{throw Error('Mappls assets: '+message);};
export function validateMapplsKey(key){
  if(typeof key!=='string'||!key||key!==key.trim()||key.length>2048||/[\u0000-\u0020\u007f]/.test(key))fail('a configured public SDK key is required');
}
function safeName(name){
  if(typeof name!=='string'||!name||name.includes('\\')||/[\u0000-\u001f]/.test(name)||path.posix.isAbsolute(name)||path.posix.normalize(name)!==name||name.startsWith('../'))fail('invalid build asset path');
  return name;
}
async function readInside(root,name,limit=MAX_FILE){
  safeName(name);
  const base=await fs.realpath(root),file=await fs.realpath(path.join(base,name));
  const relative=path.relative(base,file);
  if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))fail('asset path is outside its build root');
  const stat=await fs.stat(file);
  if(!stat.isFile()||stat.size<1||stat.size>limit)fail('invalid build asset size');
  const bytes=await fs.readFile(file);if(bytes.length!==stat.size)fail('build asset changed during inspection');
  return bytes;
}
function compiledKeys(code,key){
  let ast;try{ast=parseAst(code);}catch{fail('compiled SDK code could not be inspected');}
  let count=0;const pending=[ast];
  while(pending.length){
    const node=pending.pop();
    if(node.type==='ObjectExpression')for(const property of node.properties){
      if(property.type!=='Property'||property.computed||(property.key.name??property.key.value)!=='readKey')continue;
      count++;
      let body=property.value.type==='ArrowFunctionExpression'?property.value.body:null;
      if(body?.type==='BlockStatement')body=body.body.length===1&&body.body[0].type==='ReturnStatement'?body.body[0].argument:null;
      if(body?.type!=='Literal'||typeof body.value!=='string'||body.value!==key)fail('compiled SDK key does not match the approved build setting');
    }
    for(const value of Object.values(node)){
      if(Array.isArray(value)){
        for(const child of value)if(child&&typeof child.type==='string')pending.push(child);
      }else if(value&&typeof value==='object'&&typeof value.type==='string')pending.push(value);
    }
  }
  return count;
}

/** Check the app entry graph that will execute, never arbitrary/orphan output. */
export async function verifyMapplsDist({dist,key}){
  validateMapplsKey(key);
  let manifest;try{manifest=JSON.parse(await readInside(dist,'.vite/manifest.json',2*1024*1024));}catch{fail('missing or invalid Vite build manifest');}
  const entry=manifest?.['index.html'];
  const html=(await readInside(dist,'index.html',2*1024*1024)).toString('utf8');
  const scripts=[...html.matchAll(/<script\b([^>]*)>/gi)].map(match=>match[1]).filter(attrs=>/\btype\s*=\s*(["'])module\1/i.test(attrs)).map(attrs=>/\bsrc\s*=\s*(["'])([^"']+)\1/i.exec(attrs)?.[2]);
  if(!entry?.isEntry||scripts.length!==1||scripts[0]!=='/'+entry.file)fail('index entry does not match the Vite manifest');
  const pending=['index.html'],visited=new Set(),files=new Set(['index.html']);
  let total=Buffer.byteLength(html),readers=0;
  while(pending.length){
    const id=pending.pop();if(visited.has(id))continue;
    if(visited.size>=MAX_FILES||!Object.hasOwn(manifest,id))fail('invalid or oversized app entry graph');
    visited.add(id);const chunk=manifest[id];
    const bytes=await readInside(dist,safeName(chunk.file));total+=bytes.length;files.add(chunk.file);
    const code=bytes.toString('utf8');
    if(code.includes('VITE_MAPPLS_MAP_SDK_KEY'))readers+=compiledKeys(code,key);
    for(const css of chunk.css??[]){const name=safeName(css);total+=(await readInside(dist,name)).length;files.add(name);}
    if(total>MAX_TOTAL)fail('app entry graph exceeds the inspection limit');
    for(const ids of [chunk.imports??[],chunk.dynamicImports??[]]){
      if(!Array.isArray(ids)||ids.some(item=>typeof item!=='string'))fail('invalid app entry graph');
      pending.push(...ids);
    }
  }
  if(!readers)fail('compiled Mappls SDK key readers are missing from the app entry graph');
  return files;
}
function verifyOrigin(bytes){
  let config;try{config=JSON.parse(bytes.toString('utf8'));}catch{fail('invalid native origin configuration');}
  if(config?.appId!=='com.resqnow1.app'||config.server?.androidScheme!=='https'||!['localhost',undefined].includes(config.server?.hostname)||config.server?.url)fail('native origin must remain https://localhost without a remote server URL');
}
export async function verifyMapplsNativeAssets({root,key}){
  const dist=path.join(root,'dist'),assets=path.join(root,'android/app/src/main/assets');
  const files=await verifyMapplsDist({dist,key});
  verifyOrigin(await readInside(assets,'capacitor.config.json',65536));
  for(const name of files){
    const expected=await readInside(dist,name),actual=await readInside(path.join(assets,'public'),name);
    if(!actual.equals(expected))fail('synced Android files are stale or changed; rebuild and sync the web assets');
  }
}
export async function verifyMapplsApk({root,apk,key}){
  const dist=path.join(root,'dist'),files=await verifyMapplsDist({dist,key}),expected=new Map();
  for(const name of files)expected.set('assets/public/'+name,await readInside(dist,name));
  const stat=await fs.stat(apk);if(!stat.isFile()||stat.size<1||stat.size>200*1024*1024)fail('invalid APK size');
  const names=new Set();let archive;
  try{archive=unzipSync(await fs.readFile(apk),{filter:({name,originalSize})=>{
    if(name!=='assets/capacitor.config.json'&&!expected.has(name))return false;
    if(names.has(name)||originalSize<1||originalSize>(name==='assets/capacitor.config.json'?65536:expected.get(name).length))fail('invalid or duplicate APK asset');
    names.add(name);return true;
  }});}catch{fail('APK contains invalid, oversized or changed assets');}
  if(!archive['assets/capacitor.config.json'])fail('APK is missing native origin configuration');
  verifyOrigin(Buffer.from(archive['assets/capacitor.config.json']));
  for(const [name,bytes] of expected)if(!archive[name]||!bytes.equals(archive[name]))fail('APK has missing, stale or changed web files; rebuild and sync before signing');
}

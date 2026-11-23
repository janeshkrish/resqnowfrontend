import fs from 'node:fs/promises';
import path from 'node:path';
import {parseAst} from 'rollup/parseAst';
import {unzipSync} from 'fflate';
import {createHash} from 'node:crypto';

const MAX_FILE=12*1024*1024,MAX_TOTAL=64*1024*1024,MAX_FILES=2048;
const fail=message=>{throw Error('Mappls assets: '+message);};
export function validateMapplsKey(key){
  if(typeof key!=='string'||!key||key!==key.trim()||key.length>2048||/[\u0000-\u0020\u007f]/.test(key))fail('a configured public SDK key is required');
}
/** This reviewed fingerprint is independent of mutable local/CI environment values. */
export async function verifyReviewedMapplsKey({root,key}){
  validateMapplsKey(key);
  let reviewed;
  try{reviewed=JSON.parse(await readInside(root,'config/mappls-public-key.json',8192));}catch{fail('reviewed public-key fingerprint is missing or invalid');}
  if(reviewed?.schemaVersion!==1||!/^([a-f0-9]{64})$/.test(reviewed.sha256??'')||createHash('sha256').update(key).digest('hex')!==reviewed.sha256)fail('configured SDK key does not match the reviewed public-key fingerprint');
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
function inspectCode(code,key){
  let ast;try{ast=parseAst(code);}catch{fail('compiled SDK code could not be inspected');}
  let count=0;const imports=new Set(),pending=[ast];
  while(pending.length){
    const node=pending.pop();
    if(node.type==='ImportDeclaration'||node.type==='ExportAllDeclaration'||node.type==='ExportNamedDeclaration'&&node.source||node.type==='ImportExpression'){
      if(node.source?.type!=='Literal'||typeof node.source.value!=='string')fail('emitted imports cannot be verified against the build manifest');
      imports.add(node.source.value);
    }
    if(node.type==='ObjectExpression')for(const property of node.properties){
      if(property.type!=='Property')continue;
      const name=property.computed?(property.key.type==='Literal'?property.key.value:undefined):(property.key.name??property.key.value);
      if(name!=='readKey')continue;
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
  return {readers:count,imports};
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
    const inspected=inspectCode(bytes.toString('utf8'),key);readers+=inspected.readers;
    for(const css of chunk.css??[]){const name=safeName(css);total+=(await readInside(dist,name)).length;files.add(name);}
    if(total>MAX_TOTAL)fail('app entry graph exceeds the inspection limit');
    const declared=new Set(),next=[];
    for(const ids of [chunk.imports??[],chunk.dynamicImports??[]]){
      if(!Array.isArray(ids)||ids.some(item=>typeof item!=='string'))fail('invalid app entry graph');
      for(const dependency of ids){
        if(!Object.hasOwn(manifest,dependency))fail('invalid app entry graph');
        declared.add(safeName(manifest[dependency].file));next.push(dependency);
      }
    }
    const actual=new Set();
    for(const specifier of inspected.imports){
      if(/^https?:\/\//.test(specifier))continue;
      if(!specifier.startsWith('.')&&!specifier.startsWith('/'))fail('emitted imports disagree with the build manifest');
      const resolved=new URL(specifier,'https://apk.invalid/'+chunk.file);
      if(resolved.origin!=='https://apk.invalid')fail('emitted imports disagree with the build manifest');
      actual.add(safeName(decodeURIComponent(resolved.pathname.slice(1))));
    }
    if(actual.size!==declared.size||[...actual].some(file=>!declared.has(file)))fail('emitted imports disagree with the build manifest');
    pending.push(...next);
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

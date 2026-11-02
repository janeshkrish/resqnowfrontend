import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';

export function requireHostedEmulator({ci,github,serial,avd}){
  if(ci!==true||github!==true||!/^emulator-[0-9]+$/.test(serial??'')||avd!=='resqnow-updater-acceptance')throw Error('Acceptance requires the explicitly owned GitHub-hosted emulator; physical/local devices are refused');
}
export function androidControl(xml,{text,resourceId}){
  const decode=s=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  for(const match of xml.matchAll(/<node\b([^>]*)>/g)){
    const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
    if(attrs.enabled!=='true'||text!==undefined&&attrs.text!==text||resourceId!==undefined&&attrs['resource-id']!==resourceId)continue;
    const bounds=/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attrs.bounds??'');if(!bounds)continue;const [x1,y1,x2,y2]=bounds.slice(1).map(Number);
    if(x2>x1&&y2>y1&&x2<=20000&&y2<=20000)return {x:Math.floor((x1+x2)/2),y:Math.floor((y1+y2)/2)};
  }
  throw Error('The expected enabled Android confirmation control was not found');
}
export async function startFixtureService({candidates,port=5198}){
  if(!Array.isArray(candidates)||!candidates.length)throw Error('Acceptance candidates required');const assets=new Map();
  for(const c of candidates){if(!Number.isInteger(c.manifest?.versionCode)||!Buffer.isBuffer(c.bytes)||assets.has(c.manifest.versionCode)||c.bytes.length!==c.manifest.sizeBytes)throw Error('Invalid or reused fixture asset');assets.set(c.manifest.versionCode,c);}
  let current=candidates[0].manifest.versionCode;const pauses=new Map(),waiters=new Map(),interrupts=new Set(),sockets=new Set(),requests=[];let work={customer:false,technician:false};
  const server=http.createServer(async(req,res)=>{
    req.on('error',()=>{});res.on('error',()=>{});res.setHeader('Access-Control-Allow-Origin','https://localhost');res.setHeader('Access-Control-Allow-Headers','content-type');res.setHeader('Cache-Control','no-store');
    const url=new URL(req.url,'http://127.0.0.1');requests.push({path:url.pathname,range:req.headers.range??null,authorization:Boolean(req.headers.authorization),cookie:Boolean(req.headers.cookie)});if(requests.length>2048)requests.shift();
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');res.setHeader('Access-Control-Allow-Private-Network','true');res.writeHead(204);res.end();return;}
    if(url.pathname==='/api/public/android-app/update'){json({state:'ready',release:assets.get(current).manifest});return;}
    if(url.pathname==='/api/service-requests'){json(work.customer?[{id:'synthetic-active',status:'pending'}]:[]);return;}
    if(/^\/api\/technician\/active-job\//.test(url.pathname)){json(work.technician?{id:'synthetic-job',status:'accepted'}:null);return;}
    const match=/^\/assets\/([0-9]+)\.apk$/.exec(url.pathname);const candidate=match&&assets.get(Number(match[1]));if(!candidate){json({error:'not_found'},404);return;}
    const code=candidate.manifest.versionCode,body=candidate.bytes;let start=0;
    if(req.headers.range){const range=/^bytes=(\d+)-$/.exec(req.headers.range);if(!range||Number(range[1])>=body.length){res.writeHead(416,{'Content-Range':`bytes */${body.length}`});res.end();return;}start=Number(range[1]);}
    res.writeHead(req.headers.range?206:200,{'Content-Type':'application/vnd.android.package-archive','Accept-Ranges':'bytes','Content-Length':body.length-start,...(req.headers.range?{'Content-Range':`bytes ${start}-${body.length-1}/${body.length}`}:{})});res.flushHeaders();
    if(req.method==='HEAD'){res.end();return;}
    try{for(let offset=start;offset<body.length&&!res.destroyed;){
      if(pauses.has(code)&&offset>=pauses.get(code))await new Promise(resolve=>{const finish=()=>{res.off('close',finish);waiters.get(code)?.delete(finish);resolve();};if(!waiters.has(code))waiters.set(code,new Set());waiters.get(code).add(finish);res.once('close',finish);});
      if(res.destroyed)break;const end=Math.min(offset+65536,body.length);const accepted=res.write(body.subarray(offset,end));offset=end;
      if(interrupts.has(code)&&offset-start>=131072){interrupts.delete(code);setTimeout(()=>res.destroy(),100);return;}
      if(!accepted)await new Promise(resolve=>{const finish=()=>{res.off('drain',finish);res.off('close',finish);resolve();};res.once('drain',finish);res.once('close',finish);});
    }if(!res.destroyed)res.end();}catch{res.destroy();}
  });
  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const address=server.address();return {url:`http://127.0.0.1:${address.port}`,requests,
    select(code){if(!assets.has(code))throw Error('Unknown fixture');current=code;},
    setWork(value){work={customer:Boolean(value.customer),technician:Boolean(value.technician)};},
    pause(code,at=65536){pauses.set(code,at);},
    resume(code){pauses.delete(code);for(const finish of [...(waiters.get(code)??[])])finish();},
    interruptOnce(code){interrupts.add(code);},
    async close(){for(const socket of sockets)socket.destroy();for(const pending of waiters.values())for(const finish of [...pending])finish();await new Promise(resolve=>server.close(resolve));},
  };
}
async function main(){
  requireHostedEmulator({ci:process.env.CI==='true',github:process.env.GITHUB_ACTIONS==='true',serial:process.env.ANDROID_SERIAL,avd:'resqnow-updater-acceptance'});
  if(process.argv.length>3||process.argv[2]!==undefined&&process.argv[2]!=='--legacy-consent')throw Error('Unknown acceptance mode');
  const root=fileURLToPath(new URL('../',import.meta.url));const {buildNativeFixtures}=await import('./android-updater-fixtures.mjs');const {runNativeUpgrade,runLegacyConsent}=await import('./android-updater-native-flow.mjs');
  const legacy=process.argv[2]==='--legacy-consent';await (legacy?runLegacyConsent:runNativeUpgrade)({fixtures:await buildNativeFixtures({root}),reportFile:path.join(root,legacy?'output/quality/native-legacy-consent.json':'output/quality/native-upgrade-acceptance.json')});
  console.log(legacy?'Real legacy/per-source permission denial, return and installer cancellation passed':'Native A-to-B Android confirmation, data retention and download recovery passed');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});

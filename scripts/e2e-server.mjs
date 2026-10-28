import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {createVerificationEnvironment} from './check-release-quality.mjs';

// Own the Vite server directly. Playwright's shell-process teardown relies on
// Windows taskkill, which can leave this sandbox waiting indefinitely.
export async function startE2eServer({root,port,host='localhost',configFile}){
  const privateEnv=(await fs.readdir(root)).find(name=>/^\.env(?:\.|$)/i.test(name)&&!/^\.env(?:\..+)?\.example$/i.test(name));
  if(privateEnv)throw Error('E2E server: non-example env file present: '+privateEnv);
  const settings=Object.fromEntries(Object.entries(createVerificationEnvironment(process.env)).filter(([key])=>key.startsWith('VITE_')||key==='CI'||key==='NODE_ENV'));
  const keys=new Set([...Object.keys(process.env).filter(key=>key.startsWith('VITE_')),...Object.keys(settings)]);
  const previous=new Map([...keys].map(key=>[key,process.env[key]]));
  const restore=()=>{for(const [key,value] of previous){if(value===undefined)delete process.env[key];else process.env[key]=value;}};
  for(const key of keys)delete process.env[key];
  Object.assign(process.env,settings);
  let server;
  try{
    server=await createServer({root,configFile,logLevel:'error',server:{host,port,strictPort:true,open:false}});
    await server.listen();
    const address=server.httpServer?.address();
    if(!address||typeof address==='string')throw Error('E2E server did not bind its owned port');
    let closing;
    return {
      url:'http://'+host+':'+address.port,
      close:()=>closing??=(async()=>{try{await server.close();}finally{restore();}})(),
    };
  }catch(error){
    try{await server?.close();}finally{restore();}
    throw error;
  }
}

export default async function setup(config){
  const baseURLs=new Set(config.projects.map(project=>project.use.baseURL));
  if(baseURLs.size!==1||!baseURLs.values().next().value)throw Error('E2E projects must share one owned loopback server');
  const url=new URL([...baseURLs][0]);
  if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||!url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash){
    throw Error('E2E server requires an explicit loopback HTTP port');
  }
  const root=fileURLToPath(new URL('../',import.meta.url));
  const server=await startE2eServer({root,host:url.hostname,port:Number(url.port)});
  return ()=>server.close();
}

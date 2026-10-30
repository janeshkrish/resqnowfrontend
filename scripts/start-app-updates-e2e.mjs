import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';import {createServer} from 'vite';
import {fork} from 'node:child_process';
async function startServers(){
  const root=fileURLToPath(new URL('../',import.meta.url));const backend=process.env.APP_UPDATES_BACKEND_DIR||path.resolve(root,'../resqnowbackend');
  const require=createRequire(path.join(backend,'package.json'));const express=require('express');
  const {createAndroidUpdatesRouter}=await import(pathToFileURL(path.join(backend,'routes/androidUpdates.js')));
  const {parseAndroidRelease}=await import(pathToFileURL(path.join(backend,'services/androidReleaseManifest.js')));
  const fixture=JSON.parse(await fs.readFile(path.join(root,'src/test/fixtures/android-release.json'),'utf8'));
  const release=parseAndroidRelease(fixture,{repository:'janeshkrish/resqnowfrontend',tag:'android-v12'});
  let unavailable=false;let requests=[];
  const app=express();app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5195');next();});
  app.post('/__test/reset',(_req,res)=>{unavailable=false;requests=[];res.json({ok:true});});
  app.post('/__test/unavailable',(_req,res)=>{unavailable=true;res.json({ok:true});});
  app.get('/__test/requests',(_req,res)=>res.json(requests));
  app.get('/api/service-requests',(_req,res)=>res.json([]));app.get('/api/technician/active-job/:id',(_req,res)=>res.json(null));
  app.use('/api/public',(req,_res,next)=>{requests.push({authorization:Boolean(req.headers.authorization),cookie:Boolean(req.headers.cookie)});next();},createAndroidUpdatesRouter({service:{getRelease:async()=>unavailable?{state:'unavailable'}:{state:'ready',release}}}));
  const http=await new Promise((resolve,reject)=>{const s=app.listen(5196,'127.0.0.1',()=>resolve(s));s.on('error',reject);});let vite;
  try{vite=await createServer({root,configFile:path.join(root,'vite.updates.config.ts'),logLevel:'error'});await vite.listen();}
  catch(error){await new Promise(resolve=>http.close(resolve));throw error;}
  return async()=>{await vite.close();await new Promise(resolve=>{http.closeAllConnections();http.close(resolve);});};
}
export default async function setup(){
  // Keep Vite/SWC outside Playwright's module-transform hooks on Windows.
  const child=fork(fileURLToPath(import.meta.url),['--server-child'],{execArgv:[],stdio:['ignore','inherit','inherit','ipc']});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(Error('Updater test server startup timed out'));},30000);
    child.once('message',message=>{clearTimeout(timer);message==='ready'?resolve():reject(Error('Updater test server startup failed'));});
    child.once('exit',code=>{clearTimeout(timer);reject(Error('Updater test server exited: '+code));});
  });
  return async()=>{if(child.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.send('stop');});};
}
if(process.argv.includes('--server-child')){
  const close=await startServers();process.send?.('ready');let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;await close();process.exit(0);};
  process.on('message',message=>{if(message==='stop')void stop();});process.on('disconnect',()=>void stop());process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
}

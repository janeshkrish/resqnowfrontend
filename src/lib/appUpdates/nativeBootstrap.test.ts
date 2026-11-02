// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
const path='android/app/src/main/res/raw/native_update_bootstrap.js';
function browser(origin='https://localhost'){
  const values=new Map<string,string>();
  const reload=vi.fn();const unregister=vi.fn(async()=>true);const remove=vi.fn(async(_name:string)=>true);
  const context={window:{} as Record<string,any>,location:{origin,hostname:new URL(origin).hostname,protocol:new URL(origin).protocol,reload},
    navigator:{serviceWorker:{controller:{},getRegistrations:async()=>[{active:{scriptURL:`${origin}/sw.js`},unregister},{active:{scriptURL:`${origin}/firebase-messaging-sw.js`},unregister:()=>{throw new Error('Messaging registration must remain');}}]}},
    sessionStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}},
    caches:{keys:async()=>['workbox-precache-v2-https://localhost/','resqnow-static-cache','resqnow-pages-cache','resqnow-api-cache','resqnow-image-cache','other-user-cache'],delete:remove},URL,
    get localStorage(){throw new Error('Do not touch user storage');},get indexedDB(){throw new Error('Do not touch identities');}};
  return {context,reload,unregister,remove};
}
async function run(context:object){return vm.runInNewContext(fs.readFileSync(path,'utf8').replace(/__NATIVE_VERSION__/g,'15'),context);}
it('removes only packaged code caches and reloads once without touching API/user data',async()=>{
  const {context,reload,unregister,remove}=browser();await run(context);
  expect(unregister).toHaveBeenCalledTimes(1);expect(remove.mock.calls.map(c=>c[0])).toEqual(['workbox-precache-v2-https://localhost/','resqnow-static-cache','resqnow-pages-cache']);expect(reload).toHaveBeenCalledTimes(1);
  context.window={};await run(context);expect(reload).toHaveBeenCalledTimes(1);expect(context.window.__resqnowNativeCode.phase).toBe('done');
});
it('cannot clean an OAuth/external origin',async()=>{
  const {context,remove,reload}=browser('https://accounts.google.com');await run(context);expect(remove).not.toHaveBeenCalled();expect(reload).not.toHaveBeenCalled();
});
it('does not acknowledge a failed cache cleanup',async()=>{
  const {context,reload}=browser();context.caches.keys=async()=>{throw new Error('storage unavailable');};await run(context);expect(context.window.__resqnowNativeCode.phase).toBe('failed');expect(reload).not.toHaveBeenCalled();
});

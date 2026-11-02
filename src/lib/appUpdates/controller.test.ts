import { expect, it, vi } from 'vitest';
import fixture from '@/test/fixtures/android-release.json';
import { UpdateController } from './controller';
import type { AppUpdater, UpdateSnapshot } from './types';

function setup(snapshot:Partial<UpdateSnapshot>={}) {
  let state:UpdateSnapshot={phase:'idle',enabled:true,installedVersionCode:4,installedVersionName:'1.3',sdkVersion:36,bytesDownloaded:0,...snapshot};
  let now=100000; let safe=true;
  const bridge:AppUpdater={
    getState:vi.fn(async()=>state),
    scheduleDownload:vi.fn(async options=>{state={...state,phase:'queued',release:options.release};return state;}),
    cancelDownload:vi.fn(async()=>{state={...state,phase:'cancelled'};return state;}),
    requestInstall:vi.fn(async()=>{state={...state,phase:'installing'};return state;}),
    cancelInstallPreparation:vi.fn(async()=>{}),openInstallPermissionSettings:vi.fn(async()=>{}),
    addListener:vi.fn(async()=>({remove:async()=>{}})),
  };
  const offer=vi.fn(async()=>({state:'ready' as const,release:fixture}));
  const c=new UpdateController({bridge,offer,now:()=>now,isSafe:()=>safe,confirmSafe:async()=>safe,changed:()=>{}});
  return {c,bridge,offer,setNow:(v:number)=>{now=v;},setSafe:(v:boolean)=>{safe=v;},setState:(s:UpdateSnapshot)=>{state=s;}};
}
it('automatically queues only unmetered and reconciles before repeat checks',async()=>{
  const {c,bridge,offer}=setup();await Promise.all([c.check(),c.check()]);
  expect(bridge.scheduleDownload).toHaveBeenCalledTimes(1);expect(bridge.scheduleDownload).toHaveBeenCalledWith({release:fixture,allowMetered:false});
  await c.check(); expect(offer).toHaveBeenCalledTimes(1);expect(bridge.requestInstall).not.toHaveBeenCalled();
});
it.each(['cancelled','failed','ready','permission-required','downloading','verifying'] as const)('does not auto-restart a same-version %s update',async phase=>{
  const {c,bridge}=setup({phase,release:fixture});await c.check();expect(bridge.scheduleDownload).not.toHaveBeenCalled();
  await c.download(true);expect(bridge.scheduleDownload).toHaveBeenCalledWith({release:fixture,allowMetered:true});
});
it('never downgrades an existing candidate or enables a disabled native build',async()=>{
  const a=setup({phase:'ready',release:{...fixture,versionCode:15}});await a.c.check();expect(a.bridge.scheduleDownload).not.toHaveBeenCalled();
  const b=setup({enabled:false});await b.c.check();expect(b.offer).not.toHaveBeenCalled();
});
it('refreshes after 6 hours, handles clock rollback and backs off errors',async()=>{
  const {c,offer,setNow}=setup();await c.check();setNow(100000+21600001);await c.check();expect(offer).toHaveBeenCalledTimes(2);
  setNow(1);await c.check();expect(offer).toHaveBeenCalledTimes(3);
  offer.mockRejectedValue(new Error('offline'));await c.check(true);await c.check(true);expect(offer).toHaveBeenCalledTimes(4);setNow(30002);await c.check();expect(offer).toHaveBeenCalledTimes(5);
});
it('requires fresh safe-screen consent and never installs after permission settings',async()=>{
  const {c,bridge,setSafe}=setup({phase:'ready',release:fixture});await c.check();setSafe(false);await c.install();expect(bridge.requestInstall).not.toHaveBeenCalled();
  setSafe(true);await c.openPermissionSettings();expect(bridge.requestInstall).not.toHaveBeenCalled();await c.install();expect(bridge.requestInstall).toHaveBeenCalledTimes(1);
});
it('revokes pending preparation on navigation and ignores late asynchronous checks after dispose',async()=>{
  const {c,bridge,offer}=setup();let resolve!:(v:{state:'ready';release:typeof fixture})=>void;
  offer.mockImplementation(()=>new Promise(r=>{resolve=r;}));const checking=c.check();await vi.waitFor(()=>expect(offer).toHaveBeenCalled());c.dispose();resolve({state:'ready',release:fixture});await checking;
  expect(bridge.scheduleDownload).not.toHaveBeenCalled();expect(bridge.cancelInstallPreparation).toHaveBeenCalled();
});

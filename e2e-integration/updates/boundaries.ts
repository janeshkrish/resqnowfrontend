import fixture from '../../src/test/fixtures/android-release.json';
import type { AppUpdater, UpdateSnapshot } from '../../src/lib/appUpdates/types';
const params=new URLSearchParams(location.search);const technician=params.get('role')==='technician';
const initial=params.get('phase');
const listeners=new Set<(snapshot:UpdateSnapshot)=>void>();const opened=new Set<()=>void>();
const state:UpdateSnapshot={phase:initial==='permission-required'||initial==='ready'?initial:'idle',enabled:true,installedVersionCode:4,installedVersionName:'1.3',sdkVersion:36,bytesDownloaded:initial?16:0,...(initial?{release:fixture}:{})};
window.__updateTest={calls:[],quiet:[],state,emit:()=>listeners.forEach(f=>f({...state})),openAlert:()=>opened.forEach(f=>f())};
const result=()=>({...state});
const bridge:AppUpdater={getState:async()=>result(),scheduleDownload:async({release,allowMetered})=>{window.__updateTest.calls.push(`schedule:${allowMetered}`);Object.assign(state,{phase:'queued',release});return result();},
  requestInstall:async()=>{window.__updateTest.calls.push('install');state.phase='installing';return result();},
  cancelDownload:async()=>{state.phase='cancelled';return result();},cancelInstallPreparation:async()=>{},
  openInstallPermissionSettings:async()=>{window.__updateTest.calls.push('settings');},setAlertsQuiet:async({quiet})=>{window.__updateTest.quiet.push(quiet);},
  addListener:async(event:string,listener:(snapshot:UpdateSnapshot)=>void)=>{
    if(event==='updateAlertOpened'){const open=listener as unknown as ()=>void;opened.add(open);return {remove:async()=>{opened.delete(open);}};}
    listeners.add(listener);return {remove:async()=>{listeners.delete(listener);}};}} as AppUpdater;
export const getAppUpdater=()=>bridge;
export const useAuth=()=>({user:technician?null:{id:'customer-test'}});
export const useTechnicianAuth=()=>({technician:technician?{id:'technician-test'}:null,isOnline:false});
export const useTechnicianJob=()=>({acceptedJobId:null,pendingAcceptanceId:null});
export const API_BASE_URL='http://127.0.0.1:5196';
export const apiFetch=(path:string)=>fetch(API_BASE_URL+path);
export const App={addListener:async()=>({remove:async()=>{}})};
export const role=technician?'technician':'customer';
export const home=params.get('home')==='1';

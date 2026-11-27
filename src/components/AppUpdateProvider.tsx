import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from '@/contexts/AuthContext';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { useTechnicianJob } from '@/contexts/TechnicianJobContext';
import { API_BASE_URL, apiFetch } from '@/lib/api';
import { getAppUpdater } from '@/lib/appUpdates/native';
import { fetchUpdateOffer } from '@/lib/appUpdates/client';
import { UpdateController, type UpdateView } from '@/lib/appUpdates/controller';
import { canInstallHere, hasUnfinishedWork } from '@/lib/appUpdates/policy';
import { takeUpToDate, expectUpdate } from '@/lib/appUpdates/upToDate';

type Context=UpdateView&{safe:boolean;busy:boolean;check:()=>void;download:(allowMetered?:boolean)=>void;cancel:()=>void;install:()=>void;openPermissionSettings:()=>void};
const Updates=createContext<Context|null>(null);
export const useAppUpdates=()=>useContext(Updates);
function hasDialog(){return Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],iframe.razorpay-checkout-frame')).some(element=>!element.hasAttribute('hidden')&&element.getAttribute('aria-hidden')!=='true'&&element.getAttribute('data-state')!=='closed'&&getComputedStyle(element).display!=='none');}

export function AppUpdateProvider({children}:{children:ReactNode}){
  const {user}=useAuth();const {technician,isOnline}=useTechnicianAuth();const jobs=useTechnicianJob();const {pathname}=useLocation();const navigate=useNavigate();
  const [view,setView]=useState<UpdateView>({snapshot:null,offer:null,checking:false,message:''});
  const [safe,setSafe]=useState(false);const [requestOpen,setRequestOpen]=useState(false);const [upToDate,setUpToDate]=useState<string|null>(null);
  const controller=useRef<UpdateController|null>(null);const foreground=useRef(true);
  const current=useRef({user,technician,isOnline,jobs,pathname});current.current={user,technician,isOnline,jobs,pathname};
  const settings=pathname.startsWith('/technician')?'/technician/profile?tab=appearance':'/settings';
  const settingsRef=useRef(settings);settingsRef.current=settings;
  const safety=()=>{const c=current.current;return canInstallHere({path:c.pathname,authenticated:Boolean(c.user||c.technician),visible:foreground.current&&document.visibilityState==='visible',dialog:hasDialog(),technicianBusy:Boolean(c.jobs.acceptedJobId||c.jobs.pendingAcceptanceId||c.isOnline)});};
  const technicianBusy=Boolean(jobs.acceptedJobId||jobs.pendingAcceptanceId||isOnline);
  const busy=technicianBusy||requestOpen;

  useEffect(()=>{
    const bridge=getAppUpdater();if(!bridge)return;
    const c=new UpdateController({bridge,offer:()=>fetchUpdateOffer(API_BASE_URL),now:Date.now,isSafe:safety,changed:setView,
      confirmSafe:async()=>{
        const auth=current.current;const timeout=new AbortController();const timer=setTimeout(()=>timeout.abort(),8000);
        try{
          if(auth.user){const r=await apiFetch('/api/service-requests',{signal:timeout.signal});if(!r.ok||hasUnfinishedWork(await r.json()))return false;}
          if(auth.technician){const r=await apiFetch(`/api/technician/active-job/${encodeURIComponent(String(auth.technician.id))}`,{technician:true,signal:timeout.signal});if(!r.ok||await r.json()!==null)return false;}
          return auth.user?.id===current.current.user?.id&&auth.technician?.id===current.current.technician?.id&&safety();
        }catch{return false;}finally{clearTimeout(timer);}
      }});
    controller.current=c;
    const events=bridge.addListener('updateStateChange',c.receive).catch(()=>null);
    // Tapping the phone notification opens App updates.
    const opened=bridge.addListener('updateAlertOpened',()=>{navigate(settingsRef.current+'#app-updates');}).catch(()=>null);
    const activity=CapacitorApp.addListener('appStateChange',({isActive})=>{foreground.current=isActive;if(!isActive)c.invalidateSafety();else void c.check();setSafe(safety());}).catch(()=>null);
    const visibility=()=>{if(document.visibilityState!=='visible')c.invalidateSafety();else void c.check();setSafe(safety());};
    document.addEventListener('visibilitychange',visibility);
    let lastSafe=safety();
    const observer=new MutationObserver(()=>{const next=safety();if(lastSafe!==next){lastSafe=next;setSafe(next);if(!next)c.invalidateSafety();}});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-hidden','data-state','hidden']});
    setSafe(safety());void c.check();const timer=setInterval(()=>{if(foreground.current&&document.visibilityState==='visible')void c.check();},30000);
    return ()=>{c.dispose();if(controller.current===c)controller.current=null;clearInterval(timer);observer.disconnect();document.removeEventListener('visibilitychange',visibility);void events.then(e=>e?.remove());void opened.then(e=>e?.remove());void activity.then(e=>e?.remove());};
  },[]);
  useEffect(()=>{controller.current?.invalidateSafety();setSafe(safety());},[pathname,user?.id,technician?.id,isOnline,jobs.acceptedJobId,jobs.pendingAcceptanceId]);

  // Whether the customer has a request still open: the banner and the phone notification wait for it.
  useEffect(()=>{
    if(!getAppUpdater()||!user){setRequestOpen(false);return;}
    let live=true;const timeout=new AbortController();
    apiFetch('/api/service-requests',{signal:timeout.signal}).then(async r=>{const open=!r.ok||hasUnfinishedWork(await r.json());if(live)setRequestOpen(open);}).catch(()=>{if(live)setRequestOpen(true);});
    return ()=>{live=false;timeout.abort();};
  },[pathname,user]);
  useEffect(()=>{const bridge=getAppUpdater();void bridge?.setAlertsQuiet?.({quiet:busy}).catch(()=>{});},[busy]);

  // After an update: once, "You're up to date".
  const installed=view.snapshot?.enabled?view.snapshot.installedVersionCode:null;const installedName=view.snapshot?.installedVersionName;
  useEffect(()=>{if(installed!=null){const name=takeUpToDate(installed,installedName);if(name)setUpToDate(name);}},[installed,installedName]);
  useEffect(()=>{if(!upToDate)return;const t=setTimeout(()=>setUpToDate(null),8000);return ()=>clearTimeout(t);},[upToDate]);

  const value:Context={...view,safe,busy,check:()=>{void controller.current?.check(true);},download:(allowMetered=false)=>{void controller.current?.download(allowMetered);},cancel:()=>{void controller.current?.cancel();},
    install:()=>{const r=view.snapshot?.release;if(r)expectUpdate(r.versionCode);void controller.current?.install();},openPermissionSettings:()=>{void controller.current?.openPermissionSettings();}};
  // Customers see the banner on Home (AppUpdateBanner); technicians get this note on their screens.
  const showTechnicianNote=pathname.startsWith('/technician')&&view.snapshot?.enabled&&['ready','permission-required'].includes(view.snapshot.phase)&&safe&&!['/technician/profile','/technician/settings'].includes(pathname);
  return <Updates.Provider value={value}>{children}
    {showTechnicianNote?<aside aria-label="App update available" className="fixed bottom-24 right-4 z-30 max-w-sm rounded-xl border bg-background p-3 shadow-lg"><span className="text-sm">A verified app update is ready. </span><Link className="text-sm font-semibold underline" to={settings+'#app-updates'}>Review update</Link></aside>:null}
    {upToDate?<div className="rq-upd-toast" role="status"><span className="rq-upd-toast-tick" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="rq-upd-toast-text"><b>You're up to date · {upToDate}</b><span>Your account and settings are just as you left them.</span></span><button type="button" onClick={()=>setUpToDate(null)}>OK</button></div>:null}
  </Updates.Provider>;
}

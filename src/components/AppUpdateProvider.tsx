import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from '@/contexts/AuthContext';
import { useTechnicianAuth } from '@/contexts/TechnicianAuthContext';
import { useTechnicianJob } from '@/contexts/TechnicianJobContext';
import { API_BASE_URL, apiFetch } from '@/lib/api';
import { getAppUpdater } from '@/lib/appUpdates/native';
import { fetchUpdateOffer } from '@/lib/appUpdates/client';
import { UpdateController, type UpdateView } from '@/lib/appUpdates/controller';
import { canInstallHere, hasUnfinishedWork } from '@/lib/appUpdates/policy';

type Context=UpdateView&{safe:boolean;check:()=>void;download:(allowMetered?:boolean)=>void;cancel:()=>void;install:()=>void;openPermissionSettings:()=>void};
const Updates=createContext<Context|null>(null);
export const useAppUpdates=()=>useContext(Updates);
function hasDialog(){return Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],iframe.razorpay-checkout-frame')).some(element=>!element.hasAttribute('hidden')&&element.getAttribute('aria-hidden')!=='true'&&element.getAttribute('data-state')!=='closed'&&getComputedStyle(element).display!=='none');}

export function AppUpdateProvider({children}:{children:ReactNode}){
  const {user}=useAuth();const {technician,isOnline}=useTechnicianAuth();const jobs=useTechnicianJob();const {pathname}=useLocation();
  const [view,setView]=useState<UpdateView>({snapshot:null,offer:null,checking:false,message:''});
  const [safe,setSafe]=useState(false);const controller=useRef<UpdateController|null>(null);const foreground=useRef(true);
  const current=useRef({user,technician,isOnline,jobs,pathname});current.current={user,technician,isOnline,jobs,pathname};
  const safety=()=>{const c=current.current;return canInstallHere({path:c.pathname,authenticated:Boolean(c.user||c.technician),visible:foreground.current&&document.visibilityState==='visible',dialog:hasDialog(),technicianBusy:Boolean(c.jobs.acceptedJobId||c.jobs.pendingAcceptanceId||c.isOnline)});};

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
    const activity=CapacitorApp.addListener('appStateChange',({isActive})=>{foreground.current=isActive;if(!isActive)c.invalidateSafety();else void c.check();setSafe(safety());}).catch(()=>null);
    const visibility=()=>{if(document.visibilityState!=='visible')c.invalidateSafety();else void c.check();setSafe(safety());};
    document.addEventListener('visibilitychange',visibility);
    let lastSafe=safety();
    const observer=new MutationObserver(()=>{const next=safety();if(lastSafe!==next){lastSafe=next;setSafe(next);if(!next)c.invalidateSafety();}});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-hidden','data-state','hidden']});
    setSafe(safety());void c.check();const timer=setInterval(()=>{if(foreground.current&&document.visibilityState==='visible')void c.check();},30000);
    return ()=>{c.dispose();if(controller.current===c)controller.current=null;clearInterval(timer);observer.disconnect();document.removeEventListener('visibilitychange',visibility);void events.then(e=>e?.remove());void activity.then(e=>e?.remove());};
  },[]);
  useEffect(()=>{controller.current?.invalidateSafety();setSafe(safety());},[pathname,user?.id,technician?.id,isOnline,jobs.acceptedJobId,jobs.pendingAcceptanceId]);
  const value:Context={...view,safe,check:()=>{void controller.current?.check(true);},download:(allowMetered=false)=>{void controller.current?.download(allowMetered);},cancel:()=>{void controller.current?.cancel();},install:()=>{void controller.current?.install();},openPermissionSettings:()=>{void controller.current?.openPermissionSettings();}};
  const settings=pathname.startsWith('/technician')?'/technician/profile?tab=appearance':'/settings';
  const showBanner=view.snapshot?.enabled&&['ready','permission-required'].includes(view.snapshot.phase)&&safe&&!['/settings','/profile','/technician/profile','/technician/settings'].includes(pathname);
  return <Updates.Provider value={value}>{children}{showBanner?<aside aria-label="App update available" className="fixed bottom-24 right-4 z-30 max-w-sm rounded-xl border bg-background p-3 shadow-lg"><span className="text-sm">A verified app update is ready. </span><Link className="text-sm font-semibold underline" to={settings}>Review update</Link></aside>:null}</Updates.Provider>;
}

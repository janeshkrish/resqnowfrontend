import {useEffect,useMemo} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {useTechnicianAuth} from '@/contexts/TechnicianAuthContext';
import {apiUrl,getUserToken,getTechnicianToken} from '@/lib/api';
import {createAppAnalyticsClient} from '@/lib/appAnalytics/client';
import {ANALYTICS_CONSENT_EVENT,getNativeInstallation} from '@/lib/appAnalytics/native';
export function AppAnalyticsBridge({enabled=import.meta.env.VITE_APP_ANALYTICS_ENABLED==='true'}:{enabled?:boolean}){
 const customer=useAuth(),technician=useTechnicianAuth();
 const client=useMemo(()=>createAppAnalyticsClient({native:getNativeInstallation(),enabled,isOnline:()=>navigator.onLine,isVisible:()=>document.visibilityState!=='hidden',transport:(path,body,token,signal)=>fetch(apiUrl('/api/app-analytics'+path),{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal,credentials:'omit',cache:'no-store'})}),[enabled]);
 useEffect(()=>{client.setAccounts({customer:customer.isAuthenticated&&customer.user?{id:String(customer.user.id),getToken:getUserToken}:null,technician:technician.isAuthenticated&&technician.technician?{id:String(technician.technician.id),getToken:getTechnicianToken}:null});},[client,customer.isAuthenticated,customer.user?.id,technician.isAuthenticated,technician.technician?.id]);
 useEffect(()=>{
  client.start();const resume=()=>client.resume();window.addEventListener('online',resume);window.addEventListener(ANALYTICS_CONSENT_EVENT,resume);document.addEventListener('visibilitychange',resume);
  return ()=>{client.stop();window.removeEventListener('online',resume);window.removeEventListener(ANALYTICS_CONSENT_EVENT,resume);document.removeEventListener('visibilitychange',resume);};
 },[client]);
 return null;
}

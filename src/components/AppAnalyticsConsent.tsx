import {useEffect,useState} from 'react';
import {ANALYTICS_CONSENT_EVENT,ANALYTICS_POLICY_VERSION,getNativeInstallation} from '@/lib/appAnalytics/native';
import type {NativeIdentity} from '@/lib/appAnalytics/types';
export function AppAnalyticsConsent({mode='settings',enabled=import.meta.env.VITE_APP_ANALYTICS_ENABLED==='true'}:{mode?:'prompt'|'settings';enabled?:boolean}){
 const [identity,setIdentity]=useState<NativeIdentity|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;const native=getNativeInstallation();const load=()=>void native?.getIdentity().then(id=>{if(active)setIdentity(id);}).catch(()=>{if(active)setError('App analytics is unavailable. App services still work.');});load();window.addEventListener(ANALYTICS_CONSENT_EVENT,load);return()=>{active=false;window.removeEventListener(ANALYTICS_CONSENT_EVENT,load);};},[]);
 const native=getNativeInstallation();
 if(!native||(!enabled&&!identity?.everConsented))return null;
 if(mode==='prompt'&&(!identity||identity.consentDecided))return null;
 async function choose(granted:boolean){
  if(!native||busy)return;setBusy(true);setError('');
  try{setIdentity(await native.setConsent({granted,policyVersion:ANALYTICS_POLICY_VERSION}));window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));}catch{setError('Could not save your preference. Please try again.');}finally{setBusy(false);}
 }
 return <section aria-label="App analytics preference" className={mode==='prompt'?'fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-lg rounded-2xl border bg-background p-4 shadow-lg':'my-4 rounded-xl border bg-background p-4'}>
  <h2 className="font-semibold">{mode==='prompt'?'Help improve ResQNow':'App analytics'}</h2>
  <p className="mt-2 text-sm text-muted-foreground">Optional app-install, version and activity reports help us improve ResQNow. If signed in, reports link to your account. No microphone audio or location is collected by analytics. Your choice does not affect app services.</p>
  <details className="my-2 text-xs text-muted-foreground"><summary>Privacy and retention</summary><p>Turning this off removes account links and activity/version details after your device reconnects. Anonymous totals and a minimal pseudonymous deduplication record remain to prevent recounting and respect your preference.</p></details>
  {error&&<p role="alert">{error}</p>}
  <div className="mt-3 flex flex-wrap gap-3">
   {mode==='prompt'?<><button type="button" disabled={busy} onClick={()=>void choose(true)} className="rounded-lg bg-red-600 px-4 py-2 text-white">Allow app analytics</button><button type="button" disabled={busy} onClick={()=>void choose(false)} className="rounded-lg border px-4 py-2">Not now</button></>:<button type="button" disabled={busy||!identity} onClick={()=>void choose(!identity?.consentGranted)} className="rounded-lg border px-4 py-2">{identity?.consentGranted?'Turn off app analytics':'Turn on app analytics'}</button>}
  </div>
 </section>;
}

import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import MaterialSymbol from '@/components/home/MaterialSymbol';
import { useAppUpdates } from './AppUpdateProvider';

const Wifi=()=> <svg className="rq-upd-wifi" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 9.2a14 14 0 0 1 19 0M5.8 12.6a9.2 9.2 0 0 1 12.4 0M9.1 16a4.4 4.4 0 0 1 5.8 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><circle cx="12" cy="19.2" r="1.6" fill="currentColor"/></svg>;

function Card({tone='plain',label,icon,title,text,children}:{tone?:'plain'|'hot'|'warn'|'ok';label:string;icon:ReactNode;title:string;text?:ReactNode;children?:ReactNode}){
  return <><span className="rq-upd-label">{label}</span>
    <div className={`rq-upd-card is-${tone}`}>
      <div className="rq-upd-row"><span className="rq-upd-icon" aria-hidden="true">{icon}</span><span className="rq-upd-copy"><b>{title}</b>{text?<span>{text}</span>:null}</span></div>
      {children}
    </div></>;
}

/** Account › App updates: what is happening with the next version, in plain words, and one clear action. */
export function AppUpdatePanel(){
  const u=useAppUpdates();const {hash}=useLocation();const section=useRef<HTMLElement>(null);
  const shown=Boolean(u?.snapshot?.enabled);
  useEffect(()=>{if(shown&&hash==='#app-updates')section.current?.scrollIntoView({block:'start'});},[hash,shown]);
  const s=u?.snapshot;if(!u||!s?.enabled)return null;
  const staged=s.release&&['queued','downloading','verifying','ready','permission-required','installing'].includes(s.phase)?s.release:null;
  const release=staged??(s.release&&(!u.offer||s.release.versionCode>=u.offer.versionCode)?s.release:u.offer);
  const newer=staged&&u.offer&&u.offer.versionCode>staged.versionCode?u.offer:null;
  const percent=release&&release.sizeBytes>0?Math.min(100,Math.round(s.bytesDownloaded/release.sizeBytes*100)):0;
  const blocked=!u.safe||u.busy;
  const v=release?.versionName;

  let state:ReactNode=null;
  if(release&&s.phase==='ready'&&blocked){
    state=<Card tone="warn" label="Not now" icon={<MaterialSymbol name="schedule" />} title="Finish your request first"
      text="Updating waits while a request, a job or a payment is open, and while you are online as a technician. We'll remind you when it's done.">
      <button type="button" className="rq-upd-btn is-fill" disabled>Update now</button>
    </Card>;
  }else if(release&&s.phase==='ready'){
    state=<Card tone="hot" label="Ready" icon={<MaterialSymbol name="download" />} title={`Version ${v} is ready`} text="Tap Update now. Android asks you to confirm, and your account and settings stay.">
      <button type="button" className="rq-upd-btn is-fill" onClick={u.install}>Update now</button>
    </Card>;
  }else if(release&&s.phase==='permission-required'){
    state=<Card tone="hot" label="One more step" icon={<MaterialSymbol name="verified_user" />} title="Allow updates from ResQNow" text="Android asks once. Then come back and tap Try update again.">
      <div className="rq-upd-actions"><button type="button" className="rq-upd-btn is-fill" disabled={blocked} onClick={u.openPermissionSettings}>Allow app updates</button><button type="button" className="rq-upd-btn is-tonal" disabled={blocked} onClick={u.install}>Try update again</button></div>
    </Card>;
  }else if(release&&s.phase==='installing'){
    state=<Card label="Updating" icon={<MaterialSymbol name="hourglass_top" />} title={`Version ${v} is waiting for Android`} text="Confirm in the box Android shows." />;
  }else if(release&&(s.phase==='downloading'||s.phase==='verifying')){
    state=<><span className="rq-upd-label">{s.phase==='verifying'?'Checking':'Downloading'}</span>
      <div className="rq-upd-card">
        <div className="rq-upd-row is-spread"><b className="rq-upd-inline"><MaterialSymbol name="download" />{s.phase==='verifying'?`Checking version ${v}`:`Version ${v} is downloading`}</b><span className="rq-upd-percent">{percent}%</span></div>
        <progress className="rq-upd-progress" aria-label="Update download progress" max={release.sizeBytes} value={s.bytesDownloaded}/>
        <div className="rq-upd-row is-spread"><span className="rq-upd-note">You can keep using the app.</span><button type="button" className="rq-upd-btn is-plain" onClick={u.cancel}>Stop download</button></div>
      </div></>;
  }else if(release&&s.phase==='queued'){
    state=<Card label="Waiting for Wi-Fi" icon={<Wifi />} title={`Version ${v} will download on Wi-Fi`} text="So it doesn't use your mobile data.">
      <div className="rq-upd-actions"><button type="button" className="rq-upd-btn is-tonal" onClick={()=>u.download(true)}>Use mobile data now</button><button type="button" className="rq-upd-btn is-plain" onClick={u.cancel}>Stop download</button></div>
    </Card>;
  }else if(release&&s.phase==='failed'){
    state=<Card tone="warn" label="Didn't finish" icon={<MaterialSymbol name="error" />} title="The update couldn't finish" text="Try again on a steady connection with some free space.">
      <div className="rq-upd-actions"><button type="button" className="rq-upd-btn is-fill" onClick={()=>u.download(false)}>Retry download</button><button type="button" className="rq-upd-btn is-tonal" onClick={()=>u.download(true)}>Use mobile data now</button></div>
    </Card>;
  }else if(release&&release.versionCode>s.installedVersionCode){
    state=<Card label="Available" icon={<MaterialSymbol name="download" />} title={`Version ${v} is available`} text="It downloads on Wi-Fi and asks before installing.">
      <div className="rq-upd-actions"><button type="button" className="rq-upd-btn is-fill" onClick={()=>u.download(false)}>Download on Wi-Fi</button><button type="button" className="rq-upd-btn is-tonal" onClick={()=>u.download(true)}>Use mobile data now</button></div>
    </Card>;
  }else{
    state=<Card tone="ok" label="Up to date" icon={<MaterialSymbol name="check_circle" />} title="You have the latest version" />;
  }

  return <section ref={section} id="app-updates" aria-label="App updates" className="rq-upd">
    <div className="rq-upd-head"><h2>App updates</h2><span>You have version {s.installedVersionName??s.installedVersionCode} · your account and settings stay</span></div>
    {state}
    {newer?<p className="rq-upd-note">Version {newer.versionName} is also out. It downloads after this one is installed.</p>:null}
    {u.message?<p role="status" className="rq-upd-note is-warn">{u.message}</p>:null}
    <button type="button" className="rq-upd-btn is-outline" disabled={u.checking} onClick={u.check}>{u.checking?'Checking…':'Check for updates'}</button>
  </section>;
}

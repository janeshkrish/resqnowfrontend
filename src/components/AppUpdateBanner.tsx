import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MaterialSymbol from '@/components/home/MaterialSymbol';
import { useAppUpdates } from './AppUpdateProvider';

const LATER_KEY='resqnow_update_later';
const DAY=24*60*60*1000;

/** "Later" hides the banner for this version for a day; the update stays in Account › App updates. */
export function laterActive(versionCode:number,now=Date.now()):boolean{
  try{const saved=JSON.parse(localStorage.getItem(LATER_KEY)??'null');return saved?.versionCode===versionCode&&typeof saved.at==='number'&&now-saved.at>=0&&now-saved.at<DAY;}catch{return false;}
}
function rememberLater(versionCode:number){try{localStorage.setItem(LATER_KEY,JSON.stringify({versionCode,at:Date.now()}));}catch{/* private mode: hidden for this visit */}}

/** Home: a glass card under the header once a verified update is ready to install. */
export function AppUpdateBanner(){
  const u=useAppUpdates();const navigate=useNavigate();const [hidden,setHidden]=useState<number|null>(null);
  const s=u?.snapshot;const release=s?.release;
  if(!u||!s?.enabled||!release||!['ready','permission-required'].includes(s.phase)||!u.safe||u.busy)return null;
  if(hidden===release.versionCode||laterActive(release.versionCode))return null;
  const update=()=>{if(s.phase==='ready')u.install();else navigate('/settings#app-updates');};
  return <div className="rq-upd-banner" role="status" aria-label="App update">
    <span className="rq-upd-banner-icon" aria-hidden="true"><MaterialSymbol name="download" /></span>
    <span className="rq-upd-banner-text"><b>New version ready</b><span>{release.versionName} · ready to install</span></span>
    <button type="button" className="rq-upd-banner-go" onClick={update}>Update</button>
    <button type="button" className="rq-upd-banner-later" aria-label="Later. Hide this until tomorrow" onClick={()=>{rememberLater(release.versionCode);setHidden(release.versionCode);}}><MaterialSymbol name="close" /></button>
  </div>;
}

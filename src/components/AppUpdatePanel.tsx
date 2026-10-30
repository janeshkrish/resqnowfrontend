import { Button } from '@/components/ui/button';
import { useAppUpdates } from './AppUpdateProvider';
export function AppUpdatePanel(){
  const u=useAppUpdates();const s=u?.snapshot;if(!u||!s?.enabled)return null;
  const release=s.release&&(!u.offer||s.release.versionCode>=u.offer.versionCode)?s.release:u.offer;
  const waiting=['queued','downloading','verifying','installing'].includes(s.phase);
  return <section aria-label="App updates" className="my-4 rounded-xl border bg-background p-4 text-foreground">
    <h2 className="font-semibold">App updates</h2><p className="my-2 text-sm">Installed version {s.installedVersionName??s.installedVersionCode}. Updates keep your account and settings.</p>
    {release?<p className="text-sm">Version {release.versionName} {s.phase==='ready'?'is ready to install.':s.phase==='queued'?'will download on Wi-Fi.':s.phase==='downloading'?'is downloading.':s.phase==='verifying'?'is being verified.':s.phase==='installing'?'is awaiting Android confirmation.':'is available.'}</p>:<p className="text-sm">Check for the latest Android release.</p>}
    {['downloading','verifying'].includes(s.phase)&&release?<progress className="my-2 w-full" aria-label="Update download progress" max={release.sizeBytes} value={s.bytesDownloaded}/>:null}
    {u.message?<p role="status" className="my-2 text-sm">{u.message}</p>:null}
    {s.phase==='failed'?<p role="status" className="my-2 text-sm">The update could not finish. Retry when you have a stable connection and free storage.</p>:null}
    {!u.safe&&['ready','permission-required'].includes(s.phase)?<p className="my-2 text-sm">Finish your request or job, close any dialog, and go offline as a technician before updating.</p>:null}
    <div className="mt-3 flex flex-wrap gap-2">
      <Button variant="outline" disabled={u.checking} onClick={u.check}>{u.checking?'Checking…':'Check for updates'}</Button>
      {s.phase==='ready'?<Button disabled={!u.safe} onClick={u.install}>Update now</Button>:null}
      {s.phase==='permission-required'?<><Button disabled={!u.safe} onClick={u.openPermissionSettings}>Allow app updates</Button><Button variant="outline" disabled={!u.safe} onClick={u.install}>Try update again</Button></>:null}
      {release&&['idle','cancelled','failed'].includes(s.phase)?<Button onClick={()=>u.download(false)}>{s.phase==='failed'?'Retry download':'Download on Wi-Fi'}</Button>:null}
      {release&&['idle','queued','cancelled','failed'].includes(s.phase)?<Button variant="outline" onClick={()=>u.download(true)}>Download using mobile data</Button>:null}
      {waiting&&s.phase!=='installing'?<Button variant="outline" onClick={u.cancel}>Cancel download</Button>:null}
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Installation starts only after you choose Update and confirm with Android. Returning from permission settings does not install automatically.</p>
  </section>;
}

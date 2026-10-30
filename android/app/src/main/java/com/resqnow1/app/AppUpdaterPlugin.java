package com.resqnow1.app;

import android.content.Intent;import android.net.Uri;import android.os.Build;
import androidx.activity.result.ActivityResult;import androidx.lifecycle.Lifecycle;import androidx.lifecycle.Observer;
import androidx.work.ExistingWorkPolicy;import androidx.work.NetworkType;import androidx.work.WorkInfo;import androidx.work.WorkManager;
import com.getcapacitor.JSObject;import com.getcapacitor.Plugin;import com.getcapacitor.PluginCall;import com.getcapacitor.PluginMethod;import com.getcapacitor.annotation.ActivityCallback;import com.getcapacitor.annotation.CapacitorPlugin;
import com.resqnow1.app.updates.*;
import java.io.File;import java.io.IOException;import java.util.HashMap;import java.util.Iterator;import java.util.List;import java.util.Map;import java.util.Properties;import java.util.concurrent.Callable;import java.util.concurrent.ExecutorService;import java.util.concurrent.Executors;import java.util.concurrent.TimeUnit;import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="AppUpdater")
public class AppUpdaterPlugin extends Plugin {
 private final ExecutorService tasks=Executors.newSingleThreadExecutor();
 private final UpdateInstallGuard installGuard=new UpdateInstallGuard();
 private final AtomicBoolean publishing=new AtomicBoolean(false),installerOpen=new AtomicBoolean(false);
 private UpdateStateStore store;private Observer<List<WorkInfo>> observer;private String lastSnapshot="";private Uri grantedUri;
 @Override public void load(){
  store=UpdateStorage.open(getContext());
  if(UpdateNativeGate.enabled(getContext())){observer=ignored->publishSoon();getActivity().runOnUiThread(()->WorkManager.getInstance(getContext()).getWorkInfosForUniqueWorkLiveData(UpdateDownloadWorker.WORK_NAME).observe(getActivity(),observer));}
 }
 private void enabled(){if(!UpdateNativeGate.enabled(getContext()))throw new IllegalStateException("updates_disabled");}
 private JSObject object(UpdateManifest release){JSObject result=new JSObject();for(Map.Entry<String,Object> e:release.toMap().entrySet())result.put(e.getKey(),e.getValue());return result;}
 private UpdateManifest input(PluginCall call)throws Exception {JSObject value=call.getObject("release");if(value==null)throw new IllegalArgumentException("update_manifest");Map<String,Object> map=new HashMap<>();Iterator<String> keys=value.keys();while(keys.hasNext()){String key=keys.next();map.put(key,value.get(key));}return UpdateManifest.parse(map);}
 private List<WorkInfo> work(String generation)throws Exception {return WorkManager.getInstance(getContext()).getWorkInfosByTag(UpdateDownloadWorker.WORK_NAME+":"+generation).get(3,TimeUnit.SECONDS);}
 private JSObject snapshot()throws Exception {
  UpdateApkPolicy.Archive own=UpdateInstaller.installed(getContext());JSObject result=new JSObject();result.put("installedVersionCode",own.versionCode);result.put("installedVersionName",own.versionName);result.put("sdkVersion",Build.VERSION.SDK_INT);result.put("bytesDownloaded",0);result.put("phase","idle");result.put("enabled",UpdateNativeGate.enabled(getContext()));
  if(!UpdateNativeGate.enabled(getContext()))return result;
  Properties state;
  try{state=store.read();}catch(IOException corrupt){result.put("phase","failed");result.put("errorCode","storage");return result;}
  String generation=state.getProperty("generation");
  if(store.clearIfInstalled(own.versionCode)){if(generation!=null)try{UpdateStorage.removeArtifacts(getContext(),generation);}catch(IOException ignored){}state=store.read();}
  if(state.containsKey("manifest.versionCode")){
   UpdateManifest release=UpdateStateStore.manifest(state);String phase=state.getProperty("phase");
   if(!phase.equals("cancelled")&&!phase.equals("failed")){
    UpdateApkPolicy.requireRelease(release,own,Build.VERSION.SDK_INT);List<WorkInfo> jobs=work(generation);
    boolean running=false,succeeded=false,failed=false;for(WorkInfo info:jobs){running|=!info.getState().isFinished();succeeded|=info.getState()==WorkInfo.State.SUCCEEDED;failed|=info.getState()==WorkInfo.State.FAILED||info.getState()==WorkInfo.State.CANCELLED;}
    File file=UpdateStorage.verified(getContext(),generation);
    if(phase.equals("verifying")&&succeeded&&!running){
     try{UpdateInstaller.verify(getContext(),release,file,control(generation));store.update(generation,"ready",release.sizeBytes,null);}
     catch(Exception invalid){store.update(generation,"failed",0,"integrity");}
    }else if((phase.equals("queued")||phase.equals("downloading")||phase.equals("verifying"))&&failed&&!running){store.update(generation,"failed",Long.parseLong(state.getProperty("bytesDownloaded")),"download");}
    else if((phase.equals("queued")||phase.equals("downloading")||phase.equals("verifying"))&&jobs.isEmpty()){
     // Process death between state persistence and enqueue recovers on Wi-Fi only.
     WorkManager.getInstance(getContext()).enqueueUniqueWork(UpdateDownloadWorker.WORK_NAME,ExistingWorkPolicy.KEEP,UpdateDownloadWorker.request(generation,false)).getResult().get(3,TimeUnit.SECONDS);
    }else if((phase.equals("ready")||phase.equals("permission-required")||phase.equals("installing"))&&(!file.isFile()||file.length()!=release.sizeBytes)){store.update(generation,"failed",0,"storage");}
    else if(phase.equals("permission-required")&&UpdateInstaller.permissionGranted(getContext()))store.update(generation,"ready",release.sizeBytes,null);
    else if(phase.equals("installing")&&!installerOpen.get())store.update(generation,"ready",release.sizeBytes,"install_cancelled");
   }
   state=store.read();
   if(state.containsKey("manifest.versionCode"))result.put("release",object(UpdateStateStore.manifest(state)));
  }
  result.put("phase",state.getProperty("phase"));result.put("bytesDownloaded",Long.parseLong(state.getProperty("bytesDownloaded")));if(state.getProperty("errorCode")!=null)result.put("errorCode",state.getProperty("errorCode"));return result;
 }
 private UpdateDownloader.Control control(String generation){return new UpdateDownloader.Control(){public boolean cancelled(){try{return !generation.equals(store.read().getProperty("generation"));}catch(IOException e){return true;}}public void progress(long bytes){}public void verifying(){}};}
 private void emit(JSObject value){String text=value.toString();if(!text.equals(lastSnapshot)){lastSnapshot=text;notifyListeners("updateStateChange",value);}}
 private void run(PluginCall call,Callable<JSObject> action){if(tasks.isShutdown()){call.reject("Updater is unavailable","UPDATER_UNAVAILABLE");return;}tasks.execute(()->{try{JSObject result=action.call();emit(result);call.resolve(result);}catch(Exception error){call.reject("Update action could not be completed","UPDATE_FAILED");}});}
 private void publishSoon(){if(tasks.isShutdown()||!publishing.compareAndSet(false,true))return;tasks.execute(()->{try{emit(snapshot());}catch(Exception ignored){/* callers can retry getState; never crash the app */}finally{publishing.set(false);}});}
 @PluginMethod public void getState(PluginCall call){run(call,()->snapshot());}
 @PluginMethod public void scheduleDownload(PluginCall call){installGuard.cancel();run(call,()->{
  enabled();if(installerOpen.get())throw new IllegalStateException("install_busy");UpdateManifest release=input(call);UpdateApkPolicy.requireRelease(release,UpdateInstaller.installed(getContext()),Build.VERSION.SDK_INT);
  Object choice=call.getData().opt("allowMetered");if(choice!=null&&!(choice instanceof Boolean))throw new IllegalArgumentException("update_network_policy");boolean metered=Boolean.TRUE.equals(choice);
  Properties previous=store.readForNewRequest();String old=previous.getProperty("generation");
  if(previous.containsKey("manifest.versionCode")&&UpdateStateStore.manifest(previous).toProperties().equals(release.toProperties())){
   String phase=previous.getProperty("phase");if(phase.equals("ready")||phase.equals("permission-required")||phase.equals("verifying"))return snapshot();
   if(phase.equals("queued")||phase.equals("downloading")){List<WorkInfo> jobs=work(old);for(WorkInfo info:jobs)if(!info.getState().isFinished()&&(!metered||info.getConstraints().getRequiredNetworkType()==NetworkType.CONNECTED))return snapshot();}
  }
  if(old!=null){store.cancel();WorkManager.getInstance(getContext()).cancelUniqueWork(UpdateDownloadWorker.WORK_NAME).getResult().get(3,TimeUnit.SECONDS);try{UpdateStorage.removeArtifacts(getContext(),old);}catch(IOException ignored){}}
  String generation=store.begin(release);WorkManager.getInstance(getContext()).enqueueUniqueWork(UpdateDownloadWorker.WORK_NAME,ExistingWorkPolicy.REPLACE,UpdateDownloadWorker.request(generation,metered)).getResult().get(3,TimeUnit.SECONDS);return snapshot();
 });}
 @PluginMethod public void cancelDownload(PluginCall call){installGuard.cancel();run(call,()->{if(installerOpen.get())throw new IllegalStateException("install_busy");Properties previous=store.readForNewRequest();store.cancel();WorkManager.getInstance(getContext()).cancelUniqueWork(UpdateDownloadWorker.WORK_NAME).getResult().get(3,TimeUnit.SECONDS);String generation=previous.getProperty("generation");if(generation!=null)try{UpdateStorage.removeArtifacts(getContext(),generation);}catch(IOException ignored){}return snapshot();});}
 @PluginMethod public void cancelInstallPreparation(PluginCall call){installGuard.cancel();call.resolve();}
 @PluginMethod public void requestInstall(PluginCall call){
  final long token;
  try{enabled();if(installerOpen.get())throw new IllegalStateException("install_busy");token=installGuard.begin();}catch(Exception busy){call.reject("An installation cannot start now","INSTALL_UNAVAILABLE");return;}
  tasks.execute(()->{
   String verifyingGeneration=null;
   try{
    Properties state=store.read();String phase=state.getProperty("phase"),generation=state.getProperty("generation");if(!phase.equals("ready")&&!phase.equals("permission-required"))throw new IOException("update_not_ready");UpdateManifest release=UpdateStateStore.manifest(state);
    if(!UpdateInstaller.permissionGranted(getContext())){store.update(generation,"permission-required",release.sizeBytes,null);JSObject next=snapshot();emit(next);installGuard.finish(token);call.resolve(next);return;}
    final UpdateDownloader.Control cancellation=new UpdateDownloader.Control(){public boolean cancelled(){return !installGuard.current(token)||control(generation).cancelled();}public void progress(long n){}public void verifying(){}};
    verifyingGeneration=generation;
    final Intent intent=UpdateInstaller.installIntent(getContext(),release,UpdateStorage.verified(getContext(),generation),cancellation);
    getActivity().runOnUiThread(()->{
     try{
      if(!installGuard.current(token)||getActivity().isFinishing()||!getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)||!generation.equals(store.read().getProperty("generation")))throw new IOException("install_cancelled");
      if(!store.update(generation,"installing",release.sizeBytes,null))throw new IOException("install_cancelled");
      grantedUri=intent.getData();installerOpen.set(true);startActivityForResult(call,intent,"installResult");publishSoon();
     }catch(Exception cancelled){installerOpen.set(false);try{store.update(generation,"ready",release.sizeBytes,"install_cancelled");}catch(Exception ignored){}call.reject("Installation was not started","INSTALL_CANCELLED");publishSoon();}
     finally{installGuard.finish(token);}
    });
   }catch(Exception invalid){if(verifyingGeneration!=null&&installGuard.current(token)&&!(invalid instanceof java.io.InterruptedIOException))try{store.update(verifyingGeneration,"failed",0,"integrity");}catch(Exception ignored){}installGuard.finish(token);call.reject("The update could not be verified or installation was cancelled","INSTALL_UNAVAILABLE");publishSoon();}
  });
 }
 @PluginMethod public void openInstallPermissionSettings(PluginCall call){
  installGuard.cancel();try{enabled();getActivity().runOnUiThread(()->{try{getActivity().startActivity(UpdateInstaller.permissionIntent(getContext()));call.resolve();}catch(Exception unavailable){call.reject("Installation settings are unavailable","PERMISSION_UNAVAILABLE");}});}catch(Exception disabled){call.reject("Updates are disabled","UPDATES_DISABLED");}
 }
 @ActivityCallback protected void installResult(PluginCall call,ActivityResult ignored){
  installerOpen.set(false);if(grantedUri!=null){getContext().revokeUriPermission(grantedUri,Intent.FLAG_GRANT_READ_URI_PERMISSION);grantedUri=null;}
  if(tasks.isShutdown())return;tasks.execute(()->{try{JSObject result=snapshot();emit(result);if(call!=null)call.resolve(result);}catch(Exception unavailable){if(call!=null)call.reject("Could not confirm the installed version","INSTALL_UNAVAILABLE");}});
 }
 @Override protected void handleOnResume(){publishSoon();}
 @Override protected void handleOnPause(){installGuard.cancel();}
 @Override protected void handleOnDestroy(){installGuard.cancel();if(observer!=null&&getActivity()!=null)getActivity().runOnUiThread(()->WorkManager.getInstance(getContext()).getWorkInfosForUniqueWorkLiveData(UpdateDownloadWorker.WORK_NAME).removeObserver(observer));tasks.shutdownNow();}
}

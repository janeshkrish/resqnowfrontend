package com.resqnow1.app.updates;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.StatFs;
import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.File;
import java.io.IOException;
import java.util.Properties;
import java.util.concurrent.TimeUnit;

public final class UpdateDownloadWorker extends Worker {
 public static final String WORK_NAME="resqnow-apk-update";
 private volatile UpdateDownloader downloader;
 public UpdateDownloadWorker(@NonNull Context context,@NonNull WorkerParameters parameters){super(context,parameters);}
 public static OneTimeWorkRequest request(String generation,boolean allowMetered){
  UpdateStorage.requireGeneration(generation);
  return new OneTimeWorkRequest.Builder(UpdateDownloadWorker.class).setInputData(new Data.Builder().putString("generation",generation).build()).setConstraints(new Constraints.Builder().setRequiredNetworkType(allowMetered?NetworkType.CONNECTED:NetworkType.UNMETERED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).addTag(WORK_NAME).addTag(WORK_NAME+":"+generation).build();
 }
 @NonNull @Override public Result doWork(){
  final Context context=getApplicationContext();final UpdateStateStore store=UpdateStorage.open(context);final String generation=getInputData().getString("generation");
  try{
   if(!UpdateNativeGate.enabled(context))return failure("disabled");
   UpdateStorage.requireGeneration(generation);Properties state=store.read();if(!generation.equals(state.getProperty("generation")))return Result.success();
   String phase=state.getProperty("phase");if(phase.equals("cancelled")||phase.equals("idle")||phase.equals("failed")||phase.equals("ready")||phase.equals("permission-required")||phase.equals("installing"))return Result.success();
   final UpdateManifest release=UpdateStateStore.manifest(state);PackageInfo installed=context.getPackageManager().getPackageInfo(context.getPackageName(),0);long version=Build.VERSION.SDK_INT>=28?installed.getLongVersionCode():installed.versionCode;
   if(version>=release.versionCode){store.clearIfInstalled(version);return Result.success();}release.requireCompatible(context.getPackageName(),version,Build.VERSION.SDK_INT);
   final File partial=UpdateStorage.partial(context,generation),verified=UpdateStorage.verified(context,generation);long length=Math.min(partial.length(),release.sizeBytes);
   if(new StatFs(partial.getParent()).getAvailableBytes()<Math.max(0,release.sizeBytes-length)+16L*1024*1024){fail(store,generation,"storage");return failure("storage");}
   if(phase.equals("verifying"))store.update(generation,"queued",length,null);
   if(!store.update(generation,"downloading",length,null))return Result.success();
   downloader=new UpdateDownloader();
   downloader.download(release,partial,verified,new UpdateDownloader.Control(){
    private long lastTime=0,lastBytes=0;
    public boolean cancelled(){if(isStopped())return true;try{return !generation.equals(store.read().getProperty("generation"));}catch(IOException e){return true;}}
    public void progress(long bytes)throws IOException {long now=System.nanoTime();if(bytes==0||bytes==release.sizeBytes||bytes-lastBytes>=1024*1024||now-lastTime>=TimeUnit.SECONDS.toNanos(1)){if(!store.update(generation,"downloading",bytes,null))throw new java.io.InterruptedIOException("update_cancelled");setProgressAsync(new Data.Builder().putLong("bytesDownloaded",bytes).build());lastTime=now;lastBytes=bytes;}}
    public void verifying()throws IOException {if(!store.update(generation,"verifying",release.sizeBytes,null))throw new java.io.InterruptedIOException("update_cancelled");}
   });
   // Hash verified only. The plugin must also inspect APK package/SDK/certificate
   // before promoting this state to ready or exposing an installer action.
   return Result.success();
  }catch(UpdateDownloader.InvalidApkException|IllegalArgumentException invalid){fail(store,generation,"integrity");return failure("integrity");}
  catch(Exception unavailable){
   try{Properties state=store.read();if(!generation.equals(state.getProperty("generation")))return Result.success();if(!isStopped()&&getRunAttemptCount()>=4){fail(store,generation,"download");return failure("download");}if(state.getProperty("phase").equals("downloading")||state.getProperty("phase").equals("verifying"))store.update(generation,"queued",Long.parseLong(state.getProperty("bytesDownloaded")),"network");}
   catch(Exception storage){return failure("storage");}
   return Result.retry();
  }finally{downloader=null;}
 }
 @Override public void onStopped(){UpdateDownloader current=downloader;if(current!=null)current.cancel();}
 private static Result failure(String code){return Result.failure(new Data.Builder().putString("errorCode",code).build());}
 private static void fail(UpdateStateStore store,String generation,String code){try{Properties state=store.read();if(generation!=null&&generation.equals(state.getProperty("generation")))store.update(generation,"failed",Long.parseLong(state.getProperty("bytesDownloaded")),code);}catch(Exception ignored){/* corrupt/unwritable update state must never enable installation */}}
}

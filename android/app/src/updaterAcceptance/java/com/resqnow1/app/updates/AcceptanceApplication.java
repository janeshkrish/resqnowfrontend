package com.resqnow1.app.updates;
import android.app.Application;import android.content.Context;import android.content.pm.ApplicationInfo;
import androidx.annotation.NonNull;import androidx.annotation.Nullable;import androidx.work.Configuration;import androidx.work.ListenableWorker;import androidx.work.WorkerFactory;import androidx.work.WorkerParameters;
/** Uses real persistent WorkManager, changing only the test asset connection. */
public final class AcceptanceApplication extends Application implements Configuration.Provider {
 @NonNull public Configuration getWorkManagerConfiguration(){
  if((getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)==0)throw new IllegalStateException("Acceptance application must be debuggable");
  return new Configuration.Builder().setWorkerFactory(new WorkerFactory(){
   @Nullable public ListenableWorker createWorker(@NonNull Context context,@NonNull String name,@NonNull WorkerParameters parameters){
    return name.equals(UpdateDownloadWorker.class.getName())?new UpdateDownloadWorker(context,parameters,new AcceptanceConnectionFactory()):null;
   }
  }).build();
 }
}

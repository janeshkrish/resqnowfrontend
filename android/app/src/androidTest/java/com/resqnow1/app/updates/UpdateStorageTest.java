package com.resqnow1.app.updates;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import org.junit.Test;import org.junit.runner.RunWith;import static org.junit.Assert.*;
import android.content.Context;
import java.util.HashMap;import java.util.Map;import java.util.UUID;

/** Run only through the explicit disposable-emulator serial in the acceptance harness. */
@RunWith(AndroidJUnit4.class)
public class UpdateStorageTest {
 private static UpdateManifest fixture(){Map<String,Object> m=new HashMap<>();m.put("schemaVersion",1);m.put("channel","stable");m.put("applicationId","com.resqnow1.app");m.put("versionCode",12);m.put("versionName","1.4.12");m.put("minSdk",24);m.put("targetSdk",36);m.put("sizeBytes",16);m.put("sha256",new String(new char[64]).replace('\0','a'));m.put("signingCertificateSha256",new String(new char[64]).replace('\0','b'));m.put("apkUrl","https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v12/resqnow.apk");m.put("sourceCommit",new String(new char[40]).replace('\0','c'));m.put("publishedAt","2026-10-30T12:00:00Z");return UpdateManifest.parse(m);}
 @Test public void atomicStateAndCacheRemainInAppOwnedDirectories()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();UpdateStateStore s=UpdateStorage.open(c);
  try{String id=s.begin(fixture());s.update(id,"downloading",8,null);assertEquals("8",UpdateStorage.open(c).read().getProperty("bytesDownloaded"));assertTrue(UpdateStorage.stateFile(c).getCanonicalPath().startsWith(c.getNoBackupFilesDir().getCanonicalPath()+"/"));assertEquals(c.getCacheDir().getCanonicalPath()+"/apk-updates",UpdateStorage.verified(c,id).getParentFile().getCanonicalPath());try{UpdateStorage.verified(c,"../../outside");fail("path traversal accepted");}catch(IllegalArgumentException expected){}}
  finally{s.cancel();}
 }
 @Test public void automaticAndExplicitDownloadsHaveDifferentNetworkConstraints()throws Exception{
  WorkManager manager=WorkManager.getInstance(InstrumentationRegistry.getInstrumentation().getTargetContext());
  for(boolean metered:new boolean[]{false,true}){
   OneTimeWorkRequest request=UpdateDownloadWorker.request(UUID.randomUUID().toString(),metered);
   try{manager.enqueue(request).getResult().get(10,java.util.concurrent.TimeUnit.SECONDS);assertEquals(metered?NetworkType.CONNECTED:NetworkType.UNMETERED,manager.getWorkInfoById(request.getId()).get(10,java.util.concurrent.TimeUnit.SECONDS).getConstraints().getRequiredNetworkType());}
   finally{manager.cancelWorkById(request.getId()).getResult().get(10,java.util.concurrent.TimeUnit.SECONDS);}
  }
 }
}

package com.resqnow1.app.updates;

import org.junit.Test;import static org.junit.Assert.*;
import java.util.Map;import java.util.Properties;

public class UpdateStateStoreTest {
 static class Disk implements UpdateStateStore.Disk {
  Properties value=new Properties();
  public Properties read(){Properties p=new Properties();p.putAll(value);return p;}
  public void write(Properties p){value=new Properties();value.putAll(p);}
 }
 @Test public void progressSurvivesRestartAndSnapshotsCannotMutateDisk() throws Exception {
  Disk d=new Disk();UpdateStateStore s=new UpdateStateStore(d);String id=s.begin(UpdateManifest.parse(UpdateManifestTest.fixture()));
  assertTrue(s.update(id,"downloading",8,null));Properties p=new UpdateStateStore(d).read();assertEquals("8",p.getProperty("bytesDownloaded"));assertEquals("downloading",p.getProperty("phase"));p.setProperty("phase","ready");assertEquals("downloading",s.read().getProperty("phase"));
 }
 @Test public void staleWorkerCannotCompleteAfterCancellationOrReplacement() throws Exception {
  Disk d=new Disk();UpdateStateStore s=new UpdateStateStore(d);String old=s.begin(UpdateManifest.parse(UpdateManifestTest.fixture()));s.update(old,"downloading",4,null);s.cancel();assertFalse(s.update(old,"verifying",16,null));assertEquals("cancelled",s.read().getProperty("phase"));
  Map<String,Object> next=UpdateManifestTest.fixture();next.put("versionCode",13);next.put("apkUrl","https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v13/resqnow.apk");String current=s.begin(UpdateManifest.parse(next));assertFalse(s.update(old,"failed",4,"network"));assertTrue(s.update(current,"downloading",1,null));assertEquals("13",s.read().getProperty("manifest.versionCode"));
 }
 @Test public void readyRequiresFullDownloadAndVerificationTransition() throws Exception {
  UpdateStateStore s=new UpdateStateStore(new Disk());String id=s.begin(UpdateManifest.parse(UpdateManifestTest.fixture()));
  try{s.update(id,"ready",16,null);fail("queued worker claimed verified");}catch(IllegalStateException expected){}
  s.update(id,"downloading",8,null);try{s.update(id,"verifying",8,null);fail("partial APK claimed complete");}catch(IllegalStateException expected){}
  s.update(id,"downloading",16,null);s.update(id,"verifying",16,null);assertTrue(s.update(id,"ready",16,null));
 }
 @Test public void invalidProgressAndCorruptStateCannotProduceAReadyOffer() throws Exception {
  Disk d=new Disk();UpdateStateStore s=new UpdateStateStore(d);String id=s.begin(UpdateManifest.parse(UpdateManifestTest.fixture()));try{s.update(id,"downloading",17,null);fail("oversized progress");}catch(IllegalArgumentException expected){}
  d.value=new Properties();d.value.setProperty("phase","ready");try{s.read();fail("corrupt state suggested a valid APK");}catch(java.io.IOException expected){}
 }
 @Test public void onlyActualInstalledVersionClearsTheCandidate() throws Exception {
  UpdateStateStore s=new UpdateStateStore(new Disk());s.begin(UpdateManifest.parse(UpdateManifestTest.fixture()));assertFalse(s.clearIfInstalled(11));assertTrue(s.clearIfInstalled(12));assertEquals("idle",s.read().getProperty("phase"));
 }
 @Test public void corruptedUpdaterStateCanBeRecoveredForAnExplicitNewRequest()throws Exception{
  Disk d=new Disk();d.value.setProperty("phase","ready");UpdateStateStore s=new UpdateStateStore(d);try{s.read();fail("corrupt offer accepted");}catch(java.io.IOException expected){}
  assertEquals("cancelled",s.readForNewRequest().getProperty("phase"));s.begin(UpdateManifest.parse(UpdateManifestTest.fixture()));assertEquals("queued",s.read().getProperty("phase"));
 }
}

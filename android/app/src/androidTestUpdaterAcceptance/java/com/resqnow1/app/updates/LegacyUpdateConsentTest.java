package com.resqnow1.app.updates;

import android.content.Context;import android.os.Build;
import androidx.test.core.app.ActivityScenario;import androidx.test.ext.junit.runners.AndroidJUnit4;import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;import androidx.test.uiautomator.UiDevice;import androidx.test.uiautomator.UiObject2;import androidx.test.uiautomator.UiScrollable;import androidx.test.uiautomator.UiSelector;import androidx.test.uiautomator.Until;
import com.getcapacitor.JSObject;import com.getcapacitor.PluginCall;import com.resqnow1.app.AppUpdaterPlugin;import com.resqnow1.app.MainActivity;
import java.io.File;import java.io.FileOutputStream;import java.io.InputStream;import java.util.HashMap;import java.util.Iterator;import java.util.Map;import java.util.UUID;import java.util.concurrent.CountDownLatch;import java.util.concurrent.TimeUnit;import java.util.concurrent.atomic.AtomicReference;import java.util.regex.Pattern;
import org.json.JSONObject;import org.junit.Test;import org.junit.runner.RunWith;import static org.junit.Assert.*;

/** Real registered production plugin + real system UI, independent of old stock WebView JS support.
 * Downloads are seeded with a real signed B; API36's external host separately proves A-to-B download/install.
 * Never runs on a phone, changes permission with appops, approves B, or clears application data. */
@RunWith(AndroidJUnit4.class)
public final class LegacyUpdateConsentTest {
 private static final String APP="com.resqnow1.app";
 private static final Pattern INSTALLER=Pattern.compile("com\\.(android|google\\.android)\\.packageinstaller");
 private static final class ResultCall extends PluginCall {
  final CountDownLatch done=new CountDownLatch(1);volatile JSObject result;volatile String failure;
  ResultCall(String method){super(null,"AppUpdater","acceptance-"+UUID.randomUUID(),method,new JSObject());}
  @Override public void resolve(JSObject value){result=value;done.countDown();}
  @Override public void resolve(){resolve(new JSObject());}
  @Override public void reject(String message,String code,Exception error,JSObject data){failure=code+": "+message;done.countDown();}
  JSObject await()throws Exception{assertTrue("Native call timed out",done.await(20,TimeUnit.SECONDS));assertNull(failure,failure);return result;}
 }
 private static JSObject state(AppUpdaterPlugin plugin)throws Exception{ResultCall call=new ResultCall("getState");plugin.getState(call);return call.await();}
 private static JSObject phase(AppUpdaterPlugin plugin,String expected)throws Exception{long end=System.currentTimeMillis()+20000;while(System.currentTimeMillis()<end){JSObject value=state(plugin);if(expected.equals(value.optString("phase")))return value;Thread.sleep(100);}throw new AssertionError("Native phase did not become "+expected);}
 private static String uiFailure(UiDevice device){
  String state="foreground="+device.getCurrentPackageName();
  try{java.io.ByteArrayOutputStream xml=new java.io.ByteArrayOutputStream();device.dumpWindowHierarchy(xml);String value=xml.toString("UTF-8");state+="; ui="+value.substring(0,Math.min(value.length(),6000));}catch(Exception unavailable){state+="; hierarchy unavailable";}
  return state;
 }
 private static void backToApp(UiDevice device){device.pressBack();if(!device.wait(Until.hasObject(By.pkg(APP).depth(0)),15000))fail("Did not return to ResQNow; "+uiFailure(device));}
 private static void settings(AppUpdaterPlugin plugin,UiDevice device)throws Exception{ResultCall call=new ResultCall("openInstallPermissionSettings");plugin.openInstallPermissionSettings(call);call.await();assertTrue("No real settings UI",device.wait(Until.hasObject(By.pkg("com.android.settings").depth(0)),15000));}
 private static void setPermission(AppUpdaterPlugin plugin,UiDevice device,Context context,boolean granted)throws Exception {
  settings(plugin,device);
  if(UpdateInstaller.permissionGranted(context)!=granted){
   if(Build.VERSION.SDK_INT<26){new UiScrollable(new UiSelector().scrollable(true)).scrollTextIntoView("Unknown sources");UiObject2 row=device.wait(Until.findObject(By.text("Unknown sources")),10000);assertNotNull(row);row.click();
    if(granted){UiObject2 accept=device.wait(Until.findObject(By.res("android:id/button1").text(Pattern.compile("OK",Pattern.CASE_INSENSITIVE))),5000);if(accept==null)fail("No explicit unknown-source confirmation; "+uiFailure(device));accept.click();
     if(!device.wait(Until.gone(By.res("android:id/button1")),10000))fail("Unknown-source confirmation did not close; "+uiFailure(device));}
   }else{UiObject2 toggle=device.wait(Until.findObject(By.res(Pattern.compile("(android|com.android.settings):id/switch_widget"))),10000);assertNotNull(toggle);toggle.click();}
  }
  // A system dialog click is asynchronous. Prove the grant and dismissal BEFORE Back,
  // so Back cannot merely dismiss an unhandled dialog while leaving Settings foreground.
  long end=System.currentTimeMillis()+10000;while(UpdateInstaller.permissionGranted(context)!=granted&&System.currentTimeMillis()<end)Thread.sleep(100);
  if(UpdateInstaller.permissionGranted(context)!=granted)fail("Real source permission did not change before return; "+uiFailure(device));
  backToApp(device);assertEquals("Real source permission did not change",granted,UpdateInstaller.permissionGranted(context));
 }
 @Test public void deniedThenGrantedSettingsReturnAndInstallerCancelNeverInstallAutomatically()throws Exception {
  assertEquals("true",InstrumentationRegistry.getArguments().getString("resqnowHostedAcceptanceOnly"));
  assertTrue("A disposable emulator is required",Build.FINGERPRINT.contains("generic")||Build.FINGERPRINT.contains("emulator")||Build.PRODUCT.contains("sdk"));
  assertTrue(Build.VERSION.SDK_INT==24||Build.VERSION.SDK_INT==26);
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();assertEquals(APP,context.getPackageName());assertTrue(context.getApplicationContext() instanceof AcceptanceApplication);assertEquals(1001,UpdateInstaller.installed(context).versionCode);
  Context tests=InstrumentationRegistry.getInstrumentation().getContext();String json;try(InputStream input=tests.getAssets().open("legacy-release.json")){java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] chunk=new byte[2048];int n;while((n=input.read(chunk))!=-1)bytes.write(chunk,0,n);json=bytes.toString("UTF-8");}
  JSONObject object=new JSONObject(json);Map<String,Object> map=new HashMap<>();for(Iterator<String> keys=object.keys();keys.hasNext();){String key=keys.next();map.put(key,object.get(key));}UpdateManifest release=UpdateManifest.parse(map);
  UpdateStateStore store=UpdateStorage.open(context);String generation=store.begin(release);File candidate=UpdateStorage.verified(context,generation);
  try(InputStream input=tests.getAssets().open("legacy-candidate.apk");FileOutputStream output=new FileOutputStream(candidate)){byte[] chunk=new byte[65536];int n;while((n=input.read(chunk))!=-1)output.write(chunk,0,n);output.getFD().sync();}
  UpdateInstaller.verify(context,release,candidate,new UpdateDownloader.Control(){public boolean cancelled(){return false;}public void progress(long n){}public void verifying(){}});
  store.update(generation,"downloading",release.sizeBytes,null);store.update(generation,"verifying",release.sizeBytes,null);store.update(generation,"ready",release.sizeBytes,null);
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());AtomicReference<AppUpdaterPlugin> reference=new AtomicReference<>();
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(activity->{
    assertFalse("The approved bootstrap fixture must have native maps disabled",com.resqnow1.app.BuildConfig.MAPPLS_ENABLED);
    assertNull("Disabled maps must not register the SDK plugin",activity.getBridge().getPlugin("ResqnowMappls"));
    reference.set((AppUpdaterPlugin)activity.getBridge().getPlugin("AppUpdater").getInstance());
   });AppUpdaterPlugin plugin=reference.get();assertNotNull(plugin);
   setPermission(plugin,device,context,false);ResultCall denied=new ResultCall("requestInstall");plugin.requestInstall(denied);assertEquals("permission-required",denied.await().optString("phase"));
   settings(plugin,device);backToApp(device);phase(plugin,"permission-required");assertFalse(UpdateInstaller.permissionGranted(context));assertEquals(1001,UpdateInstaller.installed(context).versionCode);
   setPermission(plugin,device,context,true);phase(plugin,"ready");assertEquals(APP,device.getCurrentPackageName());assertEquals(1001,UpdateInstaller.installed(context).versionCode);
   ResultCall installation=new ResultCall("requestInstall");plugin.requestInstall(installation);assertTrue("No real Android installer",device.wait(Until.hasObject(By.pkg(INSTALLER).depth(0)),20000));
   UiObject2 cancel=device.wait(Until.findObject(By.pkg(INSTALLER).res(Pattern.compile("(android:id/button2|com\\.(android|google\\.android)\\.packageinstaller:id/cancel_button)")).text(Pattern.compile("Cancel",Pattern.CASE_INSENSITIVE)).enabled(true)),10000);if(cancel==null)fail("No explicit installer Cancel control; "+uiFailure(device));cancel.click();installation.await();phase(plugin,"ready");
   assertEquals(APP,device.getCurrentPackageName());assertEquals(1001,UpdateInstaller.installed(context).versionCode);phase(plugin,"ready");assertEquals(APP,device.getCurrentPackageName());
  }
 }
}

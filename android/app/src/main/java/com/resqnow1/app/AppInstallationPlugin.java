package com.resqnow1.app;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.util.Properties;

@CapacitorPlugin(name="AppInstallation")
public class AppInstallationPlugin extends Plugin {
 private AppInstallationStore store;
 @Override public void load(){
  File base=new File(getContext().getNoBackupFilesDir(),"app-installation-v1.properties");AtomicFile file=new AtomicFile(base);
  store=new AppInstallationStore(new AppInstallationStore.Persistence(){
   public Properties read() throws IOException {
    try(FileInputStream in=file.openRead()){Properties p=new Properties();p.load(in);return p;}
    catch(FileNotFoundException e){if(base.exists()||new File(base+".bak").exists()||new File(base+".new").exists())throw new IOException("Analytics storage unavailable");return null;}
   }
   public void write(Properties p) throws IOException {
    FileOutputStream out=null;try{out=file.startWrite();p.store(out,"Private installation state");out.getFD().sync();file.finishWrite(out);}catch(IOException e){if(out!=null)file.failWrite(out);throw e;}
   }
  });
 }
 private JSObject snapshot(Properties p) throws Exception {
  JSObject out=new JSObject();for(String key:new String[]{"installationId","installationSecret","consentPolicyVersion"})out.put(key,p.getProperty(key));
  for(String key:new String[]{"consentGranted","consentDecided","everConsented"})out.put(key,Boolean.parseBoolean(p.getProperty(key)));
  for(String key:new String[]{"consentRevision","acknowledgedRevision"})out.put(key,Long.parseLong(p.getProperty(key)));
  PackageInfo info=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);out.put("appId",getContext().getPackageName());out.put("versionName",info.versionName);out.put("versionCode",Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode);return out;
 }
 @PluginMethod public void getIdentity(PluginCall call){try{call.resolve(snapshot(store.get()));}catch(Exception e){call.reject("App analytics identity unavailable");}}
 @PluginMethod public void setConsent(PluginCall call){try{Boolean granted=call.getBoolean("granted");if(granted==null)throw new IOException();call.resolve(snapshot(store.setConsent(granted,call.getString("policyVersion"))));}catch(Exception e){call.reject("Could not save app analytics preference");}}
 @PluginMethod public void acknowledge(PluginCall call){try{Integer revision=call.getInt("revision");if(revision==null)throw new IOException();store.acknowledge(revision);call.resolve();}catch(Exception e){call.reject("Could not acknowledge analytics report");}}
}

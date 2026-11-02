package com.resqnow1.app.updates;

import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;

/** Generation ownership prevents a stopped worker from reviving an old offer. */
public final class UpdateStateStore {
 public interface Disk {Properties read() throws IOException;void write(Properties properties) throws IOException;}
 private static final Object LOCK=new Object();
 private static final Set<String> PHASES=new HashSet<>(Arrays.asList("idle","queued","downloading","verifying","ready","permission-required","installing","failed","cancelled"));
 private final Disk disk;
 public UpdateStateStore(Disk disk){if(disk==null)throw new IllegalArgumentException("Update state storage required");this.disk=disk;}
 public Properties read() throws IOException {synchronized(LOCK){return validated(disk.read());}}
 /** Only an explicit retry/cancel may reset corrupt updater-owned metadata. */
 public Properties readForNewRequest() throws IOException {synchronized(LOCK){try{return read();}catch(IOException corrupt){cancel();return read();}}}
 public String begin(UpdateManifest manifest) throws IOException {synchronized(LOCK){Properties p=new Properties();String id=UUID.randomUUID().toString();p.setProperty("generation",id);p.setProperty("phase","queued");p.setProperty("bytesDownloaded","0");Properties m=manifest.toProperties();for(String key:m.stringPropertyNames())p.setProperty("manifest."+key,m.getProperty(key));disk.write(p);return id;}}
 public boolean update(String generation,String phase,long bytes,String errorCode) throws IOException {synchronized(LOCK){
  Properties p=read();String prior=p.getProperty("phase");
  if(!generation.equals(p.getProperty("generation"))||prior.equals("cancelled")||prior.equals("idle"))return false;
  UpdateManifest manifest=manifest(p);
  if(!PHASES.contains(phase)||bytes<0||bytes>manifest.sizeBytes||errorCode!=null&&!errorCode.matches("[a-z_]{1,40}"))throw new IllegalArgumentException("Invalid updater progress");
  if(!transition(prior,phase)||isCompletePhase(phase)&&bytes!=manifest.sizeBytes)throw new IllegalStateException("Unsafe updater transition");
  p.setProperty("phase",phase);p.setProperty("bytesDownloaded",Long.toString(bytes));if(errorCode==null)p.remove("errorCode");else p.setProperty("errorCode",errorCode);disk.write(p);return true;
 }}
 public void cancel() throws IOException {synchronized(LOCK){Properties p;try{p=read();}catch(IOException corrupt){p=new Properties();}p.setProperty("generation",UUID.randomUUID().toString());p.setProperty("phase","cancelled");p.setProperty("bytesDownloaded","0");p.remove("errorCode");disk.write(p);}}
 public boolean clearIfInstalled(long actualVersion) throws IOException {synchronized(LOCK){Properties p=read();if(!p.containsKey("manifest.versionCode")||manifest(p).versionCode>actualVersion)return false;Properties clear=new Properties();clear.setProperty("phase","idle");clear.setProperty("bytesDownloaded","0");disk.write(clear);return true;}}
 public static UpdateManifest manifest(Properties state){Properties data=new Properties();for(String field:UpdateManifest.FIELDS){String value=state.getProperty("manifest."+field);if(value!=null)data.setProperty(field,value);}return UpdateManifest.fromProperties(data);}
 private static Properties validated(Properties raw) throws IOException {
  Properties p=new Properties();if(raw!=null)p.putAll(raw);if(p.isEmpty()){p.setProperty("phase","idle");p.setProperty("bytesDownloaded","0");return p;}
  try{
   String phase=p.getProperty("phase");if(!PHASES.contains(phase))throw new IllegalArgumentException();long bytes=Long.parseLong(p.getProperty("bytesDownloaded"));if(bytes<0)throw new IllegalArgumentException();
   if(!phase.equals("idle")){String id=p.getProperty("generation");if(id==null||!UUID.fromString(id).toString().equals(id))throw new IllegalArgumentException();if(!(phase.equals("cancelled")&&!p.containsKey("manifest.versionCode"))){UpdateManifest m=manifest(p);if(bytes>m.sizeBytes||isCompletePhase(phase)&&bytes!=m.sizeBytes)throw new IllegalArgumentException();}}
   else if(p.containsKey("manifest.versionCode"))throw new IllegalArgumentException();
   return p;
  }catch(IllegalArgumentException|NullPointerException e){throw new IOException("Android update state is corrupt");}
 }
 private static boolean isCompletePhase(String phase){return phase.equals("verifying")||phase.equals("ready")||phase.equals("permission-required")||phase.equals("installing");}
 private static boolean transition(String from,String to){
  if(to.equals("failed")||to.equals("cancelled"))return true;
  switch(from){
   case "queued":return to.equals("downloading");
   case "downloading":return to.equals("downloading")||to.equals("queued")||to.equals("verifying");
   case "verifying":return to.equals("ready")||to.equals("queued");
   case "ready":return to.equals("ready")||to.equals("permission-required")||to.equals("installing");
   case "permission-required":return to.equals("ready")||to.equals("permission-required")||to.equals("installing");
   case "installing":return to.equals("ready");
   default:return false;
  }
 }
}

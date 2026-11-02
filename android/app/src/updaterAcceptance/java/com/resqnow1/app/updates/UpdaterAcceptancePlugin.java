package com.resqnow1.app.updates;
import android.content.Context;import android.content.ContextWrapper;import android.content.pm.ApplicationInfo;
import com.getcapacitor.JSObject;import com.getcapacitor.Plugin;import com.getcapacitor.PluginCall;import com.getcapacitor.PluginMethod;import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;import java.io.IOException;import java.util.Properties;
/** Narrow fixture probes only; no generic filesystem, permission grant or install API. */
@CapacitorPlugin(name="UpdaterAcceptance")
public final class UpdaterAcceptancePlugin extends Plugin {
 private void enabled(){if((getContext().getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)==0||!(getContext().getApplicationContext() instanceof AcceptanceApplication))throw new IllegalStateException("Not an acceptance fixture");}
 @PluginMethod public void cacheState(PluginCall call){try{enabled();Properties state=UpdateStorage.open(getContext()).read();String generation=state.getProperty("generation");JSObject result=new JSObject();result.put("phase",state.getProperty("phase"));result.put("partialBytes",generation==null?0:UpdateStorage.partial(getContext(),generation).length());result.put("verified",generation!=null&&UpdateStorage.verified(getContext(),generation).isFile());call.resolve(result);}catch(Exception error){call.reject("Fixture cache state unavailable");}}
 @PluginMethod public void evictCandidate(PluginCall call){try{enabled();Properties state=UpdateStorage.open(getContext()).read();String phase=state.getProperty("phase");if(!phase.equals("ready")&&!phase.equals("permission-required"))throw new IOException();UpdateStorage.removeArtifacts(getContext(),state.getProperty("generation"));call.resolve();}catch(Exception error){call.reject("Fixture candidate eviction refused");}}
 @PluginMethod public void checkStorageGuard(PluginCall call){try{enabled();Properties state=UpdateStorage.open(getContext()).read();UpdateManifest release=UpdateStateStore.manifest(state);File file=UpdateStorage.verified(getContext(),state.getProperty("generation"));Context full=new ContextWrapper(getContext()){@Override public File getFilesDir(){return new File("/proc");}};
   try{UpdateInstaller.installIntent(full,release,file,new UpdateDownloader.Control(){public boolean cancelled(){return false;}public void progress(long bytes){}public void verifying(){}});call.reject("Insufficient-space guard did not block");}
   catch(IOException blocked){if(!"update_storage".equals(blocked.getMessage()))throw blocked;JSObject result=new JSObject();result.put("blocked",true);call.resolve(result);}
  }catch(Exception error){call.reject("Fixture storage guard probe failed");}}
}

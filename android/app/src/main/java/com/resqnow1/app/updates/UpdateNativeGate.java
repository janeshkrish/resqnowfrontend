package com.resqnow1.app.updates;
import android.content.Context;import android.content.pm.PackageManager;
public final class UpdateNativeGate {
 private UpdateNativeGate(){}
 public static boolean enabled(Context context){try{android.content.pm.ApplicationInfo info=context.getPackageManager().getApplicationInfo(context.getPackageName(),PackageManager.GET_META_DATA);return info.metaData!=null&&info.metaData.getBoolean("com.resqnow.app_updates_enabled",false);}catch(Exception unavailable){return false;}}
}

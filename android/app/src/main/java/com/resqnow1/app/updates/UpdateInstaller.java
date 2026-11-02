package com.resqnow1.app.updates;

import android.content.Context;import android.content.Intent;import android.content.pm.PackageInfo;import android.content.pm.PackageManager;import android.content.pm.Signature;import android.net.Uri;import android.os.Build;import android.os.StatFs;import android.provider.Settings;
import androidx.core.content.FileProvider;
import java.io.File;import java.io.IOException;import java.security.MessageDigest;import java.util.HashSet;import java.util.Set;

/** Prepares a system confirmation intent only from a freshly verified private APK. */
public final class UpdateInstaller {
 private UpdateInstaller(){}
 private static int flags(){return Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;}
 public static UpdateApkPolicy.Archive installed(Context context)throws IOException {try{return archive(context.getPackageManager().getPackageInfo(context.getPackageName(),flags()));}catch(PackageManager.NameNotFoundException e){throw new IOException("update_package");}}
 private static UpdateApkPolicy.Archive archive(PackageInfo info)throws IOException {
  if(info==null||info.applicationInfo==null)throw new IOException("update_archive");
  Signature[] signatures=Build.VERSION.SDK_INT>=28?(info.signingInfo==null?null:info.signingInfo.getApkContentsSigners()):info.signatures;
  Set<String> certificates=new HashSet<>();
  try{if(signatures!=null)for(Signature signature:signatures){StringBuilder hex=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())){hex.append(Character.forDigit((b&255)>>>4,16));hex.append(Character.forDigit(b&15,16));}certificates.add(hex.toString());}}
  catch(Exception unavailable){throw new IOException("update_signature");}
  return new UpdateApkPolicy.Archive(info.packageName,Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode,info.versionName,info.applicationInfo.minSdkVersion,info.applicationInfo.targetSdkVersion,certificates);
 }
 public static void verify(Context context,UpdateManifest release,File file,UpdateDownloader.Control control)throws IOException {
  File root=UpdateStorage.directory(context).getCanonicalFile();
  if(!file.getCanonicalFile().getParentFile().equals(root)||!file.getName().matches("[a-f0-9-]{36}\\.apk"))throw new IOException("update_cache_path");
  UpdateApkPolicy.Archive own=installed(context);UpdateApkPolicy.requireRelease(release,own,Build.VERSION.SDK_INT);
  UpdateDownloader.verifyFile(release,file,control);
  UpdateApkPolicy.Archive candidate=archive(context.getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(),flags()));
  UpdateApkPolicy.requireArchive(release,own,candidate,Build.VERSION.SDK_INT);
 }
 public static Intent installIntent(Context context,UpdateManifest release,File file,UpdateDownloader.Control control)throws IOException {
  verify(context,release,file,control);
  if(new StatFs(context.getFilesDir().getAbsolutePath()).getAvailableBytes()<release.sizeBytes*2+32L*1024*1024)throw new IOException("update_storage");
  Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".appupdates",file);
  return new Intent(Intent.ACTION_INSTALL_PACKAGE).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).putExtra(Intent.EXTRA_RETURN_RESULT,true);
 }
 public static boolean permissionGranted(Context context){try{return Build.VERSION.SDK_INT>=26?context.getPackageManager().canRequestPackageInstalls():Settings.Secure.getInt(context.getContentResolver(),Settings.Secure.INSTALL_NON_MARKET_APPS,0)==1;}catch(Exception denied){return false;}}
 public static Intent permissionIntent(Context context){return Build.VERSION.SDK_INT>=26?new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+context.getPackageName())):new Intent(Settings.ACTION_SECURITY_SETTINGS);}
}

package com.resqnow1.app.updates;

import androidx.test.ext.junit.runners.AndroidJUnit4;import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;import org.junit.runner.RunWith;import static org.junit.Assert.*;
import android.content.Context;import android.content.Intent;import android.os.Build;import android.provider.Settings;
import java.io.File;import java.io.FileOutputStream;import java.io.IOException;import java.security.MessageDigest;import java.util.HashMap;import java.util.Map;import java.util.UUID;

@RunWith(AndroidJUnit4.class)
public class UpdateInstallerTest {
 @Test public void readsActualInstalledPackageAndPublicSigningIdentity()throws Exception{UpdateApkPolicy.Archive own=UpdateInstaller.installed(InstrumentationRegistry.getInstrumentation().getTargetContext());assertEquals("com.resqnow1.app",own.applicationId);assertEquals(1,own.certificates.size());assertTrue(own.certificates.iterator().next().matches("[a-f0-9]{64}"));}
 @Test public void permissionSettingsAreScopedToThisSourceOnAndroid26AndLater(){Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();Intent intent=UpdateInstaller.permissionIntent(c);assertEquals(Build.VERSION.SDK_INT>=26?Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES:Settings.ACTION_SECURITY_SETTINGS,intent.getAction());if(Build.VERSION.SDK_INT>=26)assertEquals("package:com.resqnow1.app",intent.getDataString());}
 @Test public void rejectsHashValidBytesThatAreNotASignedAPKBeforeCreatingInstallerIntent()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();String generation=UUID.randomUUID().toString();File file=UpdateStorage.verified(c,generation);byte[] bytes="0123456789abcdef".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
  try{try(FileOutputStream out=new FileOutputStream(file)){out.write(bytes);}UpdateApkPolicy.Archive own=UpdateInstaller.installed(c);StringBuilder sha=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))sha.append(String.format("%02x",b&255));Map<String,Object> m=new HashMap<>();m.put("schemaVersion",1);m.put("channel","stable");m.put("applicationId","com.resqnow1.app");m.put("versionCode",own.versionCode+1);m.put("versionName","1.4.test");m.put("minSdk",24);m.put("targetSdk",36);m.put("sizeBytes",16);m.put("sha256",sha.toString());m.put("signingCertificateSha256",own.certificates.iterator().next());m.put("apkUrl","https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v"+(own.versionCode+1)+"/resqnow.apk");m.put("sourceCommit",new String(new char[40]).replace('\0','c'));m.put("publishedAt","2026-10-30T12:00:00Z");UpdateManifest release=UpdateManifest.parse(m);
   try{UpdateInstaller.installIntent(c,release,file,new UpdateDownloader.Control(){public boolean cancelled(){return false;}public void progress(long n){}public void verifying(){}});fail("invalid archive produced an install intent");}catch(IOException|IllegalArgumentException expected){}
  }finally{UpdateStorage.removeArtifacts(c,generation);}
 }
}

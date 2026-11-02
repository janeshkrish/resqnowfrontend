package com.resqnow1.app.updates;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.HashMap;
import java.util.Map;

public class UpdateManifestTest {
 static Map<String,Object> fixture(){
  Map<String,Object> m=new HashMap<>();m.put("schemaVersion",1);m.put("channel","stable");m.put("applicationId","com.resqnow1.app");m.put("versionCode",12);m.put("versionName","1.4.12");m.put("minSdk",24);m.put("targetSdk",36);m.put("sizeBytes",16);
  m.put("sha256","a".repeat(64));m.put("signingCertificateSha256","b".repeat(64));m.put("apkUrl","https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v12/resqnow.apk");m.put("sourceCommit","c".repeat(40));m.put("publishedAt","2026-10-30T12:00:00Z");return m;
 }
 @Test public void validManifestIsCopiedAndRoundTrips(){
  Map<String,Object> input=fixture();UpdateManifest m=UpdateManifest.parse(input);input.put("versionCode",99);
  assertEquals(12,m.versionCode);assertEquals("com.resqnow1.app",m.applicationId);assertEquals(m.toMap(),UpdateManifest.fromProperties(m.toProperties()).toMap());
 }
 @Test public void rejectsUntrustedOrMalformedMetadata(){
  Object[][] cases={{"applicationId","attacker.app"},{"channel","beta"},{"schemaVersion",2},{"versionCode",12.5},{"versionCode",2147483648L},{"versionCode",0},{"versionName",""},{"minSdk",23},{"minSdk",37},{"sizeBytes",0},{"sizeBytes",209715201L},{"sha256","bad"},{"signingCertificateSha256","bad"},{"sourceCommit","main"},{"publishedAt","2026-02-30T12:00:00Z"},{"apkUrl","http://github.com/janeshkrish/resqnowfrontend/releases/download/android-v12/resqnow.apk"},{"apkUrl","https://github.com/attacker/repo/releases/download/android-v12/resqnow.apk"},{"apkUrl",fixture().get("apkUrl")+"?redirect=bad"}};
  for(Object[] c:cases){Map<String,Object> data=fixture();data.put((String)c[0],c[1]);try{UpdateManifest.parse(data);fail("accepted invalid "+c[0]);}catch(IllegalArgumentException expected){}}
  Map<String,Object> extra=fixture();extra.put("accessToken","must-not-be-stored");try{UpdateManifest.parse(extra);fail("accepted secret/unknown field");}catch(IllegalArgumentException expected){}
 }
 @Test public void onlyNewerCompatibleDeviceVersionsAreEligible(){
  UpdateManifest m=UpdateManifest.parse(fixture());m.requireCompatible("com.resqnow1.app",11,24);
  for(Object[] c:new Object[][]{{"com.resqnow1.app",12L,36},{"com.resqnow1.app",13L,36},{"com.resqnow1.app",11L,23},{"other.app",11L,36}}){try{m.requireCompatible((String)c[0],(Long)c[1],(Integer)c[2]);fail("accepted incompatible device");}catch(IllegalArgumentException expected){}}
 }
 @Test public void rejectsMultipleControlCharactersInVersionLabel(){Map<String,Object> value=fixture();value.put("versionName","first\nsecond\n");try{UpdateManifest.parse(value);fail("control characters accepted");}catch(IllegalArgumentException expected){}}
}

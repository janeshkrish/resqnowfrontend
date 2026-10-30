package com.resqnow1.app.updates;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** PackageManager values, never filenames or release claims, authorize an update. */
public final class UpdateApkPolicy {
 public static final class Archive {
  public final String applicationId,versionName;public final long versionCode;public final int minSdk,targetSdk;public final Set<String> certificates;
  public Archive(String applicationId,long versionCode,String versionName,int minSdk,int targetSdk,Set<String> certificates){this.applicationId=applicationId;this.versionCode=versionCode;this.versionName=versionName;this.minSdk=minSdk;this.targetSdk=targetSdk;this.certificates=certificates==null?Collections.emptySet():Collections.unmodifiableSet(new HashSet<>(certificates));}
 }
 private UpdateApkPolicy(){}
 public static void requireRelease(UpdateManifest release,Archive installed,int deviceSdk){
  if(installed==null)throw invalid("update_package");release.requireCompatible(installed.applicationId,installed.versionCode,deviceSdk);
  if(installed.certificates.size()!=1||!installed.certificates.contains(release.signingCertificateSha256))throw invalid("update_signature");
 }
 public static void requireArchive(UpdateManifest release,Archive installed,Archive candidate,int deviceSdk){
  requireRelease(release,installed,deviceSdk);
  if(candidate==null||!release.applicationId.equals(candidate.applicationId))throw invalid("update_package");
  if(candidate.versionCode!=release.versionCode||!release.versionName.equals(candidate.versionName))throw invalid("update_version");
  if(candidate.minSdk!=release.minSdk||candidate.targetSdk!=release.targetSdk||candidate.minSdk>deviceSdk)throw invalid("update_sdk");
  if(candidate.certificates.size()!=1||!candidate.certificates.equals(installed.certificates))throw invalid("update_signature");
 }
 private static IllegalArgumentException invalid(String code){return new IllegalArgumentException(code);}
}

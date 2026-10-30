package com.resqnow1.app.updates;
import org.junit.Test;import static org.junit.Assert.*;import java.util.Collections;import java.util.HashSet;import java.util.Arrays;

public class UpdateApkPolicyTest {
 private UpdateApkPolicy.Archive installed(){return new UpdateApkPolicy.Archive("com.resqnow1.app",4,"1.3",24,36,Collections.singleton("b".repeat(64)));}
 private UpdateApkPolicy.Archive candidate(String id,long code,String name,int min,int target,String cert){return new UpdateApkPolicy.Archive(id,code,name,min,target,Collections.singleton(cert));}
 @Test public void acceptsOnlyTheAnnouncedAPKWithTheInstalledSigningIdentity(){UpdateManifest r=UpdateManifest.parse(UpdateManifestTest.fixture());UpdateApkPolicy.requireRelease(r,installed(),35);UpdateApkPolicy.requireArchive(r,installed(),candidate("com.resqnow1.app",12,"1.4.12",24,36,"b".repeat(64)),35);}
 @Test public void wrongPackageVersionSDKAndCertificateAreRejected(){
  UpdateManifest r=UpdateManifest.parse(UpdateManifestTest.fixture());Object[][] cases={{"other.app",12L,"1.4.12",24,36,"b".repeat(64)},{"com.resqnow1.app",11L,"1.4.12",24,36,"b".repeat(64)},{"com.resqnow1.app",13L,"1.4.12",24,36,"b".repeat(64)},{"com.resqnow1.app",12L,"wrong",24,36,"b".repeat(64)},{"com.resqnow1.app",12L,"1.4.12",25,36,"b".repeat(64)},{"com.resqnow1.app",12L,"1.4.12",24,35,"b".repeat(64)},{"com.resqnow1.app",12L,"1.4.12",24,36,"c".repeat(64)}};
  for(Object[] c:cases)try{UpdateApkPolicy.requireArchive(r,installed(),candidate((String)c[0],(Long)c[1],(String)c[2],(Integer)c[3],(Integer)c[4],(String)c[5]),35);fail("unannounced APK accepted");}catch(IllegalArgumentException expected){}
 }
 @Test public void unsupportedDeviceDowngradeUnsignedAndMultipleSignersAreRejected(){UpdateManifest r=UpdateManifest.parse(UpdateManifestTest.fixture());
  for(UpdateApkPolicy.Archive own:new UpdateApkPolicy.Archive[]{candidate("com.resqnow1.app",12,"1.4.12",24,36,"b".repeat(64)),new UpdateApkPolicy.Archive("com.resqnow1.app",4,"1.3",24,36,Collections.emptySet()),new UpdateApkPolicy.Archive("com.resqnow1.app",4,"1.3",24,36,new HashSet<>(Arrays.asList("b".repeat(64),"c".repeat(64)))),candidate("com.resqnow1.app",4,"1.3",24,36,"c".repeat(64))})try{UpdateApkPolicy.requireRelease(r,own,35);fail("untrusted installation accepted");}catch(IllegalArgumentException expected){}
  try{UpdateApkPolicy.requireRelease(r,installed(),23);fail("unsupported device accepted");}catch(IllegalArgumentException expected){}
 }
}

package com.resqnow1.app.updates;
import org.junit.Test;import static org.junit.Assert.*;import java.io.IOException;import java.net.HttpURLConnection;import java.net.URL;
public class AcceptanceConnectionFactoryTest {
 @Test public void mapsOnlyTheImmutableCanonicalFixtureAssetToOwnedEmulatorLoopback()throws Exception{
  HttpURLConnection connection=new AcceptanceConnectionFactory().open(new URL("https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v1006/resqnow.apk"));
  assertEquals("http://10.0.2.2:5198/assets/1006.apk",connection.getURL().toString());connection.disconnect();
 }
 @Test public void cannotBecomeAnArbitraryProxy()throws Exception{
  for(String value:new String[]{"http://github.com/janeshkrish/resqnowfrontend/releases/download/android-v1006/resqnow.apk","https://evil.test/resqnow.apk","https://github.com/another/repo/releases/download/android-v1006/resqnow.apk","https://github.com/janeshkrish/resqnowfrontend/releases/download/android-v1006/resqnow.apk?override=true"}){
   try{new AcceptanceConnectionFactory().open(new URL(value));fail("unapproved fixture address accepted");}catch(IOException expected){}
  }
 }
}

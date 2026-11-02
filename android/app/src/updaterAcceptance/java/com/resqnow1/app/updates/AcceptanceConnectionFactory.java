package com.resqnow1.app.updates;
import java.io.IOException;import java.net.HttpURLConnection;import java.net.URL;import java.util.regex.Matcher;import java.util.regex.Pattern;
/** Fixture build type only. Never compiled into release/default debug APKs. */
public final class AcceptanceConnectionFactory implements UpdateDownloader.ConnectionFactory {
 public HttpURLConnection open(URL url)throws IOException {
  Matcher match=Pattern.compile("https://github\\.com/janeshkrish/resqnowfrontend/releases/download/android-v([1-9][0-9]{0,9})/resqnow\\.apk").matcher(url.toString());
  if(!match.matches()||Long.parseLong(match.group(1))>2147483647L)throw new IOException("Unapproved acceptance asset");
  return (HttpURLConnection)new URL("http://10.0.2.2:5198/assets/"+match.group(1)+".apk").openConnection();
 }
}

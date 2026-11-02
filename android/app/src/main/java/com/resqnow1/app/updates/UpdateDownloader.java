package com.resqnow1.app.updates;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/** Bounded, restartable transport; the Android installer adds package/signature checks. */
public final class UpdateDownloader {
 public interface ConnectionFactory {HttpURLConnection open(URL url)throws IOException;}
 public interface Control {boolean cancelled();void progress(long bytes)throws IOException;void verifying()throws IOException;}
 public static final class InvalidApkException extends IOException {public InvalidApkException(String code){super(code);}}
 private static final Set<String> HOSTS=new HashSet<>(Arrays.asList("github.com","release-assets.githubusercontent.com","objects.githubusercontent.com","github-releases.githubusercontent.com"));
 private final ConnectionFactory connections;
 private volatile boolean stopped;
 private volatile HttpURLConnection active;
 public UpdateDownloader(){this(url->(HttpURLConnection)url.openConnection());}
 public UpdateDownloader(ConnectionFactory connections){this.connections=connections;}
 public void cancel(){stopped=true;HttpURLConnection connection=active;if(connection!=null)connection.disconnect();}
 public void download(UpdateManifest release,File partial,File verified,Control control)throws IOException {
  validateFiles(partial,verified);check(control);
  if(verified.exists()){
   try{control.progress(verified.length());verifyFile(release,verified,control);check(control);return;}
   catch(InvalidApkException invalid){remove(verified);throw invalid;}
  }
  if(partial.length()>release.sizeBytes)remove(partial);
  final long deadline=System.nanoTime()+TimeUnit.MINUTES.toNanos(8);
  for(int attempt=0;attempt<2;attempt++){
   check(control);long offset=partial.exists()?partial.length():0;control.progress(offset);
   if(offset==release.sizeBytes){try{verifyFile(release,partial,control);}catch(InvalidApkException e){remove(partial);throw e;}promote(partial,verified,control);return;}
   HttpURLConnection connection=null;
   try{
    connection=open(release.apkUrl,offset,control);int status=connection.getResponseCode();
    if(status!=200&&status!=206)throw new IOException("update_network");
    if(status==206&&(offset==0||!("bytes "+offset+"-"+(release.sizeBytes-1)+"/"+release.sizeBytes).equals(connection.getHeaderField("Content-Range")))){
     remove(partial);if(attempt==0)continue;throw new InvalidApkException("update_range");
    }
    if(status==200)offset=0;
    long remaining=release.sizeBytes-offset;String header=connection.getHeaderField("Content-Length");
    if(header!=null){try{if(!header.matches("\\d+")||Long.parseLong(header)!=remaining)throw new NumberFormatException();}catch(NumberFormatException e){remove(partial);throw new InvalidApkException("update_size");}}
    long written=offset;
    try(InputStream input=connection.getInputStream();FileOutputStream output=new FileOutputStream(partial,offset>0)){
     byte[] buffer=new byte[65536];int n;
     while((n=input.read(buffer))!=-1){check(control);if(System.nanoTime()>deadline)throw new IOException("update_deadline");if(written+n>release.sizeBytes)throw new InvalidApkException("update_size");output.write(buffer,0,n);written+=n;control.progress(written);}
     output.getFD().sync();
    }
    check(control);if(written!=release.sizeBytes)throw new IOException("update_incomplete");
    verifyFile(release,partial,control);promote(partial,verified,control);return;
   }catch(InvalidApkException invalid){remove(partial);remove(verified);throw invalid;}
   finally{if(connection!=null)connection.disconnect();active=null;}
  }
  throw new InvalidApkException("update_range");
 }
 private HttpURLConnection open(String value,long offset,Control control)throws IOException {
  URL url=allowed(value);
  for(int redirect=0;redirect<=3;redirect++){
   check(control);HttpURLConnection connection=connections.open(url);active=connection;
   connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setRequestProperty("Accept","application/vnd.android.package-archive");connection.setRequestProperty("Accept-Encoding","identity");if(offset>0)connection.setRequestProperty("Range","bytes="+offset+"-");
   int status;
   try{status=connection.getResponseCode();}catch(IOException e){connection.disconnect();throw e;}
   if(status!=301&&status!=302&&status!=303&&status!=307&&status!=308)return connection;
   String location=connection.getHeaderField("Location");connection.disconnect();
   if(location==null||redirect==3)throw new InvalidApkException("update_redirect");
   url=allowed(new URL(url,location).toString());
  }
  throw new InvalidApkException("update_redirect");
 }
 private static URL allowed(String value)throws IOException {
  URL url=new URL(value);
  if(!url.getProtocol().equals("https")||!HOSTS.contains(url.getHost())||url.getUserInfo()!=null||url.getRef()!=null||url.getPort()!=-1&&url.getPort()!=443)throw new InvalidApkException("update_origin");return url;
 }
 private void check(Control control)throws InterruptedIOException {if(stopped||Thread.currentThread().isInterrupted()||control.cancelled())throw new InterruptedIOException("update_cancelled");}
 public static void verifyFile(UpdateManifest release,File file,Control control)throws IOException {
  if(!file.isFile()||file.length()!=release.sizeBytes)throw new InvalidApkException("update_size");
  if(control.cancelled())throw new InterruptedIOException("update_cancelled");control.verifying();
  try{
   MessageDigest digest=MessageDigest.getInstance("SHA-256");
   try(InputStream input=new FileInputStream(file)){byte[] buffer=new byte[65536];int n;while((n=input.read(buffer))!=-1){if(control.cancelled()||Thread.currentThread().isInterrupted())throw new InterruptedIOException("update_cancelled");digest.update(buffer,0,n);}}
   StringBuilder hex=new StringBuilder();for(byte b:digest.digest()){hex.append(Character.forDigit((b&255)>>>4,16));hex.append(Character.forDigit(b&15,16));}
   if(!release.sha256.equals(hex.toString()))throw new InvalidApkException("update_checksum");
  }catch(NoSuchAlgorithmException unavailable){throw new IOException("update_crypto");}
 }
 private void promote(File partial,File verified,Control control)throws IOException {check(control);if(verified.exists())remove(verified);if(!partial.renameTo(verified))throw new IOException("update_storage");}
 private static void validateFiles(File partial,File verified)throws IOException {
  File parent=partial.getParentFile();if(parent==null||!parent.getCanonicalFile().equals(verified.getParentFile().getCanonicalFile())||partial.getCanonicalFile().equals(verified.getCanonicalFile()))throw new IOException("update_cache_path");
  if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("update_storage");
  if(!partial.getCanonicalFile().getParentFile().equals(parent.getCanonicalFile())||!verified.getCanonicalFile().getParentFile().equals(parent.getCanonicalFile()))throw new IOException("update_cache_path");
 }
 private static void remove(File file)throws IOException {if(file.exists()&&!file.delete())throw new IOException("update_storage");}
}

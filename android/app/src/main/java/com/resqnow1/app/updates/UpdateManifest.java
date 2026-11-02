package com.resqnow1.app.updates;

import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TimeZone;

/** Strict shared release contract. Never trusts an APK URL supplied independently. */
public final class UpdateManifest {
 public static final String APPLICATION_ID="com.resqnow1.app";
 public static final String REPOSITORY="janeshkrish/resqnowfrontend";
 static final String[] FIELDS={"schemaVersion","channel","applicationId","versionCode","versionName","minSdk","targetSdk","sizeBytes","sha256","signingCertificateSha256","apkUrl","sourceCommit","publishedAt"};
 private static final Set<String> NUMBERS=new HashSet<>(Arrays.asList("schemaVersion","versionCode","minSdk","targetSdk","sizeBytes"));
 public final String applicationId,versionName,sha256,signingCertificateSha256,apkUrl,sourceCommit,publishedAt;
 public final int versionCode,minSdk,targetSdk;
 public final long sizeBytes;
 private final Map<String,Object> values;

 private UpdateManifest(Map<String,Object> input){
  if(input==null||input.size()!=FIELDS.length||!input.keySet().containsAll(Arrays.asList(FIELDS)))throw invalid();
  if(number(input,"schemaVersion",1,1)!=1||!"stable".equals(input.get("channel"))||!APPLICATION_ID.equals(input.get("applicationId")))throw invalid();
  applicationId=APPLICATION_ID;versionCode=(int)number(input,"versionCode",1,Integer.MAX_VALUE);
  versionName=text(input,"versionName");if(versionName.trim().isEmpty()||versionName.length()>60)throw invalid();
  for(int i=0;i<versionName.length();i++)if(versionName.charAt(i)<32||versionName.charAt(i)==127)throw invalid();
  minSdk=(int)number(input,"minSdk",24,100);targetSdk=(int)number(input,"targetSdk",minSdk,100);sizeBytes=number(input,"sizeBytes",1,200L*1024*1024);
  sha256=text(input,"sha256");signingCertificateSha256=text(input,"signingCertificateSha256");sourceCommit=text(input,"sourceCommit");
  if(!sha256.matches("[a-f0-9]{64}")||!signingCertificateSha256.matches("[a-f0-9]{64}")||!sourceCommit.matches("[a-f0-9]{40}"))throw invalid();
  apkUrl=text(input,"apkUrl");if(!apkUrl.equals("https://github.com/"+REPOSITORY+"/releases/download/android-v"+versionCode+"/resqnow.apk"))throw invalid();
  publishedAt=text(input,"publishedAt");if(!publishedAt.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z"))throw invalid();
  String seconds=publishedAt.replaceFirst("\\.\\d{1,3}Z$","Z");SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'",Locale.ROOT);format.setLenient(false);format.setTimeZone(TimeZone.getTimeZone("UTC"));ParsePosition position=new ParsePosition(0);
  if(format.parse(seconds,position)==null||position.getIndex()!=seconds.length())throw invalid();
  values=new LinkedHashMap<>();for(String field:FIELDS)values.put(field,input.get(field));
  // Normalize JSON Number implementations so persisted and bridge values agree.
  values.put("schemaVersion",1);values.put("versionCode",versionCode);values.put("minSdk",minSdk);values.put("targetSdk",targetSdk);values.put("sizeBytes",sizeBytes);
 }
 public static UpdateManifest parse(Map<String,Object> input){return new UpdateManifest(input);}
 public Map<String,Object> toMap(){return new LinkedHashMap<>(values);}
 public Properties toProperties(){Properties p=new Properties();for(Map.Entry<String,Object> e:values.entrySet())p.setProperty(e.getKey(),String.valueOf(e.getValue()));return p;}
 public static UpdateManifest fromProperties(Properties properties){
  Map<String,Object> map=new HashMap<>();for(String field:FIELDS){String value=properties.getProperty(field);if(value==null)throw invalid();try{map.put(field,NUMBERS.contains(field)?Long.valueOf(value):value);}catch(NumberFormatException e){throw invalid();}}return parse(map);
 }
 public void requireCompatible(String installedPackage,long installedVersion,int deviceSdk){if(!applicationId.equals(installedPackage)||versionCode<=installedVersion||minSdk>deviceSdk)throw new IllegalArgumentException("Android update is not compatible with this installation");}
 private static long number(Map<String,Object> input,String field,long min,long max){Object value=input.get(field);if(!(value instanceof Number))throw invalid();Number n=(Number)value;long result=n.longValue();if(!Double.isFinite(n.doubleValue())||n.doubleValue()!=result||result<min||result>max)throw invalid();return result;}
 private static String text(Map<String,Object> input,String field){Object value=input.get(field);if(!(value instanceof String))throw invalid();return (String)value;}
 private static IllegalArgumentException invalid(){return new IllegalArgumentException("Invalid Android release manifest");}
}

package com.resqnow1.app;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.Properties;
import java.util.UUID;

/** Pure state machine; Android supplies crash-safe, private no-backup persistence. */
public final class AppInstallationStore {
 public interface Persistence { Properties read() throws IOException; void write(Properties properties) throws IOException; }
 private static final Object LOCK=new Object();
 private final Persistence disk;
 public AppInstallationStore(Persistence disk){this.disk=disk;}
 public Properties get() throws IOException {synchronized(LOCK){return read();}}
 private Properties read() throws IOException {
  Properties p=disk.read();
  if(p==null){
   p=new Properties();p.setProperty("schema","1");p.setProperty("installationId",UUID.randomUUID().toString());
   byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);StringBuilder proof=new StringBuilder();for(byte b:bytes)proof.append(String.format("%02x",b&255));
   p.setProperty("installationSecret",proof.toString());p.setProperty("consentRevision","0");p.setProperty("acknowledgedRevision","0");p.setProperty("pendingWithdrawalRevision","0");p.setProperty("consentPolicyVersion","");
   for(String key:new String[]{"consentGranted","consentDecided","everConsented"})p.setProperty(key,"false");disk.write(p);
  }
  try{
   if(!"1".equals(p.getProperty("schema"))||!p.getProperty("installationId","").matches("[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}")||!p.getProperty("installationSecret","").matches("[a-f0-9]{64}"))throw new IllegalArgumentException();
   long revision=Long.parseLong(p.getProperty("consentRevision")),ack=Long.parseLong(p.getProperty("acknowledgedRevision"));
   if(revision<0||revision>2147483647L||ack<0||ack>revision)throw new IllegalArgumentException();
   for(String key:new String[]{"consentGranted","consentDecided","everConsented"})if(!"true".equals(p.getProperty(key))&&!"false".equals(p.getProperty(key)))throw new IllegalArgumentException();
   // Older schema-1 state can have an unacknowledged current withdrawal.
   if(!p.containsKey("pendingWithdrawalRevision"))p.setProperty("pendingWithdrawalRevision",Boolean.parseBoolean(p.getProperty("everConsented"))&&!Boolean.parseBoolean(p.getProperty("consentGranted"))&&revision>ack?Long.toString(revision):"0");
   long pending=Long.parseLong(p.getProperty("pendingWithdrawalRevision"));if(pending<0||pending>revision)throw new IllegalArgumentException();
  }catch(RuntimeException e){throw new IOException("Analytics identity is unavailable");}
  return p;
 }
 public Properties setConsent(boolean granted,String policy) throws IOException {synchronized(LOCK){
  if(policy==null||!policy.matches("\\d{4}-\\d{2}-\\d{2}"))throw new IOException("Invalid analytics policy");
  Properties p=read();
  if("true".equals(p.getProperty("consentDecided"))&&Boolean.toString(granted).equals(p.getProperty("consentGranted"))&&policy.equals(p.getProperty("consentPolicyVersion")))return p;
  long revision=Long.parseLong(p.getProperty("consentRevision"))+1;if(revision>2147483647L)throw new IOException("Analytics preference unavailable");
  p.setProperty("consentRevision",Long.toString(revision));p.setProperty("consentGranted",Boolean.toString(granted));p.setProperty("consentDecided","true");p.setProperty("consentPolicyVersion",policy);if(granted)p.setProperty("everConsented","true");else if(Boolean.parseBoolean(p.getProperty("everConsented")))p.setProperty("pendingWithdrawalRevision",Long.toString(revision));disk.write(p);return p;
 }}
 public void acknowledge(long revision) throws IOException {acknowledge(revision,false);}
 public void acknowledge(long revision,boolean withdrawal) throws IOException {synchronized(LOCK){
  Properties p=read();if(revision<0||revision>Long.parseLong(p.getProperty("consentRevision")))return;
  if(withdrawal){if(revision!=Long.parseLong(p.getProperty("pendingWithdrawalRevision")))return;p.setProperty("pendingWithdrawalRevision","0");}
  if(revision>Long.parseLong(p.getProperty("acknowledgedRevision")))p.setProperty("acknowledgedRevision",Long.toString(revision));disk.write(p);
 }}
}

package com.resqnow1.app;
import org.junit.Test;
import java.io.IOException;
import java.util.Properties;
import java.util.concurrent.*;
import static org.junit.Assert.*;
public class AppInstallationStoreTest {
 private static class Disk implements AppInstallationStore.Persistence {
  Properties data;
  public Properties read(){return data==null?null:(Properties)data.clone();}
  public void write(Properties p){data=(Properties)p.clone();}
 }
 @Test public void restartUpgradeAndConcurrentReadersKeepOneIdentity() throws Exception {
  Disk disk=new Disk();AppInstallationStore s=new AppInstallationStore(disk);
  String id=s.get().getProperty("installationId");
  assertEquals(64,s.get().getProperty("installationSecret").length());
  ExecutorService readers=Executors.newFixedThreadPool(20);
  try {
   java.util.List<Future<String>> results=new java.util.ArrayList<>();
   for(int i=0;i<20;i++)results.add(readers.submit(()->new AppInstallationStore(disk).get().getProperty("installationId")));
   for(Future<String> result:results)assertEquals(id,result.get(5,TimeUnit.SECONDS));
  } finally {readers.shutdownNow();}
  assertEquals(id,new AppInstallationStore(disk).get().getProperty("installationId"));
  assertNotEquals(id,new AppInstallationStore(new Disk()).get().getProperty("installationId"));
 }
 @Test public void consentRevisionsPersistAndLateAcknowledgementCannotGrantConsent() throws Exception {
  Disk d=new Disk();AppInstallationStore s=new AppInstallationStore(d);
  assertEquals("false",s.get().getProperty("consentGranted"));
  s.setConsent(true,"2026-10-27");s.setConsent(false,"2026-10-27");s.acknowledge(1);
  Properties p=new AppInstallationStore(d).get();assertEquals("false",p.getProperty("consentGranted"));assertEquals("2",p.getProperty("consentRevision"));assertEquals("true",p.getProperty("everConsented"));
  s.setConsent(true,"2026-10-27");assertEquals("3",s.get().getProperty("consentRevision"));
 }
 @Test public void corruptIdentityNeverSilentlyCreatesANewInstallation() throws Exception {
  Disk d=new Disk();AppInstallationStore s=new AppInstallationStore(d);s.get();d.data.setProperty("installationSecret","bad");
  try{s.get();fail("Corrupt identity should disable analytics");}catch(IOException expected){assertFalse(expected.getMessage().contains("bad"));}
 }
 @Test public void offlineReconsentRetainsWithdrawalUntilItsOwnAcknowledgement() throws Exception {
  Disk d=new Disk();AppInstallationStore s=new AppInstallationStore(d);s.setConsent(true,"2026-10-27");s.acknowledge(1);
  s.setConsent(false,"2026-10-27");s.setConsent(true,"2026-10-27");
  Properties afterRestart=new AppInstallationStore(d).get();assertEquals("3",afterRestart.getProperty("consentRevision"));assertEquals("2",afterRestart.getProperty("pendingWithdrawalRevision"));
  s.acknowledge(3);assertEquals("2",s.get().getProperty("pendingWithdrawalRevision"));
  s.setConsent(false,"2026-10-27");s.setConsent(true,"2026-10-27");s.acknowledge(2,true);assertEquals("4",s.get().getProperty("pendingWithdrawalRevision"));
  s.acknowledge(4,true);assertEquals("0",new AppInstallationStore(d).get().getProperty("pendingWithdrawalRevision"));assertEquals("true",s.get().getProperty("consentGranted"));
 }
}

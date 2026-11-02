package com.resqnow1.app.updates;

/** A safe-screen decision can be revoked while file verification runs off-thread. */
public final class UpdateInstallGuard {
 private long sequence,owner;private boolean busy;
 public synchronized long begin(){if(busy)throw new IllegalStateException("install_busy");owner=++sequence;busy=true;return owner;}
 public synchronized void cancel(){sequence++;}
 public synchronized boolean current(long token){return busy&&owner==token&&sequence==token;}
 public synchronized void finish(long token){if(owner==token)busy=false;}
}

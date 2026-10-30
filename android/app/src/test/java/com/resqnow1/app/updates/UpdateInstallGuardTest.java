package com.resqnow1.app.updates;
import org.junit.Test;import static org.junit.Assert.*;

public class UpdateInstallGuardTest {
 @Test public void aRouteOrLifecycleChangeInvalidatesPendingPreparation(){UpdateInstallGuard g=new UpdateInstallGuard();long first=g.begin();assertTrue(g.current(first));g.cancel();assertFalse(g.current(first));g.finish(first);long second=g.begin();assertTrue(g.current(second));g.finish(first);assertTrue(g.current(second));g.finish(second);assertFalse(g.current(second));}
 @Test public void doubleTapsCannotQueueMultipleInstallerActivities(){UpdateInstallGuard g=new UpdateInstallGuard();long token=g.begin();try{g.begin();fail("duplicate installer preparation accepted");}catch(IllegalStateException expected){}g.finish(token);assertTrue(g.current(g.begin()));}
}

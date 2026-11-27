package com.resqnow1.app.updates;
import org.junit.Test;import static org.junit.Assert.*;
import java.util.Arrays;import java.util.Collections;

public class UpdateAlertPolicyTest {
 @Test public void alertsOncePerVersionWhenTheAppIsClosedAndNobodyIsBeingHelped(){
  assertTrue(UpdateAlertPolicy.shouldNotify(8,0,false,false,true,Collections.emptyList()));
  assertTrue(UpdateAlertPolicy.shouldNotify(9,8,false,false,true,Arrays.asList("updates")));
  assertFalse("same version twice",UpdateAlertPolicy.shouldNotify(8,8,false,false,true,null));
  assertFalse("older version",UpdateAlertPolicy.shouldNotify(7,8,false,false,true,null));
  assertFalse("no version",UpdateAlertPolicy.shouldNotify(0,0,false,false,true,null));
 }
 @Test public void staysQuietOnScreenWithoutPermissionOrWhileTheAppSaysWorkIsUnfinished(){
  assertFalse("the in-app banner speaks instead",UpdateAlertPolicy.shouldNotify(8,0,true,false,true,null));
  assertFalse("request or job unfinished",UpdateAlertPolicy.shouldNotify(8,0,false,true,true,null));
  assertFalse("notifications not allowed",UpdateAlertPolicy.shouldNotify(8,0,false,false,false,null));
 }
 @Test public void neverInterruptsALiveTripAJobOfferOrAnActiveJob(){
  for(String busy:new String[]{"trip_live","trip_alerts","job_offers","live_location_tracking"})
   assertFalse(busy,UpdateAlertPolicy.shouldNotify(8,0,false,false,true,Arrays.asList("updates",busy)));
 }
}

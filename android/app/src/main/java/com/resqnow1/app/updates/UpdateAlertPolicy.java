package com.resqnow1.app.updates;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * When "A new ResQNow is ready" may be posted: once per version, never while the app is on screen
 * (its own banner says it there), and never in the middle of help: a live trip, a job offer, an
 * active job or a request the app has said is unfinished.
 */
public final class UpdateAlertPolicy {
 /** Channels whose notifications mean someone is being helped right now. */
 public static final Set<String> BUSY_CHANNELS=Collections.unmodifiableSet(new HashSet<>(Arrays.asList("job_offers","trip_live","trip_alerts","live_location_tracking")));
 private UpdateAlertPolicy(){}
 public static boolean shouldNotify(long versionCode,long alreadyAlertedVersion,boolean appOnScreen,boolean quiet,boolean permitted,Collection<String> activeChannels){
  if(versionCode<=0||versionCode<=alreadyAlertedVersion||appOnScreen||quiet||!permitted)return false;
  if(activeChannels!=null)for(String channel:activeChannels)if(BUSY_CHANNELS.contains(channel))return false;
  return true;
 }
}

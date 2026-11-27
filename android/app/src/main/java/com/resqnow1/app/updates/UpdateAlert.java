package com.resqnow1.app.updates;

import android.Manifest;
import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.resqnow1.app.MainActivity;
import com.resqnow1.app.NotificationChannels;
import com.resqnow1.app.R;
import java.util.ArrayList;
import java.util.List;

/** The phone notification for a downloaded update. Opening it shows App updates in the app. */
public final class UpdateAlert {
 public static final String EXTRA_OPEN_UPDATES="com.resqnow1.app.OPEN_APP_UPDATES";
 static final int NOTIFICATION_ID=0x0A99;
 private static final String PREFS="resqnow_update_alerts";
 private static final String KEY_ALERTED="alertedVersionCode",KEY_QUIET="quiet";
 private UpdateAlert(){}

 private static SharedPreferences prefs(Context context){return context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}

 /** The app says when a request or job is unfinished; the alert waits until it is not. */
 public static void setQuiet(Context context,boolean quiet){prefs(context).edit().putBoolean(KEY_QUIET,quiet).apply();}

 /** Posts the alert if the policy allows. Never throws: an alert must not affect the download. */
 public static boolean maybeNotify(Context context,UpdateManifest release){
  try{
   SharedPreferences p=prefs(context);
   boolean permitted=NotificationManagerCompat.from(context).areNotificationsEnabled()&&(Build.VERSION.SDK_INT<33||ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);
   if(!UpdateAlertPolicy.shouldNotify(release.versionCode,p.getLong(KEY_ALERTED,0L),appOnScreen(),p.getBoolean(KEY_QUIET,false),permitted,activeChannels(context)))return false;
   NotificationChannels.ensureAll(context);
   PendingIntent open=PendingIntent.getActivity(context,NOTIFICATION_ID,openIntent(context),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   PendingIntent later=PendingIntent.getBroadcast(context,NOTIFICATION_ID,new Intent(context,UpdateAlertReceiver.class).setAction(UpdateAlertReceiver.ACTION_LATER),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   String body="Version "+release.versionName+" is downloaded. Say “Hey ResQNow” to call Thozhan, now in the app too.";
   Notification notification=new NotificationCompat.Builder(context,NotificationChannels.APP_UPDATES)
    .setSmallIcon(R.drawable.ic_stat_resqnow)
    .setColor(ContextCompat.getColor(context,R.color.resq_crimson))
    .setContentTitle("A new ResQNow is ready")
    .setContentText(body)
    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
    .setSubText("App update")
    .setPriority(NotificationCompat.PRIORITY_HIGH)
    .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
    .setOnlyAlertOnce(true)
    .setAutoCancel(true)
    .setContentIntent(open)
    .addAction(0,"Update now",open)
    .addAction(0,"Later",later)
    .build();
   NotificationManagerCompat.from(context).notify(NOTIFICATION_ID,notification);
   p.edit().putLong(KEY_ALERTED,release.versionCode).apply();
   return true;
  }catch(Exception | LinkageError unavailable){return false;}
 }

 public static void cancel(Context context){try{NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);}catch(Exception ignored){/* nothing to take down */}}

 static Intent openIntent(Context context){return new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(EXTRA_OPEN_UPDATES,true);}

 private static boolean appOnScreen(){
  ActivityManager.RunningAppProcessInfo info=new ActivityManager.RunningAppProcessInfo();ActivityManager.getMyMemoryState(info);
  return info.importance==ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND||info.importance==ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
 }

 private static List<String> activeChannels(Context context){
  List<String> channels=new ArrayList<>();
  NotificationManager manager=context.getSystemService(NotificationManager.class);if(manager==null||Build.VERSION.SDK_INT<26)return channels;
  for(StatusBarNotification shown:manager.getActiveNotifications()){String id=shown.getNotification().getChannelId();if(id!=null)channels.add(id);}
  return channels;
 }
}

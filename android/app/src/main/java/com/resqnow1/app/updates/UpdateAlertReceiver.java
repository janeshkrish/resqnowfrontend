package com.resqnow1.app.updates;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** "Later" on the update notification: it goes away; the app still offers the update. */
public final class UpdateAlertReceiver extends BroadcastReceiver {
 static final String ACTION_LATER="com.resqnow1.app.UPDATE_ALERT_LATER";
 @Override public void onReceive(Context context,Intent intent){if(intent!=null&&ACTION_LATER.equals(intent.getAction()))UpdateAlert.cancel(context);}
}

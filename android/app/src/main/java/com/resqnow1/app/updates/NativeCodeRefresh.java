package com.resqnow1.app.updates;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.WebView;
import com.getcapacitor.WebViewListener;
import com.resqnow1.app.R;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** Refreshes packaged code only. Never clears cookies, accounts, databases or analytics identity. */
public final class NativeCodeRefresh extends WebViewListener {
 private final Context context;private final SharedPreferences preferences;
 public NativeCodeRefresh(Context context){this.context=context;preferences=context.getSharedPreferences("resqnow_native_code",Context.MODE_PRIVATE);}
 private static boolean local(WebView view){try{Uri uri=Uri.parse(view.getUrl());return (uri.getScheme().equals("http")||uri.getScheme().equals("https"))&&"localhost".equals(uri.getHost())&&uri.getPort()==-1&&uri.getUserInfo()==null;}catch(Exception invalid){return false;}}
 @Override public void onPageLoaded(WebView view){
  if(!local(view))return;
  try{
   long code=UpdateInstaller.installed(context).versionCode;if(preferences.getLong("version",-1)==code)return;
   String script;try(InputStream input=context.getResources().openRawResource(R.raw.native_update_bootstrap);ByteArrayOutputStream bytes=new ByteArrayOutputStream()){byte[] buffer=new byte[2048];int n;while((n=input.read(buffer))!=-1){if(bytes.size()+n>16384)return;bytes.write(buffer,0,n);}script=new String(bytes.toByteArray(),StandardCharsets.UTF_8).replace("__NATIVE_VERSION__",Long.toString(code));}
   view.evaluateJavascript(script,ignored->poll(view,code,0));
  }catch(Exception ignored){/* Retry at next local page load; never break startup. */}
 }
 private void poll(WebView view,long code,int attempt){
  if(attempt>=20||!local(view))return;
  view.evaluateJavascript("window.__resqnowNativeCode && window.__resqnowNativeCode.phase",phase->{
   if("\"done\"".equals(phase))preferences.edit().putLong("version",code).apply();
   else if(!"\"failed\"".equals(phase))view.postDelayed(()->poll(view,code,attempt+1),250);
  });
 }
}

package com.resqnow1.app.maps;

import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.mappls.sdk.core.manager.MapplsCoreManager;
import com.mappls.sdk.maps.Mappls;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name="ResqnowMappls")
public final class ResqnowMapplsPlugin extends Plugin {
    private static final int MAX_MAPS=4, MAX_OWNERS=128;
    private final Map<String,MapRenderer> maps=new HashMap<>();
    private final Map<String,Long> generations=new HashMap<>();
    private Bundle restored=new Bundle();
    private MapHostLayout host;
    private final MapSearch search=new MapSearch();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final MapSdkStartup startup=new MapSdkStartup(
        ()->MapplsCoreManager.getInstance().getPublicConfigData()!=null,
        new MapSdkStartup.Scheduler() {
            @Override public long now() { return SystemClock.uptimeMillis(); }
            @Override public void post(Runnable task,long delay) { handler.postDelayed(task,delay); }
            @Override public void remove(Runnable task) { handler.removeCallbacks(task); }
        },MAX_MAPS);
    @Override public void load() {
        WebView web=getBridge().getWebView();
        if(web.getParent() instanceof MapHostLayout) { host=(MapHostLayout)web.getParent(); host.attach(web); }
        getBridge().addWebViewListener(new MapNavigationListener(this::destroyAll,
            ()->{generations.clear();restored.clear();},ResqnowMapplsPlugin::trusted));
    }
    private static boolean trusted(String value) {
        if(value==null) return false;
        try {
            Uri uri=Uri.parse(value); String scheme=uri.getScheme();
            return ("https".equals(scheme) || "http".equals(scheme)) && "localhost".equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo()==null && (uri.getPort()==-1 || ("https".equals(scheme) ? uri.getPort()==443 : uri.getPort()==80));
        } catch(RuntimeException ignored) { return false; }
    }
    private interface Action { void run(); }
    private void execute(PluginCall call,Action action) {
        getActivity().runOnUiThread(()->{
            try {
                if(!trusted(getBridge().getWebView().getUrl())) throw new MapFailure("UNTRUSTED_ORIGIN");
                if(call.getData().toString().length()>3_000_000) throw new MapFailure("LIMIT");
                action.run();
            } catch(MapFailure failure) { call.reject(failure.getMessage(),failure.code); }
            catch(RuntimeException failure) {
                // QA diagnostics contain types/frames only: exception messages can contain provider secrets.
                if(com.resqnow1.app.BuildConfig.DEBUG) {
                    Throwable cause=failure;
                    for(int depth=0;cause!=null && depth<3;depth++,cause=cause.getCause()) {
                        android.util.Log.w("ResqnowMappls","SDK_INIT type="+cause.getClass().getName());
                        StackTraceElement[] frames=cause.getStackTrace();
                        for(int i=0;i<Math.min(6,frames.length);i++) android.util.Log.d("ResqnowMappls",frames[i].toString());
                    }
                }
                call.reject("Native map operation failed (SDK_INIT).","SDK_INIT");
            }
        });
    }
    private MapRenderer owner(JSONObject data) {
        String id=MapPayload.id(data,"mapId"); long generation=MapPayload.revision(data,"generation");
        MapRenderer renderer=maps.get(id);
        if(renderer==null || !renderer.state.accepts(generation)) throw new MapFailure("STALE_HANDLE");
        renderer.check(); return renderer;
    }
    @PluginMethod public void getAvailability(PluginCall call) {
        execute(call,()->{
            String code=MapAuth.unavailable(getContext()); if(host==null && code==null) code="SDK_INIT";
            JSObject result=new JSObject().put("available",code==null).put("sdkVersion","9.0.4")
                .put("authentication",com.resqnow1.app.BuildConfig.MAPPLS_CONFIGURED ? "unverified" : "missing")
                .put("capabilities",new JSObject().put("nativeSearch",true).put("markers",true).put("polylines",true).put("circles",true));
            if(code!=null) result.put("code",code); call.resolve(result);
        });
    }
    @PluginMethod public void create(PluginCall call) {
        execute(call,()->{
            JSONObject data=call.getData(); String id=MapPayload.id(data,"mapId"); long generation=MapPayload.revision(data,"generation");
            String label=MapPayload.text(data,"ariaLabel","Map");
            JSONObject camera=data.optJSONObject("initialCamera"); if(data.has("initialCamera")) { MapPayload.require(camera!=null); MapPayload.camera(camera); }
            String unavailable=MapAuth.unavailable(getContext()); if(unavailable!=null) throw new MapFailure(unavailable);
            if(host==null) throw new MapFailure("SDK_INIT");
            // In 9.0.4 this starts a worker. MapView's constructor decrypts the config synchronously.
            Mappls.getInstance(getContext());
            startup.await(()->execute(call,()->createMap(call,id,generation,label,camera)),code->{
                String message="SDK_INIT".equals(code) ? "Mappls Android SDK configuration did not become ready." : new MapFailure(code).getMessage();
                call.reject(message,code);
            });
        });
    }
    private void createMap(PluginCall call,String id,long generation,String label,JSONObject camera) {
        if(generation<=generations.getOrDefault(id,-1L)) throw new MapFailure("STALE_HANDLE");
        if(!generations.containsKey(id) && generations.size()>=MAX_OWNERS) throw new MapFailure("LIMIT");
        if(!maps.containsKey(id) && maps.size()>=MAX_MAPS) throw new MapFailure("LIMIT");
        MapRenderer previous=maps.remove(id); if(previous!=null) previous.destroy();
        MapRenderer renderer=new MapRenderer(host,id,generation,label,restored.getBundle(id),event->notifyListeners("mapEvent",event));
        restored.remove(id); maps.put(id,renderer); generations.put(id,generation);
        try {
            if(camera!=null) renderer.camera(camera);
            Lifecycle.State lifecycle=getActivity().getLifecycle().getCurrentState();
            if(lifecycle.isAtLeast(Lifecycle.State.STARTED)) renderer.start();
            if(lifecycle.isAtLeast(Lifecycle.State.RESUMED)) renderer.resume();
            renderer.initialize();
            call.resolve(new JSObject().put("mapId",id).put("generation",generation));
        } catch(RuntimeException e) { maps.remove(id); renderer.destroy(); throw e; }
    }
    @PluginMethod public void destroy(PluginCall call) {
        execute(call,()->{
            String id=MapPayload.id(call.getData(),"mapId"); long generation=MapPayload.revision(call.getData(),"generation");
            MapRenderer renderer=maps.get(id);
            if(renderer!=null) {
                if(!renderer.state.accepts(generation)) throw new MapFailure("STALE_HANDLE");
                maps.remove(id); renderer.destroy();
            }
            if(!generations.containsKey(id) && generations.size()>=MAX_OWNERS) throw new MapFailure("LIMIT");
            generations.put(id,Math.max(generation,generations.getOrDefault(id,-1L)));
            call.resolve();
        });
    }
    private interface Mutation { void run(MapRenderer renderer); }
    private void mutate(PluginCall call,Mutation mutation) {
        execute(call,()->{
            MapRenderer renderer=owner(call.getData());
            try { mutation.run(renderer); call.resolve(); }
            catch(MapFailure failure) { throw failure; }
            catch(RuntimeException failure) { renderer.fail("RENDER"); throw new MapFailure("RENDER"); }
        });
    }
    @PluginMethod public void setViewport(PluginCall call) { mutate(call,renderer->renderer.viewport(call.getData())); }
    @PluginMethod public void setOverlays(PluginCall call) { mutate(call,renderer->renderer.overlays(call.getData())); }
    @PluginMethod public void updatePositions(PluginCall call) { mutate(call,renderer->renderer.positions(call.getData())); }
    @PluginMethod public void setCamera(PluginCall call) { mutate(call,renderer->renderer.camera(MapPayload.object(call.getData(),"camera"))); }
    @PluginMethod public void setVisibility(PluginCall call) {
        mutate(call,renderer->renderer.visibility(MapPayload.bool(call.getData(),"visible"),MapPayload.bool(call.getData(),"interactive")));
    }
    @PluginMethod public void searchPlaces(PluginCall call) {
        execute(call,()->{
            String unavailable=MapAuth.unavailable(getContext()); if(unavailable!=null) throw new MapFailure(unavailable);
            Mappls.getInstance(getContext()); search.search(call);
        });
    }
    @PluginMethod public void cancelSearch(PluginCall call) { execute(call,()->{ search.cancel(MapPayload.id(call.getData(),"requestId")); call.resolve(); }); }
    public void saveMaps(Bundle out) {
        Bundle state=new Bundle(); for(MapRenderer renderer:maps.values()) state.putBundle(renderer.id,renderer.save());
        out.putBundle("resqnow.native.maps",state);
    }
    public void restoreMaps(Bundle state) {
        if(state!=null && state.getBundle("resqnow.native.maps")!=null) restored=state.getBundle("resqnow.native.maps");
    }
    public void lowMemory() { for(MapRenderer renderer:maps.values()) renderer.lowMemory(); }
    private void destroyAll() { startup.cancel(); search.destroy(); for(MapRenderer renderer:maps.values()) renderer.destroy(); maps.clear(); }
    @Override protected void handleOnStart() { for(MapRenderer renderer:maps.values()) renderer.start(); }
    @Override protected void handleOnResume() { for(MapRenderer renderer:maps.values()) renderer.resume(); }
    @Override protected void handleOnPause() { for(MapRenderer renderer:maps.values()) renderer.pause(); }
    @Override protected void handleOnStop() { for(MapRenderer renderer:maps.values()) renderer.stop(); }
    @Override protected void handleOnDestroy() { destroyAll(); generations.clear(); restored.clear(); }
}

package com.resqnow1.app.maps;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.mappls.sdk.maps.MapView;
import com.mappls.sdk.maps.MapplsMap;
import com.mappls.sdk.maps.MapplsMapOptions;
import com.mappls.sdk.maps.OnMapReadyCallback;
import com.mappls.sdk.maps.Style;
import com.mappls.sdk.maps.camera.CameraPosition;
import com.mappls.sdk.maps.camera.CameraUpdateFactory;
import com.mappls.sdk.maps.geometry.LatLng;
import com.mappls.sdk.maps.geometry.LatLngBounds;
import com.mappls.sdk.plugin.annotation.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;
import java.util.function.Consumer;

/** Displays shared scenes only. Does not collect GPS, call Railway, compute routes or own a socket. */
final class MapRenderer {
    final String id;
    final long generation;
    final MapState state;
    final MapView view;
    final MapHostLayout.Slot slot;
    private final MapHostLayout host;
    private final Consumer<JSObject> events;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable timeout=()->fail("TIMEOUT");
    private final MapState.ReadyBudget readyBudget=new MapState.ReadyBudget(20000);
    private boolean initializing;
    private MapplsMap map;
    private Style style;
    private SymbolManager symbols;
    private LineManager lines;
    private FillManager fills;
    private final Map<String,Symbol> markers=new HashMap<>();
    private final Map<Long,String> markerIds=new HashMap<>();
    private final Set<String> images=new HashSet<>();
    private JSONObject scene, camera;
    private final Map<String,JSONObject> pendingPositions=new HashMap<>();
    private boolean closed, started, resumed, ready, rendered;
    private long eventSequence, lastMarkerTap;
    private String failure;
    MapRenderer(MapHostLayout host,String id,long generation,String label,Bundle saved,Consumer<JSObject> events) {
        this.host=host; this.id=id; this.generation=generation; this.events=events; state=new MapState(generation);
        // TextureView is required for clipping and composition below the WebView.
        view=new MapView(host.getContext(),new MapplsMapOptions().textureMode(true).translucentTextureSurface(true));
        view.setContentDescription(label); slot=host.addMap(view);
        try { view.onCreate(saved); } catch(RuntimeException e) { host.removeMap(slot); throw e; }
        view.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{
            if(closed || failure!=null) return;
            try { applyCamera(); } catch(RuntimeException error) { fail("RENDER"); }
        });
    }
    void initialize() {
        view.addOnDidFailLoadingMapListener(message->fail("STYLE_LOAD"));
        view.addOnDidFinishRenderingMapListener(fully->{ if(fully && !closed) { rendered=true; maybeReady(); } });
        initializing=true; scheduleTimeout();
        view.getMapAsync(new OnMapReadyCallback() {
            @Override public void onMapError(int code,String message) {
                String safe=message==null ? "" : message.toLowerCase(Locale.ROOT);
                fail(safe.contains("licen") || safe.contains("signature") || safe.contains("auth") ? "LICENSE" : "SDK_INIT");
            }
            @Override public void onMapReady(MapplsMap nativeMap) {
                if(closed || failure!=null) return;
                map=nativeMap;
                map.addOnMapClickListener(point->{
                    if(android.os.SystemClock.uptimeMillis()-lastMarkerTap<150) return true;
                    emit("mapClick",new JSObject().put("position",position(point))); return true;
                });
                map.addOnMapLongClickListener(point->{ emit("mapLongClick",new JSObject().put("position",position(point))); return true; });
                map.addOnCameraMoveStartedListener(reason->{
                    if(reason==MapplsMap.OnCameraMoveStartedListener.REASON_API_GESTURE) emit("interaction",new JSObject().put("reason","gesture"));
                });
                map.addOnCameraIdleListener(()->{
                    CameraPosition p=map.getCameraPosition();
                    if(p.target!=null) emit("cameraIdle",new JSObject().put("center",position(p.target)).put("zoom",p.zoom).put("bearing",p.bearing).put("pitch",p.tilt)
                        .put("cameraRevision",state.appliedCameraRevision()));
                });
                map.getStyle(loaded->{
                    if(closed || failure!=null) return;
                    try {
                        style=loaded;
                        rendered=false;
                        fills=new FillManager(view,map,style); lines=new LineManager(view,map,style); symbols=new SymbolManager(view,map,style);
                        symbols.setIconAllowOverlap(true); symbols.setTextAllowOverlap(true);
                        symbols.addClickListener(symbol->{
                            String markerId=markerIds.get(symbol.getId());
                            if(markerId!=null) { lastMarkerTap=android.os.SystemClock.uptimeMillis(); emit("markerClick",new JSObject().put("markerId",markerId)); }
                            return true;
                        });
                        symbols.addDragListener(new OnSymbolDragListener() {
                            @Override public void onAnnotationDragStarted(Symbol symbol) { emit("interaction",new JSObject().put("reason","gesture")); }
                            @Override public void onAnnotationDrag(Symbol symbol) {}
                            @Override public void onAnnotationDragFinished(Symbol symbol) {
                                String markerId=markerIds.get(symbol.getId());
                                if(markerId!=null) emit("markerDragEnd",new JSObject().put("markerId",markerId).put("position",position(symbol.getPosition())));
                            }
                        });
                        drawScene(); applyPositions(); applyCamera(); maybeReady();
                    } catch(RuntimeException e) { fail("RENDER"); }
                });
            }
        });
    }
    private void maybeReady() {
        if(!closed && failure==null && symbols!=null && rendered && !ready) {
            ready=true; handler.removeCallbacks(timeout);
            emit("ready",new JSObject().put("capabilities",new JSObject().put("markers",true).put("polylines",true).put("circles",true)));
        }
    }
    void check() { if(closed) throw new MapFailure("STALE_HANDLE"); if(failure!=null) throw new MapFailure(failure); }
    void overlays(JSONObject data) {
        check(); MapPayload.scene(data);
        if(!state.advance("scene",MapPayload.revision(data,"revision"))) throw new MapFailure("STALE_HANDLE");
        scene=data; pendingPositions.clear(); drawScene();
    }
    void positions(JSONObject data) {
        check(); MapPayload.positions(data);
        JSONArray points=data.optJSONArray("points");
        // Bound the latest loading-state frame to existing scene IDs; no unbounded queue.
        Set<String> ids=new HashSet<>(); if(scene!=null) { JSONArray list=scene.optJSONArray("markers"); for(int i=0;i<list.length();i++) ids.add(list.optJSONObject(i).optString("id")); }
        for(int i=0;i<points.length();i++) { JSONObject p=points.optJSONObject(i); if(!ids.contains(p.optString("id"))) throw new MapFailure("INVALID_ARGUMENT"); }
        if(!state.advance("positions",MapPayload.revision(data,"frameSequence"))) throw new MapFailure("STALE_HANDLE");
        for(int i=0;i<points.length();i++) { JSONObject p=points.optJSONObject(i); pendingPositions.put(p.optString("id"),p); }
        applyPositions();
    }
    void camera(JSONObject data) {
        check(); MapPayload.camera(data);
        if(!state.advance("camera",MapPayload.revision(data,"revision"))) throw new MapFailure("STALE_HANDLE");
        camera=data; applyCamera();
    }
    void viewport(JSONObject data) {
        check(); long revision=MapPayload.revision(data,"layoutRevision");
        // Host validates the entire payload before mutating geometry.
        // Reject old geometry before host mutation, but commit revision only after validation.
        if(revision<=layoutRevision) throw new MapFailure("STALE_HANDLE");
        float previousScale=slot.scale;
        host.viewport(slot,data); layoutRevision=revision;
        if(previousScale!=slot.scale) { drawScene(); applyPositions(); }
        applyCamera();
    }
    private long layoutRevision=-1;
    void visibility(boolean visible,boolean interactive) { check(); host.visibility(slot,visible,interactive); }
    private void drawScene() {
        if(symbols==null || scene==null || closed || failure!=null) return;
        JSONArray markerList=scene.optJSONArray("markers");
        double pixels=0;
        for(int i=0;i<markerList.length();i++) {
            JSONObject m=markerList.optJSONObject(i);
            pixels+=m.optDouble("width",32)*m.optDouble("height",40)*slot.scale*slot.scale;
        }
        if(pixels>16_000_000) throw new MapFailure("LIMIT");
        symbols.clearAll(); lines.clearAll(); fills.clearAll(); markers.clear(); markerIds.clear();
        for(String image:images) style.removeImage(image); images.clear();
        JSONArray circleList=scene.optJSONArray("circles");
        for(int i=0;i<circleList.length();i++) {
            JSONObject c=circleList.optJSONObject(i); LatLng center=MapPayload.point(c.optJSONObject("center"));
            List<LatLng> ring=new ArrayList<>();
            for(double[] p:MapState.circle(center.getLatitude(),center.getLongitude(),c.optDouble("radiusMeters"))) ring.add(new LatLng(p[0],p[1]));
            fills.create(new FillOptions().points(Collections.singletonList(ring)).fillColor(c.optString("fillColor")).fillOpacity((float)c.optDouble("fillOpacity")));
        }
        JSONArray lineList=scene.optJSONArray("polylines");
        for(int i=0;i<lineList.length();i++) {
            JSONObject line=lineList.optJSONObject(i); List<LatLng> points=points(line.optJSONArray("points"));
            if(points.size()>1) lines.create(new LineOptions().points(points).lineColor(line.optString("color")).lineWidth((float)line.optDouble("width")*unitScale()).lineOpacity((float)line.optDouble("opacity")));
        }
        for(int i=0;i<markerList.length();i++) {
            JSONObject m=markerList.optJSONObject(i), visual=m.optJSONObject("visual"); String markerId=m.optString("id"), image="resqnow-"+markerId;
            Bitmap bitmap=icon(m,visual); style.addImage(image,bitmap); bitmap.recycle(); images.add(image);
            SymbolOptions options=new SymbolOptions().position(MapPayload.point(m.optJSONObject("position"))).icon(image)
                .iconSize(1f).iconAnchor(m.optString("anchor","bottom")).iconRotate((float)m.optDouble("heading",0))
                .symbolSortKey((float)m.optDouble("zIndex",0)).draggable(m.optBoolean("draggable",false));
            JSONArray offset=m.optJSONArray("offset");
            if(offset!=null) options.iconOffset(new Float[]{(float)offset.optDouble(0)*unitScale(),(float)offset.optDouble(1)*unitScale()});
            String label=visual.optString("label","");
            if(!label.isEmpty()) options.textField(label).textSize(12f*unitScale()).textOffset(new Float[]{0f,1.5f});
            Symbol symbol=symbols.create(options); markers.put(markerId,symbol); markerIds.put(symbol.getId(),markerId);
        }
    }
    private float unitScale() { return slot.scale/host.getResources().getDisplayMetrics().density; }
    private Bitmap icon(JSONObject marker,JSONObject visual) {
        // Bundled semantic vector drawing, never remote files, HTML or credentials.
        float density=host.getResources().getDisplayMetrics().density;
        int width=Math.max(8,Math.round((float)marker.optDouble("width",32)*slot.scale));
        int height=Math.max(8,Math.round((float)marker.optDouble("height",40)*slot.scale));
        Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888); bitmap.setDensity(Math.round(160*density));
        Canvas canvas=new Canvas(bitmap); Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        float radius=Math.min(width,height)*.4f, x=width/2f, y=radius+height*.04f;
        paint.setColor(Color.WHITE); canvas.drawCircle(x,y,radius,paint);
        paint.setColor(Color.parseColor(visual.optString("color","#ad2538")));
        canvas.drawCircle(x,y,radius*.83f,paint);
        if(visual.optBoolean("selected")) { paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(Math.max(1,slot.scale*2)); canvas.drawCircle(x,y,radius*.96f,paint); paint.setStyle(Paint.Style.FILL); }
        String kind=visual.optString("kind"), vehicle=visual.optString("vehicle","");
        String glyph=switch(kind) { case "user","dot" -> "•"; case "technician" -> vehicle.equals("tow") ? "T" : "B"; case "pickup" -> "P"; case "drop" -> "D"; case "sos" -> "!"; case "shop" -> "S"; case "ev" -> "E"; case "fuel" -> "F"; default -> "•"; };
        paint.setColor(Color.WHITE); paint.setTextAlign(Paint.Align.CENTER); paint.setTextSize(radius*1.05f); paint.setFakeBoldText(true);
        canvas.drawText(glyph,x,y-(paint.ascent()+paint.descent())/2,paint); return bitmap;
    }
    private void applyPositions() {
        if(symbols==null || closed || failure!=null) return;
        for(Map.Entry<String,JSONObject> entry:pendingPositions.entrySet()) {
            Symbol marker=markers.get(entry.getKey()); if(marker==null) continue;
            JSONObject p=entry.getValue(); marker.setPosition(MapPayload.point(p.optJSONObject("position")));
            if(p.has("heading")) marker.setIconRotate((float)p.optDouble("heading")); symbols.update(marker);
        }
    }
    private void applyCamera() {
        if(map==null || camera==null || !slot.positioned || closed || failure!=null || view.getWidth()==0 || view.getHeight()==0) return;
        long revision=camera.optLong("revision");
        if(!state.cameraNeeded(revision,view.getWidth(),view.getHeight(),slot.scale,"fit".equals(camera.optString("mode")))) return;
        CameraPosition target;
        if("follow".equals(camera.optString("mode"))) {
            target=new CameraPosition.Builder().target(MapPayload.point(camera.optJSONObject("center"))).zoom(camera.optDouble("zoom"))
                .bearing(camera.optDouble("bearing",0)).tilt(camera.optDouble("pitch",0)).padding(0,0,0,0).build();
        } else {
            List<LatLng> points=points(camera.optJSONArray("points")); if(points.isEmpty()) return;
            JSONObject pad=camera.optJSONObject("padding");
            int[] padding={px(pad,"left"),px(pad,"top"),px(pad,"right"),px(pad,"bottom")};
            if(padding[0]+padding[2]>=view.getWidth() || padding[1]+padding[3]>=view.getHeight()) return;
            LatLngBounds.Builder bounds=new LatLngBounds.Builder(); for(LatLng point:points) bounds.include(point);
            boolean single=points.stream().allMatch(p->p.equals(points.get(0)));
            target=single ? new CameraPosition.Builder().target(points.get(0)).zoom(camera.optDouble("maxZoom")).padding(padding[0],padding[1],padding[2],padding[3]).build()
                : map.getCameraForLatLngBounds(bounds.build(),padding);
            if(target==null) return;
            target=new CameraPosition.Builder(target).zoom(Math.min(target.zoom,camera.optDouble("maxZoom"))).build();
        }
        map.easeCamera(CameraUpdateFactory.newCameraPosition(target),550);
        state.cameraApplied(revision,view.getWidth(),view.getHeight(),slot.scale);
    }
    private int px(JSONObject data,String key) { return Math.round((float)data.optDouble(key)*slot.scale); }
    private static List<LatLng> points(JSONArray list) { List<LatLng> result=new ArrayList<>(); for(int i=0;i<list.length();i++) result.add(MapPayload.point(list.optJSONObject(i))); return result; }
    private static JSObject position(LatLng point) { return new JSObject().put("lat",point.getLatitude()).put("lng",point.getLongitude()); }
    private void emit(String type,JSObject data) {
        if(closed) return;
        events.accept(data.put("mapId",id).put("generation",generation).put("eventSequence",++eventSequence).put("type",type));
    }
    void fail(String code) {
        if(closed || failure!=null) return;
        failure=code; handler.removeCallbacks(timeout); host.visibility(slot,false,false); stop();
        emit("error",new JSObject().put("code",code).put("message","Native map operation failed ("+code+").").put("retryable",true));
    }
    void start() { if(!closed && failure==null && !started) { view.onStart(); started=true; } }
    private void scheduleTimeout() {
        if(!initializing || ready || failure!=null || closed || !resumed) return;
        long now=android.os.SystemClock.uptimeMillis(); readyBudget.resume(now);
        handler.removeCallbacks(timeout); handler.postDelayed(timeout,readyBudget.remaining(now));
    }
    void resume() { start(); if(!closed && failure==null && !resumed) { view.onResume(); resumed=true; scheduleTimeout(); } }
    void pause() {
        handler.removeCallbacks(timeout); readyBudget.pause(android.os.SystemClock.uptimeMillis());
        if(resumed) { view.onPause(); resumed=false; }
    }
    void stop() { pause(); if(started) { view.onStop(); started=false; } }
    Bundle save() { Bundle bundle=new Bundle(); if(!closed) view.onSaveInstanceState(bundle); return bundle; }
    void lowMemory() { if(!closed) view.onLowMemory(); }
    void destroy() {
        if(closed) return;
        closed=true; state.close(); handler.removeCallbacksAndMessages(null); host.removeMap(slot);
        stop(); if(symbols!=null) symbols.onDestroy(); if(lines!=null) lines.onDestroy(); if(fills!=null) fills.onDestroy();
        view.onDestroy(); markers.clear(); markerIds.clear(); pendingPositions.clear(); images.clear(); scene=null; camera=null;
    }
}

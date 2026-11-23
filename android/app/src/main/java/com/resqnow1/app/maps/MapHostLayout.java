package com.resqnow1.app.maps;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.RectF;
import android.graphics.drawable.ColorDrawable;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.webkit.WebView;
import android.widget.FrameLayout;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Native underlay. React overlays remain in the original Capacitor WebView. */
public final class MapHostLayout extends FrameLayout {
    final class Slot extends FrameLayout {
        final View map;
        final RectF frame = new RectF(), clip = new RectF();
        final List<RectF> exclusions = new ArrayList<>();
        float radius, scale = 1;
        boolean wantedVisible, interactive, positioned;
        int stackOrder;
        Slot(View map) {
            super(MapHostLayout.this.getContext()); this.map=map; setClipChildren(true); setClipToOutline(true);
            setVisibility(INVISIBLE); addView(map);
            setOutlineProvider(new ViewOutlineProvider() {
                @Override public void getOutline(View v, Outline outline) {
                    if(frame.isEmpty()) outline.setEmpty();
                    else outline.setRoundRect(Math.round(frame.left-clip.left),Math.round(frame.top-clip.top),
                        Math.round(frame.right-clip.left),Math.round(frame.bottom-clip.top),radius);
                }
            });
        }
        boolean hit(float x,float y) {
            if(!covers(x,y) || !interactive) return false;
            for(RectF excluded:exclusions) if(excluded.contains(x,y)) return false;
            return MapState.hitClipped(x,y,clip.left,clip.top,clip.right,clip.bottom,frame.left,frame.top,frame.right,frame.bottom,radius);
        }
        boolean covers(float x,float y) {
            return getVisibility()==VISIBLE && MapState.hitClipped(x,y,clip.left,clip.top,clip.right,clip.bottom,frame.left,frame.top,frame.right,frame.bottom,radius);
        }
    }
    private final List<Slot> slots=new ArrayList<>();
    private Slot target;
    private boolean nativeGesture;
    private WebView web;
    private boolean transparent;
    private int originalColor=Color.WHITE;
    public MapHostLayout(Context context, AttributeSet attributes) { super(context,attributes); }
    void attach(WebView view) { web=view; }
    Slot addMap(View map) {
        Slot slot=new Slot(map); slots.add(slot); addView(slot,0,new LayoutParams(1,1)); return slot;
    }
    void removeMap(Slot slot) { cancel(slot); slots.remove(slot); removeView(slot); refreshTransparency(); }
    void visibility(Slot slot,boolean visible,boolean interactive) {
        if(!visible || !interactive) cancel(slot);
        slot.wantedVisible=visible; slot.interactive=interactive;
        slot.setVisibility(visible && slot.positioned && !slot.clip.isEmpty() ? VISIBLE : INVISIBLE); refreshTransparency();
    }
    void viewport(Slot slot,JSONObject data) {
        JSONObject visual=MapPayload.object(data,"visualViewport");
        double width=MapPayload.number(visual,"width",1,100000);
        MapPayload.number(visual,"height",1,100000); MapPayload.number(visual,"scale",.1,10);
        double offsetX=MapPayload.number(visual,"offsetLeft",-100000,100000);
        double offsetY=MapPayload.number(visual,"offsetTop",-100000,100000);
        MapPayload.require(web.getWidth()>0);
        float scale=(float)(web.getWidth()/width);
        MapPayload.require(scale>0 && scale<=getResources().getDisplayMetrics().density*10);
        int[] webOrigin=new int[2], rootOrigin=new int[2]; web.getLocationInWindow(webOrigin); getLocationInWindow(rootOrigin);
        float ox=(float)(webOrigin[0]-rootOrigin[0]-offsetX*scale), oy=(float)(webOrigin[1]-rootOrigin[1]-offsetY*scale);
        RectF frame=rect(MapPayload.object(data,"frame"),scale,ox,oy);
        if(frame.width()>8192 || frame.height()>8192) throw new MapFailure("LIMIT");
        RectF clip=rect(MapPayload.object(data,"clip"),scale,ox,oy);
        if(!clip.intersect(frame) || !clip.intersect(new RectF(0,0,getWidth(),getHeight()))) clip.setEmpty();
        List<RectF> exclusions=new ArrayList<>(); JSONArray list=MapPayload.array(data,"excludedRects",100);
        for(int i=0;i<list.length();i++) exclusions.add(rect(MapPayload.item(list,i),scale,ox,oy));
        float radius=(float)MapPayload.number(data,"cornerRadius",0,1000)*scale;
        boolean visible=MapPayload.bool(data,"visible"), interactive=MapPayload.bool(data,"interactive");
        int stackOrder=(int)MapPayload.optional(data,"stackOrder",0,0,1024);
        if(!slot.frame.equals(frame) || !slot.clip.equals(clip) || slot.radius!=radius || !slot.exclusions.equals(exclusions)) cancel(slot);
        slot.scale=scale; slot.frame.set(frame); slot.clip.set(clip); slot.exclusions.clear(); slot.exclusions.addAll(exclusions);
        slot.radius=radius; slot.positioned=true;
        if(slot.stackOrder!=stackOrder) {slot.stackOrder=stackOrder;reorderMaps();}
        LayoutParams clipped=new LayoutParams(Math.max(1,Math.round(clip.width())),Math.max(1,Math.round(clip.height())));
        clipped.leftMargin=Math.round(clip.left); clipped.topMargin=Math.round(clip.top); slot.setLayoutParams(clipped);
        LayoutParams full=new LayoutParams(Math.max(1,Math.round(frame.width())),Math.max(1,Math.round(frame.height())));
        full.leftMargin=Math.round(frame.left-clip.left); full.topMargin=Math.round(frame.top-clip.top); slot.map.setLayoutParams(full);
        slot.invalidateOutline(); visibility(slot,visible,interactive);
    }
    private static RectF rect(JSONObject data,float scale,float ox,float oy) {
        double x=MapPayload.number(data,"left",-100000,100000), y=MapPayload.number(data,"top",-100000,100000);
        double w=MapPayload.number(data,"width",0,100000), h=MapPayload.number(data,"height",0,100000);
        return new RectF((float)x*scale+ox,(float)y*scale+oy,(float)(x+w)*scale+ox,(float)(y+h)*scale+oy);
    }
    private void refreshTransparency() {
        if(web==null) return;
        boolean visible=false; for(Slot slot:slots) visible|=slot.getVisibility()==VISIBLE;
        if(visible==transparent) return;
        if(visible) { if(web.getBackground() instanceof ColorDrawable) originalColor=((ColorDrawable)web.getBackground()).getColor(); web.setBackgroundColor(Color.TRANSPARENT); }
        else web.setBackgroundColor(originalColor);
        transparent=visible;
    }
    private List<Slot> orderedMaps() {
        List<Slot> ordered=new ArrayList<>(slots);
        ordered.sort((a,b)->a.stackOrder==b.stackOrder ? Integer.compare(slots.indexOf(a),slots.indexOf(b)) : Integer.compare(a.stackOrder,b.stackOrder));
        return ordered;
    }
    private void reorderMaps() {
        if(target!=null) cancel(target);
        for(Slot slot:orderedMaps()) bringChildToFront(slot);
        if(web!=null) bringChildToFront(web);
    }
    private void cancel(Slot slot) {
        if(target!=slot) return;
        MotionEvent event=MotionEvent.obtain(android.os.SystemClock.uptimeMillis(),android.os.SystemClock.uptimeMillis(),MotionEvent.ACTION_CANCEL,0,0,0);
        slot.map.dispatchTouchEvent(event); event.recycle(); target=null;
    }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if(event.getActionMasked()==MotionEvent.ACTION_DOWN) {
            target=null; nativeGesture=false;
            List<Slot> ordered=orderedMaps();java.util.Collections.reverse(ordered);
            boolean[] covers=new boolean[ordered.size()], accepts=new boolean[ordered.size()];
            for(int i=0;i<ordered.size();i++) {covers[i]=ordered.get(i).covers(event.getX(),event.getY());accepts[i]=ordered.get(i).hit(event.getX(),event.getY());}
            int index=MapState.touchTarget(covers,accepts);if(index>=0) target=ordered.get(index);
            nativeGesture=target!=null;
        }
        if(!nativeGesture) return super.dispatchTouchEvent(event);
        if(target!=null) {
            MotionEvent local=MotionEvent.obtain(event); local.offsetLocation(-target.frame.left,-target.frame.top);
            target.map.dispatchTouchEvent(local); local.recycle();
        }
        if(event.getActionMasked()==MotionEvent.ACTION_UP || event.getActionMasked()==MotionEvent.ACTION_CANCEL) { target=null; nativeGesture=false; }
        return true;
    }
}

package com.resqnow1.app.maps;

import java.util.HashMap;
import java.util.Map;

/** Renderer-independent ownership and geometry rules. No GPS, network or business state. */
final class MapState {
    private final long generation;
    private boolean closed;
    private final Map<String, Long> revisions = new HashMap<>();
    private long appliedCamera=-1;
    private int cameraWidth, cameraHeight;
    private float cameraScale;
    MapState(long generation) { this.generation = generation; }
    boolean accepts(long value) { return !closed && generation == value; }
    boolean advance(String channel, long revision) {
        if (closed || revision < 0 || revision <= revisions.getOrDefault(channel, -1L)) return false;
        revisions.put(channel, revision); return true;
    }
    void close() { closed = true; }
    static int touchTarget(boolean[] covers,boolean[] accepts) {
        for(int i=0;i<covers.length;i++) if(covers[i]) return accepts[i] ? i : -1;
        return -1;
    }
    boolean cameraNeeded(long revision,int width,int height,float scale,boolean fit) {
        return revision!=appliedCamera || fit && (width!=cameraWidth || height!=cameraHeight || scale!=cameraScale);
    }
    void cameraApplied(long revision,int width,int height,float scale) {
        appliedCamera=revision; cameraWidth=width; cameraHeight=height; cameraScale=scale;
    }
    long appliedCameraRevision() { return appliedCamera; }
    static final class ReadyBudget {
        private long remaining, resumedAt=-1;
        ReadyBudget(long milliseconds) { remaining=milliseconds; }
        void resume(long now) { if(resumedAt<0) resumedAt=now; }
        void pause(long now) { remaining=remaining(now); resumedAt=-1; }
        long remaining(long now) { return Math.max(0,remaining-(resumedAt<0 ? 0 : Math.max(0,now-resumedAt))); }
    }
    static boolean hitClipped(float x,float y,float clipLeft,float clipTop,float clipRight,float clipBottom,
                              float frameLeft,float frameTop,float frameRight,float frameBottom,float radius) {
        return x>=clipLeft && x<clipRight && y>=clipTop && y<clipBottom
            && hitRounded(x,y,frameLeft,frameTop,frameRight,frameBottom,radius);
    }
    static boolean hitRounded(float x,float y,float left,float top,float right,float bottom,float radius) {
        if(x<left || x>=right || y<top || y>=bottom) return false;
        float r=Math.min(radius,Math.min(right-left,bottom-top)/2);
        float dx=x-Math.max(left+r,Math.min(x,right-r)), dy=y-Math.max(top+r,Math.min(y,bottom-r));
        return dx*dx+dy*dy<=r*r;
    }
    static boolean validRect(double x, double y, double width, double height) {
        return Double.isFinite(x) && Double.isFinite(y) && Double.isFinite(width) && Double.isFinite(height)
            && width >= 0 && height >= 0 && Math.abs(x) <= 100000 && Math.abs(y) <= 100000 && width <= 100000 && height <= 100000;
    }
    static boolean validPoint(double lat, double lng) {
        return Double.isFinite(lat) && Double.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    }
    static double[][] circle(double latitude, double longitude, double meters) {
        double[][] ring = new double[65][2];
        double lat = Math.toRadians(latitude), lng = Math.toRadians(longitude), distance = meters / 6371008.8;
        for (int i=0; i<64; i++) {
            double bearing = 2*Math.PI*i/64;
            double a = Math.asin(Math.sin(lat)*Math.cos(distance)+Math.cos(lat)*Math.sin(distance)*Math.cos(bearing));
            double b = lng+Math.atan2(Math.sin(bearing)*Math.sin(distance)*Math.cos(lat),Math.cos(distance)-Math.sin(lat)*Math.sin(a));
            ring[i][0] = Math.toDegrees(a); ring[i][1] = ((Math.toDegrees(b)+540)%360)-180;
        }
        ring[64] = ring[0].clone(); return ring;
    }
}

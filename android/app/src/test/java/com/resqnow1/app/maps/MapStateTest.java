package com.resqnow1.app.maps;

import org.junit.Test;
import static org.junit.Assert.*;

public class MapStateTest {
    @Test public void topMapControlNeverPassesThroughToAnotherNativeMap() {
        assertEquals(-1,MapState.touchTarget(new boolean[]{true,true},new boolean[]{false,true}));
        assertEquals(1,MapState.touchTarget(new boolean[]{false,true},new boolean[]{false,true}));
        assertEquals(0,MapState.touchTarget(new boolean[]{true,true},new boolean[]{true,true}));
    }
    @Test public void rejectsStaleGenerationsAndRevisions() {
        MapState state = new MapState(3);
        assertTrue(state.accepts(3));
        assertFalse(state.accepts(2));
        assertTrue(state.advance("layout", 4));
        assertFalse(state.advance("layout", 4));
        assertFalse(state.advance("layout", 2));
        assertTrue(state.advance("scene", 1));
        state.close();
        assertFalse(state.accepts(3));
    }
    @Test public void validatesFiniteViewportAndCoordinates() {
        assertTrue(MapState.validRect(0, -20, 300, 200));
        assertFalse(MapState.validRect(0, 0, Double.NaN, 20));
        assertFalse(MapState.validRect(0, 0, -1, 20));
        assertTrue(MapState.validPoint(90, -180));
        assertFalse(MapState.validPoint(91, 0));
        assertFalse(MapState.validPoint(0, Double.POSITIVE_INFINITY));
    }
    @Test public void geodesicCircleKeepsGroundRadiusAndClosesRing() {
        double[][] ring = MapState.circle(11, 77, 260);
        assertEquals(65, ring.length);
        assertArrayEquals(ring[0], ring[64], 0.00000001);
        for (double[] point : ring) {
            double lat1 = Math.toRadians(11), lat2 = Math.toRadians(point[0]);
            double a = Math.pow(Math.sin((lat2-lat1)/2),2) + Math.cos(lat1)*Math.cos(lat2)*Math.pow(Math.sin(Math.toRadians(point[1]-77)/2),2);
            assertEquals(260, 6371008.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)), .01);
        }
    }
    @Test public void roundedClipRejectsCornersAndOutsideTouches() {
        assertTrue(MapState.hitRounded(15,15,0,0,100,100,20));
        assertFalse(MapState.hitRounded(0,0,0,0,100,100,20));
        assertFalse(MapState.hitRounded(101,50,0,0,100,100,20));
        assertTrue(MapState.hitRounded(50,0,0,0,100,100,20));
    }
    @Test public void scrollingDoesNotReplayCameraButResizeRefitsBounds() {
        MapState state=new MapState(1);
        assertEquals(-1,state.appliedCameraRevision());
        assertTrue(state.cameraNeeded(1,300,200,1,true));
        state.cameraApplied(1,300,200,1);
        assertEquals(1,state.appliedCameraRevision());
        assertFalse(state.cameraNeeded(1,300,200,1,true));
        assertTrue(state.cameraNeeded(1,500,200,1,true));
        assertFalse(state.cameraNeeded(1,500,200,1,false));
        assertTrue(state.cameraNeeded(2,300,200,1,false));
        assertEquals(1,state.appliedCameraRevision());
    }
    @Test public void backgroundTimeDoesNotConsumeReadinessBudget() {
        MapState.ReadyBudget budget=new MapState.ReadyBudget(20000);
        budget.resume(1000); assertEquals(15000,budget.remaining(6000));
        budget.pause(6000); assertEquals(15000,budget.remaining(90000));
        budget.resume(90000); assertEquals(1,budget.remaining(104999));
        assertEquals(0,budget.remaining(105000));
    }
    @Test public void scrollClipDoesNotIntroduceNewRoundedCorners() {
        // Visible clip y=40..100 intersects a full rounded map y=0..100.
        assertTrue(MapState.hitClipped(1,41,0,40,100,100,0,0,100,100,20));
        assertFalse(MapState.hitClipped(1,99,0,40,100,100,0,0,100,100,20));
        assertFalse(MapState.hitClipped(50,39,0,40,100,100,0,0,100,100,20));
    }
}

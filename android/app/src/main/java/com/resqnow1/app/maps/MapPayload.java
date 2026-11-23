package com.resqnow1.app.maps;

import android.graphics.Color;
import org.json.JSONArray;
import org.json.JSONObject;
import com.mappls.sdk.maps.geometry.LatLng;
import java.util.HashSet;
import java.util.Set;

final class MapPayload {
    static void require(boolean valid) { if (!valid) throw new MapFailure("INVALID_ARGUMENT"); }
    static JSONObject object(JSONObject data, String key) {
        JSONObject value = data.optJSONObject(key); require(value != null); return value;
    }
    static JSONArray array(JSONObject data, String key, int limit) {
        JSONArray value = data.optJSONArray(key); require(value != null);
        if (value.length() > limit) throw new MapFailure("LIMIT"); return value;
    }
    static JSONObject item(JSONArray array, int index) {
        JSONObject value = array.optJSONObject(index); require(value != null); return value;
    }
    static double number(JSONObject data, String key, double min, double max) {
        Object value = data.opt(key); require(value instanceof Number);
        double result = ((Number)value).doubleValue();
        require(Double.isFinite(result) && result >= min && result <= max); return result;
    }
    static double optional(JSONObject data, String key, double fallback, double min, double max) {
        return data.has(key) ? number(data,key,min,max) : fallback;
    }
    static long revision(JSONObject data, String key) {
        double value = number(data,key,0,9007199254740991d); require(value == Math.floor(value)); return (long)value;
    }
    static String id(JSONObject data, String key) {
        Object value = data.opt(key); require(value instanceof String);
        String id = (String)value; require(id.matches("[A-Za-z0-9_.:-]{1,120}")); return id;
    }
    static String text(JSONObject data, String key, String fallback) {
        if (!data.has(key)) return fallback;
        Object value = data.opt(key); require(value instanceof String && ((String)value).length() <= 120); return (String)value;
    }
    static boolean bool(JSONObject data, String key) { require(data.opt(key) instanceof Boolean); return data.optBoolean(key); }
    static LatLng point(JSONObject data) { return new LatLng(number(data,"lat",-90,90),number(data,"lng",-180,180)); }
    static String color(JSONObject data, String key, String fallback) {
        String value = text(data,key,fallback); require(value.matches("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?"));
        Color.parseColor(value); return value;
    }
    static void camera(JSONObject camera) {
        revision(camera,"revision");
        if ("follow".equals(camera.optString("mode"))) {
            point(object(camera,"center")); number(camera,"zoom",0,22);
            optional(camera,"bearing",0,-360,360); optional(camera,"pitch",0,0,60);
        } else {
            require("fit".equals(camera.optString("mode")));
            JSONArray points = array(camera,"points",5000);
            for (int i=0;i<points.length();i++) point(item(points,i));
            number(camera,"maxZoom",0,22);
            JSONObject padding = object(camera,"padding");
            for (String key : new String[]{"left","top","right","bottom"}) number(padding,key,0,10000);
        }
    }
    static void positions(JSONObject data) {
        revision(data,"frameSequence"); JSONArray points = array(data,"points",500); Set<String> ids = new HashSet<>();
        for (int i=0;i<points.length();i++) {
            JSONObject p = item(points,i); require(ids.add(id(p,"id"))); point(object(p,"position"));
            optional(p,"heading",0,-360,360);
        }
    }
    static void scene(JSONObject data) {
        revision(data,"revision"); Set<String> ids = new HashSet<>();
        JSONArray markers = array(data,"markers",500);
        for(int i=0;i<markers.length();i++) {
            JSONObject m=item(markers,i); require(ids.add(id(m,"id"))); point(object(m,"position"));
            JSONObject visual=object(m,"visual"); String kind=text(visual,"kind","");
            require(Set.of("user","technician","pickup","drop","sos","shop","ev","fuel","dot").contains(kind));
            text(visual,"accessibleLabel",""); text(visual,"label",""); color(visual,"color","#ad2538");
            String vehicle=text(visual,"vehicle",""); require(vehicle.isEmpty() || Set.of("bike","tow").contains(vehicle));
            String icon=text(visual,"iconKey",kind); if (!icon.equals(kind) && !icon.equals(vehicle)) throw new MapFailure("UNSUPPORTED");
            if(m.has("draggable")) bool(m,"draggable"); if(visual.has("selected")) bool(visual,"selected");
            optional(m,"heading",0,-360,360); optional(m,"zIndex",0,-10000,10000);
            optional(m,"width",32,8,128); optional(m,"height",40,8,128);
            String anchor=text(m,"anchor","bottom"); require(Set.of("center","bottom").contains(anchor));
            if(m.has("offset")) { JSONArray a=array(m,"offset",2); require(a.length()==2);
                for(int j=0;j<2;j++) require(a.opt(j) instanceof Number && Double.isFinite(a.optDouble(j)) && Math.abs(a.optDouble(j))<=500); }
        }
        JSONArray lines=array(data,"polylines",100); int total=0; ids.clear();
        for(int i=0;i<lines.length();i++) {
            JSONObject line=item(lines,i); require(ids.add(id(line,"id"))); color(line,"color","#ad2538");
            number(line,"width",0,64); number(line,"opacity",0,1); JSONArray points=array(line,"points",10000); total+=points.length();
            for(int j=0;j<points.length();j++) point(item(points,j));
        }
        if(total>20000) throw new MapFailure("LIMIT");
        JSONArray circles=array(data,"circles",100); ids.clear();
        for(int i=0;i<circles.length();i++) {
            JSONObject c=item(circles,i); require(ids.add(id(c,"id"))); point(object(c,"center"));
            number(c,"radiusMeters",0,100000); color(c,"fillColor","#ad2538"); number(c,"fillOpacity",0,1);
        }
    }
}

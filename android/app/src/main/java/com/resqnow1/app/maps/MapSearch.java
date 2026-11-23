package com.resqnow1.app.maps;

import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.mappls.sdk.maps.geometry.LatLng;
import com.mappls.sdk.services.api.OnResponseCallback;
import com.mappls.sdk.services.api.autosuggest.*;
import com.mappls.sdk.services.api.autosuggest.model.*;
import com.mappls.sdk.services.api.placedetail.*;
import com.mappls.sdk.services.api.placedetail.model.PlaceDetailResponse;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;

/** Independent native search; no map, geolocation collection or Railway dependencies. UI thread only. */
final class MapSearch {
    private final Map<String,Request> active=new HashMap<>();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final class Request {
        final String id; final PluginCall call;
        final List<Runnable> cancellations=new ArrayList<>();
        final Runnable timeout=()->finishError(this,"TIMEOUT");
        final List<JSObject> results=new ArrayList<>();
        Request(String id,PluginCall call) { this.id=id; this.call=call; }
        boolean current() { return active.get(id)==this; }
    }
    void search(PluginCall call) {
        JSONObject data=call.getData(); String id=MapPayload.id(data,"requestId");
        String query=MapPayload.text(data,"query","").trim(); MapPayload.require(query.length()>=2);
        int limit=(int)MapPayload.optional(data,"limit",8,1,8);
        if(data.has("limit")) MapPayload.require(limit==data.optDouble("limit"));
        MapplsAutoSuggest.Builder builder=MapplsAutoSuggest.builder().query(query).bridge(false);
        if(data.has("bias")) { LatLng bias=MapPayload.point(MapPayload.object(data,"bias")); builder.setLocation(bias.getLatitude(),bias.getLongitude()); }
        if(active.containsKey(id)) throw new MapFailure("INVALID_ARGUMENT");
        if(active.size()>=4) throw new MapFailure("LIMIT");
        MapplsAutosuggestManager manager=MapplsAutosuggestManager.newInstance(builder.build());
        Request request=new Request(id,call); active.put(id,request); request.cancellations.add(manager::cancel); handler.postDelayed(request.timeout,15000);
        try {
            manager.call(new OnResponseCallback<AutoSuggestAtlasResponse>() {
                @Override public void onSuccess(AutoSuggestAtlasResponse response) { handler.post(()->{
                    if(!request.current()) return;
                    List<ELocation> locations=new ArrayList<>();
                    if(response!=null && response.getSuggestedLocations()!=null) locations.addAll(response.getSuggestedLocations());
                    if(response!=null && response.getUserAddedLocations()!=null) locations.addAll(response.getUserAddedLocations());
                    resolve(request,locations.subList(0,Math.min(limit,locations.size())),0);
                }); }
                @Override public void onError(int code,String message) { handler.post(()->finishError(request,error(code))); }
            });
        } catch(RuntimeException failure) { finishError(request,"SEARCH_FAILED"); }
    }
    private void resolve(Request request,List<ELocation> places,int index) {
        if(!request.current()) return;
        if(index>=places.size()) {
            active.remove(request.id); handler.removeCallbacks(request.timeout);
            request.call.resolve(new JSObject().put("requestId",request.id).put("results",new JSONArray(request.results))); return;
        }
        ELocation place=places.get(index);
        if(place==null) { finishError(request,"SEARCH_COORDINATES"); return; }
        if(valid(place.latitude,place.longitude)) {
            request.results.add(result(place,place.latitude,place.longitude)); resolve(request,places,index+1); return;
        }
        if(place.mapplsPin==null || !place.mapplsPin.matches("[A-Za-z0-9]{6}")) { finishError(request,"SEARCH_COORDINATES"); return; }
        try {
            MapplsPlaceDetailManager detail=MapplsPlaceDetailManager.newInstance(MapplsPlaceDetail.builder().mapplsPin(place.mapplsPin).build());
            request.cancellations.add(detail::cancel);
            detail.call(new OnResponseCallback<PlaceDetailResponse>() {
                @Override public void onSuccess(PlaceDetailResponse response) { handler.post(()->{
                    if(!request.current()) return;
                    if(response==null || !valid(response.getLatitude(),response.getLongitude())) { finishError(request,"SEARCH_COORDINATES"); return; }
                    request.results.add(result(place,response.getLatitude(),response.getLongitude())); resolve(request,places,index+1);
                }); }
                @Override public void onError(int code,String message) { handler.post(()->finishError(request,error(code))); }
            });
        } catch(RuntimeException failure) { finishError(request,"SEARCH_FAILED"); }
    }
    private static boolean valid(Double lat,Double lng) { return lat!=null && lng!=null && MapState.validPoint(lat,lng); }
    private static String safe(String text) { return text==null ? "" : text.substring(0,Math.min(1000,text.length())); }
    private static JSObject result(ELocation place,double lat,double lng) {
        String id=place.mapplsPin==null ? lat+","+lng : place.mapplsPin, name=safe(place.placeName), address=safe(place.placeAddress);
        return new JSObject().put("id",id).put("placeId",id).put("name",name).put("address",address)
            .put("label",name.isEmpty() ? address : address.isEmpty() ? name : name+", "+address)
            .put("lat",lat).put("lng",lng).put("provider","mappls").put("category",place.type==null ? JSONObject.NULL : safe(place.type));
    }
    private static String error(int code) { return code==401 ? "LICENSE" : code==403 || code==429 ? "LIMIT" : "SEARCH_FAILED"; }
    private void finishError(Request request,String code) {
        if(!request.current()) return;
        active.remove(request.id); handler.removeCallbacks(request.timeout);
        for(Runnable cancel:request.cancellations) { try { cancel.run(); } catch(RuntimeException ignored) {} }
        request.call.reject("Native map operation failed ("+code+").",code);
    }
    void cancel(String id) { Request request=active.get(id); if(request!=null) finishError(request,"CANCELLED"); }
    void destroy() { for(Request request:new ArrayList<>(active.values())) finishError(request,"CANCELLED"); handler.removeCallbacksAndMessages(null); }
}

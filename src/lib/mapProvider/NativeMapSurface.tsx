import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MapplsMapSurfaceProps } from './MapplsMapSurface';
import { NativeMapController, type NativeViewport } from './NativeMapController';
import { nativeMapBridge, type NativeMapError } from './nativeMapBridge';
import { acquireMapTransparency, observeNativeViewport, type TransparencyLease } from './nativeViewport';

export function NativeMapSurface(props:MapplsMapSurfaceProps) {
  const element=useRef<HTMLDivElement>(null),latest=useRef(props); latest.current=props;
  const controller=useRef<NativeMapController>(),viewport=useRef<NativeViewport>(),lease=useRef<TransparencyLease>();
  const [visible,setVisible]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState<NativeMapError|null>(null),[retry,setRetry]=useState(0);
  const session=String(props.advancedTracking?.sessionId ?? '');
  const [viewCamera,setViewCamera]=useState<{center:{lat:number;lng:number};zoom:number;bearing:number;pitch:number}>();
  useLayoutEffect(()=>{
    if(!element.current) return;
    return observeNativeViewport(element.current,next=>{
      viewport.current=next;controller.current?.setViewport(next);lease.current?.update();setVisible(next.visible);
    },()=>controller.current?.refreshViewport());
  },[]);
  useLayoutEffect(()=>{
    if(!visible || error || !element.current) return;
    const acquired=acquireMapTransparency(element.current);lease.current=acquired;
    return ()=>{acquired();if(lease.current===acquired) lease.current=undefined;};
  },[visible,error]);
  useEffect(()=>{
    if(!visible || error) return;
    setReady(false);
    setViewCamera(undefined);
    const instance=new NativeMapController(nativeMapBridge,{
      onReady:()=>setReady(true),onError:setError,
      onInteract:()=>latest.current.onInteract?.(),onMapClick:point=>latest.current.onMapClick?.(point),
      onCameraIdle:event=>{if(latest.current.zoomControls) setViewCamera(event);},
    });
    controller.current=instance;
    instance.setScene(latest.current);instance.setCamera(latest.current.camera);
    if(viewport.current) instance.setViewport(viewport.current);
    void instance.start(latest.current.ariaLabel);
    return ()=>{if(controller.current===instance) controller.current=undefined;void instance.dispose().catch(()=>{});};
  },[visible,retry,session,error]);
  useEffect(()=>{controller.current?.setScene(props);controller.current?.setCamera(props.camera);});
  useEffect(()=>{if(error) latest.current.onUnavailable?.();},[error]);
  const zoom=(delta:number)=>{
    if(!viewCamera) return;latest.current.onInteract?.();
    controller.current?.setManualCamera({mode:'follow',...viewCamera,zoom:Math.min(22,Math.max(0,viewCamera.zoom+delta))});
  };
  return <div ref={element} role="application" aria-label={props.ariaLabel}
    data-native-map-surface={error ? 'false':'true'} data-native-map-ready={ready ? 'true':'false'}
    className={cn('relative h-full min-h-[240px] w-full bg-slate-100',props.className)}>
    {error ? <div role="status" data-native-map-overlay className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 p-4 text-center">
      <p className="font-bold text-slate-900">Map is temporarily unavailable</p>
      <p className="mt-1 text-sm text-slate-500">{props.fallbackDescription ?? 'Live job details will continue updating.'}</p>
      <p className="mt-1 text-xs text-slate-500">Support code: {error.code}</p>
      <Button type="button" variant="outline" className="mt-4" onClick={()=>{setError(null);setReady(false);setRetry(value=>value+1);}}>Retry map</Button>
    </div> : !ready ? <div role="status" data-native-map-overlay className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm text-slate-600">Loading map…</div> : null}
    {ready && <ul className="sr-only" aria-label="Map locations">{props.markers.map(marker=><li key={marker.id}>
      {marker.onClick ? <button type="button" onClick={()=>{props.onInteract?.();marker.onClick?.();}}>{marker.visual?.accessibleLabel}</button> : marker.visual?.accessibleLabel}
    </li>)}</ul>}
    {ready && props.zoomControls && <div data-native-map-overlay className="absolute right-3 top-3 z-10 flex flex-col rounded-lg bg-white shadow">
      <button type="button" aria-label="Zoom in" disabled={!viewCamera} className="h-10 w-10 text-xl text-slate-900" onClick={()=>zoom(1)}>+</button>
      <button type="button" aria-label="Zoom out" disabled={!viewCamera} className="h-10 w-10 text-xl text-slate-900" onClick={()=>zoom(-1)}>−</button>
    </div>}
  </div>;
}

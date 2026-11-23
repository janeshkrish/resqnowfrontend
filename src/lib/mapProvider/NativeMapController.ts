import type { PluginListenerHandle } from '@capacitor/core';
import { NativeMapError } from './nativeMapBridge';
import type { NativeMapEvent, NativeMapMarker, NativeMapOwner, NativeMapPlugin, NativeMapViewport } from './nativeMapTypes';
import type { MapCameraSpec, MapCircleSpec, MapMarkerSpec, MapPoint, MapPolylineSpec } from './types';

export type NativeViewport = Omit<NativeMapViewport, keyof NativeMapOwner | 'layoutRevision'>;
export type MapScene = { markers: MapMarkerSpec[]; polylines: MapPolylineSpec[]; circles: MapCircleSpec[] };
type Callbacks = { onReady: () => void; onError: (error: NativeMapError) => void; onInteract?: () => void; onMapClick?: (point: MapPoint) => void; onCameraIdle?: (event: Extract<NativeMapEvent,{type:'cameraIdle'}>) => void };
let generation = 0, nextId = 0;
const availableIds: string[] = [];
const cameraKey = (camera?: MapCameraSpec) => camera ? `${camera.mode}:${camera.revision}` : '';

/** Rendering adapter only. Consumes shared playback; never extrapolates positions or requests routes. */
export class NativeMapController {
  readonly owner: NativeMapOwner = { mapId: availableIds.pop() ?? `resqnow-map-${++nextId}`, generation: generation = Math.max(generation+1,Date.now()*1000) };
  private disposed=false;
  private failed=false;
  private created=false;
  private listener?: PluginListenerHandle;
  private starting?: Promise<void>;
  private disposing?: Promise<void>;
  private sending?: Promise<void>;
  private scheduled?: ReturnType<typeof setTimeout>;
  private version=0;
  private processed=-1;
  private eventSequence=0;
  private layoutRevision=0;
  private sceneRevision=0;
  private positionSequence=0;
  private cameraRevision=0;
  private sentCameraRevision=-1;
  private inputCameraKey='';
  private scene?: MapScene;
  private viewport?: NativeViewport;
  private camera?: MapCameraSpec;
  private sentSceneKey='';
  private sentViewportKey='';
  private positions=new Map<string,string>();
  private ids=new Map<string,string>();
  private markerCounter=0;
  private callbacks: Callbacks;
  constructor(private readonly bridge: NativeMapPlugin, callbacks: Callbacks) { this.callbacks=callbacks; }
  setCallbacks(callbacks: Callbacks) { this.callbacks=callbacks; }
  start(label: string): Promise<void> {
    return this.starting ??= this.initialize(label);
  }
  private async initialize(label: string) {
    try {
      const availability=await this.bridge.getAvailability();
      if(this.disposed) return;
      if(!availability.available) throw new NativeMapError(availability.code ?? 'SDK_INIT');
      this.listener=await this.bridge.addListener('mapEvent', event=>this.event(event));
      if(this.disposed) return;
      await this.bridge.create({...this.owner,ariaLabel:label.slice(0,120)});
      this.created=true;
      if(!this.disposed) await this.flush();
    } catch(error) { this.fail(error); }
  }
  setScene(scene: MapScene) { this.scene=scene; this.changed(); }
  setViewport(viewport: NativeViewport) { this.viewport=viewport; this.changed(); }
  refreshViewport() { this.sentViewportKey=''; this.changed(); }
  setCamera(camera?: MapCameraSpec) {
    const key=cameraKey(camera);
    if(!camera || key===this.inputCameraKey) return;
    this.inputCameraKey=key; this.camera={...camera,revision:++this.cameraRevision}; this.changed();
  }
  setManualCamera(camera:Omit<Extract<MapCameraSpec,{mode:'follow'}>,'revision'>) {
    this.camera={...camera,revision:++this.cameraRevision};this.changed();
  }
  private changed() {
    this.version++;
    if(!this.scheduled && !this.disposed && !this.failed) this.scheduled=setTimeout(()=>{ this.scheduled=undefined; void this.flush(); },16);
  }
  async flush(): Promise<void> {
    if(this.scheduled) { clearTimeout(this.scheduled); this.scheduled=undefined; }
    if(!this.created || this.disposed || this.failed) return;
    if(this.sending) { await this.sending; if(this.processed!==this.version) await this.flush(); return; }
    this.sending=this.drain();
    try { await this.sending; } finally { this.sending=undefined; }
  }
  private async drain() {
    try {
      while(!this.disposed && !this.failed && this.processed!==this.version) {
        this.processed=this.version;
        const viewport=this.viewport, scene=this.scene, camera=this.camera;
        if(viewport) {
          const key=JSON.stringify(viewport);
          if(key!==this.sentViewportKey) {
            await this.bridge.setViewport({...this.owner,...viewport,layoutRevision:++this.layoutRevision}); this.sentViewportKey=key;
          }
        }
        if(this.disposed) break;
        if(scene) {
          const markers=this.nativeMarkers(scene.markers);
          const staticKey=JSON.stringify([markers.map(({position:_,heading:__,...visual})=>visual),this.lineKey(scene.polylines),this.circleKey(scene.circles)]);
          const positionKeys=new Map(markers.map(m=>[m.id,JSON.stringify([m.position,m.heading])]));
          if(staticKey!==this.sentSceneKey) {
            await this.bridge.setOverlays({...this.owner,revision:++this.sceneRevision,markers,polylines:scene.polylines,circles:scene.circles});
            this.sentSceneKey=staticKey; this.positions=positionKeys;
          } else {
            const points=markers.filter(m=>this.positions.get(m.id)!==positionKeys.get(m.id)).map(({id,position,heading})=>({id,position,heading}));
            if(points.length) { await this.bridge.updatePositions({...this.owner,frameSequence:++this.positionSequence,points}); this.positions=positionKeys; }
          }
        }
        if(this.disposed) break;
        if(camera && camera.revision!==this.sentCameraRevision) {
          await this.bridge.setCamera({...this.owner,camera}); this.sentCameraRevision=camera.revision;
        }
      }
    } catch(error) { this.fail(error); }
  }
  // Route geometry can be long; retain its structural signature across playback-only frames.
  private lastLines?: MapPolylineSpec[];
  private linesKey='';
  private lineKey(lines: MapPolylineSpec[]) { if(lines!==this.lastLines) { this.lastLines=lines; this.linesKey=JSON.stringify(lines); } return this.linesKey; }
  private lastCircles?: MapCircleSpec[];
  private circlesKey='';
  private circleKey(circles: MapCircleSpec[]) { if(circles!==this.lastCircles) { this.lastCircles=circles; this.circlesKey=JSON.stringify(circles); } return this.circlesKey; }
  private nativeMarkers(markers: MapMarkerSpec[]): NativeMapMarker[] {
    const existing=new Set(markers.map(m=>m.id));
    for(const id of this.ids.keys()) if(!existing.has(id)) this.ids.delete(id);
    return markers.map(marker=>{
      if(!marker.visual) throw new NativeMapError('UNSUPPORTED');
      let id=this.ids.get(marker.id); if(!id) { id=`marker-${++this.markerCounter}`; this.ids.set(marker.id,id); }
      const { position,draggable,zIndex,width,height,offset }=marker;
      const visual={...marker.visual,accessibleLabel:marker.visual.accessibleLabel.slice(0,120),
        ...(marker.visual.label!=null ? {label:marker.visual.label.slice(0,120)} : {})};
      return { id,position,visual,draggable:draggable ?? false,zIndex,width,height,offset,
        anchor:marker.anchor ?? 'center', ...(marker.heading!=null && Number.isFinite(marker.heading) ? {heading:marker.heading} : {}) };
    });
  }
  private event(event: NativeMapEvent) {
    if(this.disposed || this.failed || event.mapId!==this.owner.mapId || event.generation!==this.owner.generation || event.eventSequence<=this.eventSequence) return;
    this.eventSequence=event.eventSequence;
    if(event.type==='ready') this.callbacks.onReady();
    else if(event.type==='error') this.fail(new NativeMapError(event.code));
    else if(event.type==='interaction') this.callbacks.onInteract?.();
    else if(event.type==='mapClick') { this.callbacks.onInteract?.(); this.callbacks.onMapClick?.(event.position); }
    else if(event.type==='cameraIdle') this.callbacks.onCameraIdle?.(event);
    else if(event.type==='markerClick' || event.type==='markerDragEnd') {
      const marker=this.scene?.markers.find(m=>this.ids.get(m.id)===event.markerId);
      if(event.type==='markerClick') {this.callbacks.onInteract?.();marker?.onClick?.();} else marker?.onDragEnd?.(event.position);
    }
  }
  private fail(error: unknown) {
    if(this.disposed || this.failed) return;
    this.failed=true;
    this.callbacks.onError(error instanceof NativeMapError ? error : new NativeMapError('SDK_INIT'));
  }
  dispose(): Promise<void> {
    if(this.disposing) return this.disposing;
    this.disposed=true; if(this.scheduled) clearTimeout(this.scheduled);
    return this.disposing=(async()=>{
      try {
        await this.starting; await this.sending;
        if(this.created) await this.bridge.destroy(this.owner);
      } finally {
        try { await this.listener?.remove(); } finally { availableIds.push(this.owner.mapId); this.ids.clear(); }
      }
    })();
  }
}

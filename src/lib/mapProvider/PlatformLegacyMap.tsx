import { useRef, useState, type ReactNode } from 'react';
import { PlatformMapSurface } from './PlatformMapSurface';
import { usesNativeMap } from './platform';
import type { MapCameraSpec, MapMarkerSpec, MapPoint, MapPolylineSpec } from './types';

export function useLegacyMapCamera(points:MapPoint[],padding=20,maxZoom=15):MapCameraSpec {
  const signature=JSON.stringify([points,padding,maxZoom]);
  const last=useRef({signature:'',revision:0});
  if(last.current.signature!==signature) last.current={signature,revision:last.current.revision+1};
  return {mode:'fit',points,padding:{top:padding,right:padding,bottom:padding,left:padding},maxZoom,revision:last.current.revision};
}

/** Keep the exact Leaflet subtree on browsers; adapt only the supplied scene on Android. */
export function PlatformLegacyMap({children,ariaLabel,markers,polylines=[],camera,zoomControls=true}: {
  children:ReactNode;ariaLabel:string;markers:MapMarkerSpec[];polylines?:MapPolylineSpec[];camera:MapCameraSpec;zoomControls?:boolean;
}) {
  const [selected,setSelected]=useState<string|null>(null);
  if(!usesNativeMap()) return <>{children}</>;
  const active=markers.find(marker=>marker.id===selected);
  return <div className="relative h-full w-full">
    <PlatformMapSurface ariaLabel={ariaLabel} className="h-full min-h-0 w-full" camera={camera} circles={[]} polylines={polylines} zoomControls={zoomControls}
      markers={markers.map(marker=>({...marker,onClick:()=>{setSelected(marker.id);marker.onClick?.();}}))}/>
    {active && <div role="status" data-native-map-overlay className="absolute bottom-8 left-3 right-3 z-10 rounded-lg bg-white p-3 text-sm text-slate-900 shadow-lg">
      {active.visual?.accessibleLabel}<button type="button" aria-label="Close map popup" className="float-right px-2" onClick={()=>setSelected(null)}>×</button>
    </div>}
  </div>;
}

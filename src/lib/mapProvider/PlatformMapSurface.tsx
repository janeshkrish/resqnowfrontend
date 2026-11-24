import { lazy, Suspense, useEffect, useRef } from 'react';
import { MapplsMapSurface, type MapplsMapSurfaceProps } from './MapplsMapSurface';
import { usesNativeMap } from './platform';

const NativeSurface = lazy(() => import('./NativeMapSurface').then(module => ({ default: module.NativeMapSurface })));

function DisabledNativeMap(props: MapplsMapSurfaceProps) {
  const onUnavailable=useRef(props.onUnavailable);onUnavailable.current=props.onUnavailable;
  useEffect(()=>{onUnavailable.current?.();},[]);
  return <div role="status" aria-label={props.ariaLabel}
    className={`flex min-h-[240px] items-center justify-center bg-slate-100 p-4 text-center text-sm text-slate-600 ${props.className ?? ''}`}>
    Maps are temporarily disabled in this Android release.
  </div>;
}

export function PlatformMapSurface(props: MapplsMapSurfaceProps) {
  if (!usesNativeMap()) return <MapplsMapSurface {...props} />;
  if (import.meta.env.VITE_NATIVE_MAPPLS_ENABLED === 'false') return <DisabledNativeMap {...props} />;
  return <Suspense fallback={<div role="status" className={props.className}>Loading map…</div>}>
    <NativeSurface {...props} />
  </Suspense>;
}

import { lazy, Suspense } from 'react';
import { MapplsMapSurface, type MapplsMapSurfaceProps } from './MapplsMapSurface';
import { usesNativeMap } from './platform';

const NativeSurface = lazy(() => import('./NativeMapSurface').then(module => ({ default: module.NativeMapSurface })));

export function PlatformMapSurface(props: MapplsMapSurfaceProps) {
  if (!usesNativeMap()) return <MapplsMapSurface {...props} />;
  return <Suspense fallback={<div role="status" className={props.className}>Loading map…</div>}>
    <NativeSurface {...props} />
  </Suspense>;
}

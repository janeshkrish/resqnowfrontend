import { usesNativeMap } from './platform';
import { searchMapplsPlaces, type MapplsPlaceSearchResult } from './mapplsSdk';
import { searchLocations } from '@/lib/geo';

let requestSequence=0;
export async function searchMapPlaces(query:string,options:{limit?:number;location?:{lat:number;lng:number}|null;signal?:AbortSignal}={}):Promise<MapplsPlaceSearchResult[]> {
  const {signal,...webOptions}=options;
  if(!usesNativeMap()) return searchMapplsPlaces(query,webOptions);
  if(import.meta.env.VITE_NATIVE_MAPPLS_ENABLED==='false'){
    const cancelled=()=>{if(signal?.aborted)throw Object.assign(new Error('Search cancelled'),{code:'CANCELLED'});};
    cancelled();
    const results=await searchLocations(query,Math.min(8,Math.max(1,options.limit??6)),{provider:'photon',signal});
    cancelled();
    return results.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng)&&Math.abs(r.lat)<=90&&Math.abs(r.lng)<=180&&!(r.lat===0&&r.lng===0)).map(r=>({
      id:r.id??`${r.lat},${r.lng}`,placeId:'',label:r.label,name:r.name??r.label,address:r.address,lat:r.lat,lng:r.lng,provider:'photon' as const,category:r.category??null,
    }));
  }
  const {nativeMapBridge,NativeMapError}=await import('./nativeMapBridge');
  if(signal?.aborted) throw new NativeMapError('CANCELLED');
  const requestId=`search-${Date.now()}-${++requestSequence}`;
  const cancel=()=>{void nativeMapBridge.cancelSearch({requestId}).catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try {
    const response=await nativeMapBridge.searchPlaces({requestId,query,limit:Math.min(8,Math.max(1,options.limit ?? 8)),...(options.location ? {bias:options.location}:{})});
    if(signal?.aborted) throw new NativeMapError('CANCELLED');
    if(response.requestId!==requestId) throw new NativeMapError('STALE_HANDLE');
    return response.results;
  } finally {signal?.removeEventListener('abort',cancel);}
}

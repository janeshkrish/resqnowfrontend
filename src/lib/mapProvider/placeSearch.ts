import { usesNativeMap } from './platform';
import { searchMapplsPlaces, type MapplsPlaceSearchResult } from './mapplsSdk';

let requestSequence=0;
export async function searchMapPlaces(query:string,options:{limit?:number;location?:{lat:number;lng:number}|null;signal?:AbortSignal}={}):Promise<MapplsPlaceSearchResult[]> {
  const {signal,...webOptions}=options;
  if(!usesNativeMap()) return searchMapplsPlaces(query,webOptions);
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

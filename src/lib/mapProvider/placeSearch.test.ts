import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({platform:'web',web:vi.fn(),search:vi.fn(),cancel:vi.fn(),backend:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=>mocks.platform}}));
vi.mock('./mapplsSdk',()=>({searchMapplsPlaces:mocks.web}));
vi.mock('@/lib/geo',()=>({searchLocations:mocks.backend}));
vi.mock('./nativeMapBridge',()=>({nativeMapBridge:{searchPlaces:mocks.search,cancelSearch:mocks.cancel},NativeMapError:class extends Error { constructor(public code:string){super(code);} }}));
import { searchMapPlaces } from './placeSearch';
describe('platform place search',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  beforeEach(()=>{vi.clearAllMocks();mocks.platform='web';});
  it('keeps destination selection available through the existing Photon backend when Android maps are disabled',async()=>{
    vi.stubEnv('VITE_NATIVE_MAPPLS_ENABLED','false');mocks.platform='android';
    mocks.search.mockImplementation(async options=>({requestId:options.requestId,results:[]}));
    mocks.backend.mockResolvedValue([{id:'osm-1',address:'Garage, Coimbatore',label:'Garage',name:'Garage',lat:11.04,lng:76.99,provider:'photon'}, {address:'Invalid',lat:999,lng:77}]);
    const abort=new AbortController();const results=await searchMapPlaces('Garage',{limit:3,signal:abort.signal});
    expect(mocks.backend).toHaveBeenCalledWith('Garage',3,{provider:'photon',signal:abort.signal});
    expect(results).toEqual([{id:'osm-1',placeId:'',address:'Garage, Coimbatore',label:'Garage',name:'Garage',lat:11.04,lng:76.99,provider:'photon',category:null}]);
    expect(mocks.web).not.toHaveBeenCalled();expect(mocks.search).not.toHaveBeenCalled();
  });
  it('does not start backend or native work for an already-cancelled disabled-map search',async()=>{
    vi.stubEnv('VITE_NATIVE_MAPPLS_ENABLED','false');mocks.platform='android';const abort=new AbortController();abort.abort();
    await expect(searchMapPlaces('Garage',{signal:abort.signal})).rejects.toMatchObject({code:'CANCELLED'});
    expect(mocks.backend).not.toHaveBeenCalled();expect(mocks.search).not.toHaveBeenCalled();
  });
  it('preserves website search options and result identity',async()=>{
    const results=[{id:'place'}]; mocks.web.mockResolvedValue(results);
    expect(await searchMapPlaces('Garage',{limit:7,location:{lat:11,lng:77}})).toBe(results);
    expect(mocks.web).toHaveBeenCalledWith('Garage',{limit:7,location:{lat:11,lng:77}});
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it('uses native search and cancels only its own pending request',async()=>{
    mocks.platform='android'; let reject!:(error:unknown)=>void;
    mocks.search.mockImplementation(()=>new Promise((_,fail)=>{reject=fail;})); mocks.cancel.mockResolvedValue(undefined);
    const abort=new AbortController(); const pending=searchMapPlaces('Garage',{location:{lat:11,lng:77},signal:abort.signal});
    const assertion=expect(pending).rejects.toMatchObject({code:'CANCELLED'});
    await vi.waitFor(()=>expect(mocks.search).toHaveBeenCalledOnce());
    const request=mocks.search.mock.calls[0][0]; expect(request.bias).toEqual({lat:11,lng:77});
    abort.abort(); reject({code:'CANCELLED'}); await assertion;
    expect(mocks.cancel).toHaveBeenCalledWith({requestId:request.requestId}); expect(mocks.web).not.toHaveBeenCalled();
  });
});

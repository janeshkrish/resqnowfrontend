import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeMapEvent } from './nativeMapTypes';
const state=vi.hoisted(()=>({handlers:[] as ((event:NativeMapEvent)=>void)[],removes:[] as ReturnType<typeof vi.fn>[],
  available:vi.fn(),create:vi.fn(),destroy:vi.fn(),scene:vi.fn(),positions:vi.fn(),viewport:vi.fn(),camera:vi.fn(),appRemove:vi.fn()}));
vi.mock('@capacitor/app',()=>({App:{addListener:vi.fn(async()=>({remove:state.appRemove}))}}));
vi.mock('./nativeMapBridge',()=>({
  NativeMapError:class extends Error {constructor(public code:string){super(code);}},
  nativeMapBridge:{getAvailability:state.available,create:state.create,destroy:state.destroy,setOverlays:state.scene,updatePositions:state.positions,setViewport:state.viewport,setCamera:state.camera,
    addListener:vi.fn(async(_:string,fn:(event:NativeMapEvent)=>void)=>{state.handlers.push(fn);const remove=vi.fn();state.removes.push(remove);return {remove};})},
}));
import { NativeMapSurface } from './NativeMapSurface';
const rect=(width:number,height:number)=>({left:0,top:0,right:width,bottom:height,width,height,x:0,y:0,toJSON:()=>({})});
const props={ariaLabel:'Tracking',markers:[{id:'technician',position:{lat:11,lng:77},html:'web artwork',visual:{kind:'technician' as const,vehicle:'bike' as const,accessibleLabel:'Technician'}}],polylines:[],circles:[]};
function event(type:string,extra:Record<string,unknown>={}) {const owner=state.create.mock.calls.at(-1)?.[0];state.handlers.at(-1)?.({...owner,type,eventSequence:1,...extra} as NativeMapEvent);}
beforeEach(()=>{
  vi.clearAllMocks();state.handlers=[];state.removes=[];
  state.available.mockResolvedValue({available:true});
  for(const fn of [state.create,state.destroy,state.scene,state.positions,state.viewport,state.camera]) fn.mockResolvedValue(undefined);
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return this.dataset.nativeMapSurface!==undefined ? rect(300,200) : rect(600,700);});
  vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('native React surface',()=>{
  it('renders existing playback positions and cleans up StrictMode mounts',async()=>{
    const view=render(<StrictMode><NativeMapSurface {...props}/></StrictMode>);
    await waitFor(()=>expect(state.create).toHaveBeenCalledOnce());
    act(()=>event('ready',{capabilities:{markers:true,polylines:true,circles:true}}));
    expect(screen.queryByText('Loading map…')).not.toBeInTheDocument();
    view.rerender(<StrictMode><NativeMapSurface {...props} markers={[{...props.markers[0],position:{lat:11.002,lng:77.003}}]}/></StrictMode>);
    await waitFor(()=>expect(state.positions).toHaveBeenCalled());
    expect(state.positions.mock.calls.at(-1)?.[0].points[0].position).toEqual({lat:11.002,lng:77.003});
    view.unmount();await waitFor(()=>expect(state.destroy).toHaveBeenCalledOnce());
    expect(state.removes.every(remove=>remove.mock.calls.length===1)).toBe(true);
    expect(document.documentElement.hasAttribute('data-native-map-ancestor')).toBe(false);
  });
  it('uses a fresh generation on retry without invoking the web SDK',async()=>{
    state.available.mockResolvedValueOnce({available:false,code:'LICENSE'});
    const loadSdk=vi.fn();render(<NativeMapSurface {...props} loadSdk={loadSdk}/>);
    expect(await screen.findByText('Support code: LICENSE')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Retry map'}));await waitFor(()=>expect(state.create).toHaveBeenCalledOnce());
    expect(loadSdk).not.toHaveBeenCalled();
  });
  it('releases old tracking sessions and ignores their late events',async()=>{
    const down=vi.fn();const view=render(<NativeMapSurface {...props} onUnavailable={down} advancedTracking={{enabled:true,sessionId:'first',technician:null,destination:null}}/>);
    await waitFor(()=>expect(state.create).toHaveBeenCalledOnce());
    const oldOwner=state.create.mock.calls[0][0],oldListener=state.handlers[0];
    view.rerender(<NativeMapSurface {...props} onUnavailable={down} advancedTracking={{enabled:true,sessionId:'next',technician:null,destination:null}}/>);
    await waitFor(()=>expect(state.create).toHaveBeenCalledTimes(2));
    act(()=>oldListener({...oldOwner,type:'error',code:'LICENSE',message:'safe',retryable:true,eventSequence:2}));
    expect(down).not.toHaveBeenCalled();expect(state.create.mock.calls[1][0].generation).toBeGreaterThan(oldOwner.generation);
    await waitFor(()=>expect(state.destroy).toHaveBeenCalledWith({mapId:oldOwner.mapId,generation:oldOwner.generation}));
  });
});

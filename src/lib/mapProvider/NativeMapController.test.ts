import { describe, expect, it, vi } from 'vitest';
import { NativeMapController } from './NativeMapController';
import type { NativeMapEvent, NativeMapPlugin } from './nativeMapTypes';
import type { MapMarkerSpec } from './types';

function setup() {
  let listener: (event: NativeMapEvent) => void = () => {};
  const remove = vi.fn();
  const bridge = {
    getAvailability: vi.fn().mockResolvedValue({ available: true }),
    addListener: vi.fn(async (_: string, fn: typeof listener) => { listener=fn; return { remove }; }),
    create: vi.fn().mockResolvedValue(undefined), destroy: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined), setVisibility: vi.fn().mockResolvedValue(undefined),
    setOverlays: vi.fn().mockResolvedValue(undefined), updatePositions: vi.fn().mockResolvedValue(undefined),
    setCamera: vi.fn().mockResolvedValue(undefined),
  };
  const onError=vi.fn(), onReady=vi.fn(), onInteract=vi.fn();
  const controller=new NativeMapController(bridge as unknown as NativeMapPlugin,{ onError,onReady,onInteract });
  return { controller, bridge, remove, onError, onReady, onInteract, emit: (event: Partial<NativeMapEvent>) => listener({ ...controller.owner, eventSequence: 1, ...event } as NativeMapEvent) };
}
const marker = (lat=11, onClick=vi.fn()): MapMarkerSpec => ({ id: 'technician', position: { lat,lng:77 }, html:'unchanged website art',
  visual:{ kind:'technician', accessibleLabel:'Technician',vehicle:'bike' }, heading:90, onClick });
const scene = (markers=[marker()]) => ({ markers, polylines:[{ id:'road',points:[{lat:11,lng:77},{lat:11.1,lng:77.1}],color:'#283048',width:4,opacity:1 }],circles:[] });
const viewport = { frame:{left:0,top:0,width:300,height:200},clip:{left:0,top:0,width:300,height:200},visualViewport:{width:300,height:600,scale:1,offsetLeft:0,offsetTop:0},excludedRects:[],cornerRadius:10,visible:true,interactive:true };

describe('native map renderer adapter', () => {
  it('coalesces playback frames while a native scene command is still pending', async () => {
    const s=setup();let resolve!:()=>void;
    s.bridge.setOverlays.mockImplementationOnce(()=>new Promise<void>(done=>{resolve=done;}));
    s.controller.setScene(scene());const starting=s.controller.start('Tracking');
    await vi.waitFor(()=>expect(s.bridge.setOverlays).toHaveBeenCalledOnce());
    s.controller.setScene(scene([marker(11.001)]));s.controller.setScene(scene([marker(11.002)]));
    resolve();await starting;await s.controller.flush();
    expect(s.bridge.updatePositions).toHaveBeenCalledOnce();
    expect(s.bridge.updatePositions.mock.calls[0][0].points[0].position).toEqual({lat:11.002,lng:77});
    await s.controller.dispose();
  });
  it('subscribes before create and forwards existing route/positions without another tracking clock', async () => {
    const s=setup(); s.controller.setScene(scene()); s.controller.setViewport(viewport);
    await s.controller.start('Tracking'); await s.controller.flush();
    expect(s.bridge.addListener.mock.invocationCallOrder[0]).toBeLessThan(s.bridge.create.mock.invocationCallOrder[0]);
    expect(s.bridge.setOverlays).toHaveBeenCalledOnce();
    expect(s.bridge.setOverlays.mock.calls[0][0].polylines[0].points).toEqual(scene().polylines[0].points);
    s.controller.setScene(scene([marker(11.002)])); await s.controller.flush();
    expect(s.bridge.setOverlays).toHaveBeenCalledOnce();
    expect(s.bridge.updatePositions.mock.calls.at(-1)?.[0].points[0].position).toEqual({lat:11.002,lng:77});
    await s.controller.dispose(); expect(s.remove).toHaveBeenCalledOnce(); expect(s.bridge.destroy).toHaveBeenCalledOnce();
  });
  it('routes marker callbacks through the latest props and drops old-generation events', async () => {
    const s=setup(), first=vi.fn(), latest=vi.fn(); s.controller.setScene(scene([marker(11,first)]));
    await s.controller.start('Tracking'); await s.controller.flush();
    const markerId=s.bridge.setOverlays.mock.calls[0][0].markers[0].id;
    s.controller.setScene(scene([marker(11,latest)])); await s.controller.flush();
    s.emit({type:'markerClick',markerId});
    s.emit({type:'markerClick',markerId,generation:s.controller.owner.generation-1,eventSequence:2});
    expect(latest).toHaveBeenCalledOnce(); expect(first).not.toHaveBeenCalled();
    expect(s.onInteract).toHaveBeenCalledOnce();
    await s.controller.dispose();
  });
  it('bounds native presentation text without changing the full React labels',async()=>{
    const s=setup(),m=marker();const label='A long business name '.repeat(15);
    m.visual={...m.visual!,accessibleLabel:label,label};s.controller.setScene(scene([m]));
    await s.controller.start('Map');await s.controller.flush();
    const visual=s.bridge.setOverlays.mock.calls[0][0].markers[0].visual;
    expect(visual.accessibleLabel.length).toBeLessThanOrEqual(120);expect(visual.label.length).toBeLessThanOrEqual(120);
    expect(m.visual.accessibleLabel).toBe(label);await s.controller.dispose();
  });
  it('cleans up an asynchronous create after unmount', async () => {
    const s=setup(); let resolve!:()=>void;
    s.bridge.create.mockImplementation(()=>new Promise<void>(done=>{resolve=done;}));
    const starting=s.controller.start('Map');
    await vi.waitFor(()=>expect(s.bridge.create).toHaveBeenCalledOnce());
    const disposing=s.controller.dispose(); resolve(); await starting; await disposing;
    expect(s.bridge.destroy).toHaveBeenCalledOnce(); expect(s.bridge.setOverlays).not.toHaveBeenCalled(); expect(s.remove).toHaveBeenCalledOnce();
  });
  it('converts source camera revisions to monotonic native revisions without changing camera intent', async () => {
    const s=setup(); await s.controller.start('Map');
    s.controller.setCamera({mode:'fit',points:[{lat:11,lng:77}],maxZoom:15,padding:{top:0,right:0,bottom:0,left:0},revision:-.5});
    await s.controller.flush();
    s.controller.setCamera({mode:'follow',center:{lat:11.1,lng:77.1},zoom:16,revision:0}); await s.controller.flush();
    const calls=s.bridge.setCamera.mock.calls;
    expect(calls[1][0].camera.revision).toBeGreaterThan(calls[0][0].camera.revision);
    expect(calls[1][0].camera.center).toEqual({lat:11.1,lng:77.1});
    await s.controller.dispose();
  });
  it('reports native initialization failures explicitly', async () => {
    const s=setup(); s.bridge.getAvailability.mockResolvedValue({available:false,code:'LICENSE'});
    await s.controller.start('Map'); expect(s.onError).toHaveBeenCalledWith(expect.objectContaining({code:'LICENSE'}));
    expect(s.bridge.create).not.toHaveBeenCalled(); await s.controller.dispose();
  });
  it('reports missing semantic visuals instead of parsing website marker HTML', async () => {
    const s=setup(); const m=marker(); delete m.visual;
    s.controller.setScene(scene([m])); await s.controller.start('Map'); await s.controller.flush();
    expect(s.onError).toHaveBeenCalledWith(expect.objectContaining({code:'UNSUPPORTED'}));
    await s.controller.dispose();
  });
});

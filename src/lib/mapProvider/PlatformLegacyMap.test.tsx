import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({native:false,capture:vi.fn()}));
vi.mock('./platform',()=>({usesNativeMap:()=>state.native}));
vi.mock('./PlatformMapSurface',()=>({PlatformMapSurface:(props:any)=>{state.capture(props);return <div>{props.markers.map((m:any)=><button key={m.id} onClick={m.onClick}>{m.id}</button>)}</div>;}}));
import { PlatformLegacyMap, useLegacyMapCamera } from './PlatformLegacyMap';
describe('existing Leaflet screen native adapter',()=>{
  beforeEach(()=>{vi.clearAllMocks();state.native=false;});
  const markers=[{id:'pickup',position:{lat:11,lng:77},html:'',visual:{kind:'pickup' as const,accessibleLabel:'Customer Location'}}];
  const camera={mode:'fit' as const,points:[{lat:11,lng:77}],maxZoom:13,padding:{top:20,right:20,bottom:20,left:20},revision:1};
  it('leaves the existing browser subtree intact',()=>{
    render(<PlatformLegacyMap ariaLabel="Job" markers={markers} camera={camera}><div>Original Leaflet map</div></PlatformLegacyMap>);
    expect(screen.getByText('Original Leaflet map')).toBeInTheDocument();expect(state.capture).not.toHaveBeenCalled();
  });
  it('uses real supplied coordinates and keeps marker popup interaction on Android',()=>{
    state.native=true;render(<PlatformLegacyMap ariaLabel="Job" markers={markers} camera={camera}><div>Original Leaflet map</div></PlatformLegacyMap>);
    expect(screen.queryByText('Original Leaflet map')).not.toBeInTheDocument();
    expect(state.capture.mock.calls[0][0].markers[0].position).toEqual({lat:11,lng:77});
    fireEvent.click(screen.getByText('pickup'));expect(screen.getByRole('status')).toHaveTextContent('Customer Location');
  });
  it('updates camera only when the existing coordinate intent changes',()=>{
    const hook=renderHook(({lat})=>useLegacyMapCamera([{lat,lng:77}],20,15),{initialProps:{lat:11}});
    const revision=hook.result.current.revision;hook.rerender({lat:11});expect(hook.result.current.revision).toBe(revision);
    hook.rerender({lat:11.1});expect(hook.result.current.revision).toBeGreaterThan(revision);
  });
});

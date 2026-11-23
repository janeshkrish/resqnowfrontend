import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({native:true}));
vi.mock('@/lib/mapProvider/platform',()=>({usesNativeMap:()=>state.native}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({isAuthenticated:true})}));
vi.mock('@/hooks/useRealtimeServiceRequest',()=>({useRealtimeServiceRequest:()=>({request:null,technician:null,isConnected:true,trackingFreshness:'LIVE'})}));
vi.mock('./ActiveRequestMap',()=>({default:({onUnavailable}:{onUnavailable:()=>void})=><button onClick={onUnavailable}>Map failure</button>}));
import ActiveRequestCard from './ActiveRequestCard';
function card() {
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  client.setQueryData(['home','my-requests'],[{id:1,status:'assigned',location_lat:11,location_lng:77}]);
  return render(<QueryClientProvider client={client}><MemoryRouter><ActiveRequestCard/></MemoryRouter></QueryClientProvider>);
}
describe('home map platform failure handling',()=>{
  beforeEach(()=>{state.native=true;});
  it('never substitutes the illustrative moving vehicle after native failure',async()=>{
    const view=card();fireEvent.click(await screen.findByText('Map failure'));
    await waitFor(()=>expect(screen.getByTestId('home-request-map')).toHaveAttribute('data-map','live'));
    expect(view.container.querySelector('.rq-h-map-mover')).toBeNull();
  });
  it('preserves the existing website fallback',async()=>{
    state.native=false;card();fireEvent.click(await screen.findByText('Map failure'));
    await waitFor(()=>expect(screen.getByTestId('home-request-map')).toHaveAttribute('data-map','drawn'));
  });
});

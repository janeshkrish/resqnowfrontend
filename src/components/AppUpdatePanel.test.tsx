import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import fixture from '@/test/fixtures/android-release.json';
import { AppUpdateProvider } from './AppUpdateProvider';
import { AppUpdatePanel } from './AppUpdatePanel';

const mock=vi.hoisted(()=>({bridge:null as any,tech:false,busy:false}));
vi.mock('@/lib/appUpdates/native',()=>({getAppUpdater:()=>mock.bridge}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:mock.tech?null:{id:'customer'}})}));
vi.mock('@/contexts/TechnicianAuthContext',()=>({useTechnicianAuth:()=>({technician:mock.tech?{id:'technician'}:null,isOnline:false})}));
vi.mock('@/contexts/TechnicianJobContext',()=>({useTechnicianJob:()=>({acceptedJobId:mock.busy?'job':null,pendingAcceptanceId:null})}));
vi.mock('@/lib/api',()=>({API_BASE_URL:'https://api.example',apiFetch:async(path:string)=>new Response(path.includes('active-job')?'null':'[]')}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();mock.bridge=null;mock.tech=false;mock.busy=false;});
function setup(phase='ready',path='/settings'){
  const state={phase,release:fixture,enabled:true,installedVersionCode:4,installedVersionName:'1.3',sdkVersion:36,bytesDownloaded:16};
  mock.bridge={getState:vi.fn(async()=>state),scheduleDownload:vi.fn(async()=>state),requestInstall:vi.fn(async()=>state),cancelDownload:vi.fn(async()=>({...state,phase:'cancelled'})),cancelInstallPreparation:vi.fn(async()=>{}),openInstallPermissionSettings:vi.fn(async()=>{}),addListener:vi.fn(async()=>({remove:async()=>{}}))};
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({state:'ready',release:fixture}))));
  render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}} initialEntries={[path]}><AppUpdateProvider><AppUpdatePanel /></AppUpdateProvider></MemoryRouter>);
  return mock.bridge;
}
it.each([false,true])('shows native controls for customer/technician=%s without auto-install',async tech=>{
  mock.tech=tech;const bridge=setup('ready',tech?'/technician/profile':'/settings');
  fireEvent.click(await screen.findByRole('button',{name:'Update now'}));await waitFor(()=>expect(bridge.requestInstall).toHaveBeenCalledTimes(1));
});
it('shows no Android updater in web/PWA',()=>{render(<MemoryRouter><AppUpdateProvider><AppUpdatePanel /></AppUpdateProvider></MemoryRouter>);expect(screen.queryByText('App updates')).not.toBeInTheDocument();});
it('does not open the installer when source settings are opened or returned from',async()=>{
  const bridge=setup('permission-required');fireEvent.click(await screen.findByRole('button',{name:'Allow app updates'}));await waitFor(()=>expect(bridge.openInstallPermissionSettings).toHaveBeenCalledTimes(1));
  await act(async()=>{fireEvent(document,new Event('visibilitychange'));await new Promise(resolve=>setTimeout(resolve,0));});expect(bridge.requestInstall).not.toHaveBeenCalled();
});
it('offers explicit mobile data and cancel while waiting for Wi-Fi',async()=>{
  const bridge=setup('queued');fireEvent.click(await screen.findByRole('button',{name:'Download using mobile data'}));await waitFor(()=>expect(bridge.scheduleDownload).toHaveBeenCalledWith({release:fixture,allowMetered:true}));
  fireEvent.click(screen.getByRole('button',{name:'Cancel download'}));await waitFor(()=>expect(bridge.cancelDownload).toHaveBeenCalledTimes(1));
});
it('defers installation during an accepted technician job',async()=>{
  mock.tech=true;mock.busy=true;const bridge=setup('ready','/technician/profile');expect(await screen.findByRole('button',{name:'Update now'})).toBeDisabled();expect(bridge.requestInstall).not.toHaveBeenCalled();
});

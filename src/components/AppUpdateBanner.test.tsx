import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import fixture from '@/test/fixtures/android-release.json';
import { AppUpdateProvider } from './AppUpdateProvider';
import { AppUpdateBanner, laterActive } from './AppUpdateBanner';

type Bridge=Record<string,ReturnType<typeof vi.fn>>;
const mock=vi.hoisted(()=>({bridge:null as Bridge|null,rows:[] as unknown[],tech:false,online:false}));
vi.mock('@/lib/appUpdates/native',()=>({getAppUpdater:()=>mock.bridge}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:mock.tech?null:{id:'customer'}})}));
vi.mock('@/contexts/TechnicianAuthContext',()=>({useTechnicianAuth:()=>({technician:mock.tech?{id:'technician'}:null,isOnline:mock.online})}));
vi.mock('@/contexts/TechnicianJobContext',()=>({useTechnicianJob:()=>({acceptedJobId:null,pendingAcceptanceId:null})}));
vi.mock('@/lib/api',()=>({API_BASE_URL:'https://api.example',apiFetch:async(path:string)=>new Response(path.includes('active-job')?'null':JSON.stringify(mock.rows))}));

const Where=()=>{const l=useLocation();return <output aria-label="where">{l.pathname+l.hash}</output>;};
let listeners:Record<string,(value?:unknown)=>void>={};
function setup(phase='ready',state:Record<string,unknown>={}){
  const snapshot={phase,release:fixture,enabled:true,installedVersionCode:4,installedVersionName:'1.3',sdkVersion:36,bytesDownloaded:fixture.sizeBytes,...state};
  listeners={};
  mock.bridge={getState:vi.fn(async()=>snapshot),scheduleDownload:vi.fn(async()=>snapshot),requestInstall:vi.fn(async()=>snapshot),cancelDownload:vi.fn(async()=>snapshot),cancelInstallPreparation:vi.fn(async()=>{}),openInstallPermissionSettings:vi.fn(async()=>{}),
    setAlertsQuiet:vi.fn(async()=>{}),addListener:vi.fn(async(event:string,f:(value?:unknown)=>void)=>{listeners[event]=f;return {remove:async()=>{}};})};
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({state:'ready',release:fixture}))));
  render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}} initialEntries={['/']}><AppUpdateProvider><AppUpdateBanner /><Where /></AppUpdateProvider></MemoryRouter>);
  return mock.bridge as Bridge;
}
beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.unstubAllGlobals();mock.bridge=null;mock.rows=[];mock.tech=false;mock.online=false;});

it('shows a ready update under the header; Update opens Android\'s confirmation and remembers the version',async()=>{
  const bridge=setup();
  expect(await screen.findByText('New version ready')).toBeInTheDocument();
  expect(screen.getByText(`${fixture.versionName} · ready to install`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Update'}));
  await waitFor(()=>expect(bridge.requestInstall).toHaveBeenCalledTimes(1));
  expect(localStorage.getItem('resqnow_update_expected')).toBe(String(fixture.versionCode));
  await waitFor(()=>expect(bridge.setAlertsQuiet).toHaveBeenLastCalledWith({quiet:false}));
});

it('Later hides it for a day for this version only',async()=>{
  setup();
  fireEvent.click(await screen.findByRole('button',{name:'Later. Hide this until tomorrow'}));
  expect(screen.queryByText('New version ready')).not.toBeInTheDocument();
  const now=Date.now();
  expect(laterActive(fixture.versionCode,now)).toBe(true);
  expect(laterActive(fixture.versionCode,now+25*60*60*1000)).toBe(false);
  expect(laterActive(fixture.versionCode+1,now)).toBe(false);
});

it('waits while the customer has a request open, and tells Android to keep the notification quiet',async()=>{
  mock.rows=[{id:7,serviceStatus:'on_the_way',payment_status:'pending'}];
  const bridge=setup();
  await waitFor(()=>expect(bridge.setAlertsQuiet).toHaveBeenLastCalledWith({quiet:true}));
  expect(screen.queryByText('New version ready')).not.toBeInTheDocument();
});

it('stays hidden until the download is verified and ready',async()=>{
  const bridge=setup('downloading',{bytesDownloaded:1});
  await waitFor(()=>expect(bridge.getState).toHaveBeenCalled());
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  expect(screen.queryByText('New version ready')).not.toBeInTheDocument();
});

it('tapping the phone notification opens App updates',async()=>{
  setup();
  await waitFor(()=>expect(listeners.updateAlertOpened).toBeTypeOf('function'));
  await act(async()=>{listeners.updateAlertOpened();});
  expect(screen.getByLabelText('where')).toHaveTextContent('/settings#app-updates');
});

it('after the update says once that the app is up to date',async()=>{
  localStorage.setItem('resqnow_update_expected','4');
  setup('idle',{release:undefined,bytesDownloaded:0});
  expect(await screen.findByText("You're up to date · 1.3")).toBeInTheDocument();
  expect(localStorage.getItem('resqnow_update_expected')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'OK'}));
  expect(screen.queryByText("You're up to date · 1.3")).not.toBeInTheDocument();
});

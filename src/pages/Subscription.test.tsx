import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ token: 'token-a' as string | null, saved: null as any, plan: 'free',
  profileFails: false, verifySucceeds: true, fetch: vi.fn(), checkout: null as any,
  success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiFetch: (...args: any[]) => api.fetch(...args), getUserToken: () => api.token,
  setUserToken: (token: string | null) => { api.token = token; }, setUserProfile: (p: any) => { api.saved = p; },
  getUserProfile: () => api.saved, setAdminToken: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: api.success, error: api.error, info: api.info } }));
vi.mock('@/components/ui/sonner', () => ({ toast: { success: api.success, error: api.error, info: api.info } }));
vi.mock('@/hooks/usePricingConfig', () => ({ usePricingConfig: () => ({ data: { currency:'INR', subscription_plans:
  [['free','Pay as you go',0],['basic','Basic',99],['premium','Premium',199],['roadside-plus','Roadside Plus',299]].map(([id,name,amount]) =>
    ({id,name,amount,active:true,features:[],notIncluded:[],idealFor:[]})) } }) }));
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Subscription from './Subscription';
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status });
function Account() {
  const auth = useAuth();
  return <><output aria-label='Account plan'>{auth.user?.subscription || 'loading'}</output>
    <button onClick={() => void auth.login('b@example.test','password')}>Switch account</button></>;
}
function mount() {
  return render(<MemoryRouter initialEntries={['/subscription']}><AuthProvider><Account/><Routes>
    <Route path='/subscription' element={<Subscription/>}/><Route path='/' element={<p>Home</p>}/>
  </Routes></AuthProvider></MemoryRouter>);
}
beforeEach(() => {
  localStorage.clear(); api.token='token-a'; api.saved=null; api.plan='free'; api.profileFails=false; api.verifySucceeds=true;
  api.fetch.mockReset(); api.success.mockReset(); api.error.mockReset(); api.info.mockReset(); api.checkout=null;
  api.fetch.mockImplementation(async (path: string) => {
    if (path === '/api/auth/me') return api.profileFails ? json({error:'Profile unavailable'},503)
      : json({id:api.token==='token-b'?'user-b':'user-a',name:'Customer',email:'a@example.test',subscription:api.token==='token-b'?'free':api.plan});
    if (path === '/api/users/login') return json({token:'token-b',user:{id:'user-b',name:'B'}});
    if (path === '/api/payments/create-subscription-order') return json({success:true,order_id:'order_bound',amount:9900,currency:'INR',key_id:'rzp_test_only'});
    if (path === '/api/payments/verify-subscription-payment') return json({success:api.verifySucceeds},api.verifySucceeds?200:400);
    throw new Error(`Unexpected API ${path}`);
  });
  (window as any).Razorpay = function(options: any) { api.checkout=options; this.open=vi.fn(); };
});
async function checkout(planName='Basic') {
  await waitFor(() => expect(screen.getByLabelText('Account plan')).toHaveTextContent('free'));
  fireEvent.click(screen.getByRole('button',{name:`Subscribe to ${planName}`}));
  await waitFor(() => expect(api.checkout).not.toBeNull());
}
const proof = {razorpay_order_id:'order_bound',razorpay_payment_id:'pay_captured',razorpay_signature:'test-signature'};

it('verified purchase displays the current server plan rather than granting the selected plan locally', async () => {
  mount(); await checkout(); api.plan='premium';
  await act(async () => { await api.checkout.handler(proof); });
  expect(screen.getByLabelText('Account plan')).toHaveTextContent('premium');
  expect(api.saved.subscription).toBe('premium'); expect(screen.getByText('Home')).toBeInTheDocument();
});

it('configured custom plan IDs survive successful verification and server refresh', async () => {
  mount(); await checkout('Roadside Plus'); api.plan='roadside-plus';
  await act(async () => { await api.checkout.handler(proof); });
  expect(screen.getByLabelText('Account plan')).toHaveTextContent('roadside-plus');
});

it('failed verification cannot grant a paid plan or announce activation', async () => {
  mount(); await checkout(); api.verifySucceeds=false;
  await act(async () => { await api.checkout.handler(proof); });
  expect(screen.getByLabelText('Account plan')).toHaveTextContent('free'); expect(api.success).not.toHaveBeenCalled();
});

it('a verified payment followed by profile failure does not grant locally and recovers on returning to the app', async () => {
  mount(); await checkout(); api.plan='premium'; api.profileFails=true;
  await act(async () => { await api.checkout.handler(proof); });
  expect(screen.getByLabelText('Account plan')).toHaveTextContent('free'); expect(api.success).not.toHaveBeenCalled();
  expect(api.info).toHaveBeenCalledWith(expect.stringMatching(/verified.*refresh/i));
  api.profileFails=false;
  act(() => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(screen.getByLabelText('Account plan')).toHaveTextContent('premium'));
});

it('paid customers are not offered a fake local-only switch to free', async () => {
  api.plan='premium'; mount();
  await waitFor(() => expect(screen.getByLabelText('Account plan')).toHaveTextContent('premium'));
  expect(screen.queryByRole('button',{name:'Switch to Free'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Included by default'})).toBeDisabled();
});

it('an old checkout callback cannot refresh or verify payment in a different customer session', async () => {
  mount(); await checkout();
  fireEvent.click(screen.getByRole('button',{name:'Switch account'}));
  await waitFor(() => expect(api.saved?.id).toBe('user-b'));
  await act(async () => { await api.checkout.handler(proof); });
  expect(api.saved.id).toBe('user-b'); expect(api.saved.subscription).toBe('free');
  expect(api.fetch.mock.calls.map(call=>call[0])).not.toContain('/api/payments/verify-subscription-payment');
  expect(api.success).not.toHaveBeenCalled();
});

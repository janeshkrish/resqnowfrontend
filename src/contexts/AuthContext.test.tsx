import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ fetch: vi.fn(), token: null as string | null, profile: null as any }));
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: any[]) => api.fetch(...args),
  getUserToken: () => api.token,
  setUserToken: (value: string | null) => { api.token = value; },
  getUserProfile: () => api.profile,
  setUserProfile: (value: any) => { api.profile = value; },
  setAdminToken: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { AuthProvider, useAuth } from './AuthContext';
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const profile = (subscription = 'premium', id = 'user-a') => ({ id, name: 'Customer', email: `${id}@example.test`,
  subscription, isVerified: true, phone: '9000000001' });
const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

beforeEach(() => { localStorage.clear(); api.fetch.mockReset(); api.token = null; api.profile = null; });

describe('authoritative subscription profiles', () => {
  it.each(['premium', 'basic', 'roadside-plus'])('hydrates %s from the server and preserves it after remount', async (plan) => {
    api.token = 'token-a'; api.profile = { ...profile('free') };
    api.fetch.mockResolvedValue(json(profile(plan)));
    const first = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.user?.subscription).toBe(plan);
    expect(api.profile.subscription).toBe(plan);
    first.unmount();
    api.fetch.mockResolvedValue(json(profile(plan)));
    const second = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.user?.subscription).toBe(plan);
  });

  it.each(['email', 'phone', 'otp'])('%s sign-in reads the current server plan when login has no entitlement field', async (kind) => {
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.fetch.mockImplementation(async (path: string) => path === '/api/auth/me'
      ? json(profile('premium')) : json({ token: 'token-a', user: { id: 'user-a', name: 'Customer', email: 'a@example.test', isVerified: true } }));
    await act(async () => {
      if (kind === 'email') await result.current.login('a@example.test', 'password');
      if (kind === 'phone') await result.current.loginWithPhone('firebase-token');
      if (kind === 'otp') await result.current.verifyOtp('a@example.test', '123456', 'Customer', 'password');
    });
    expect(result.current.user?.subscription).toBe('premium');
    expect(api.profile.subscription).toBe('premium');
  });

  it('uses the no-cache server profile rather than a selected plan when refreshing', async () => {
    api.token = 'token-a'; api.fetch.mockResolvedValue(json(profile('basic')));
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.fetch.mockImplementation(async (path: string, options: any) => {
      expect(path).toBe('/api/auth/me'); expect(options?.cache).toBe('no-store');
      return json(profile('roadside-plus'));
    });
    await act(async () => { await result.current.refreshUser(); });
    expect(result.current.user?.subscription).toBe('roadside-plus');
  });

  it('a failed refresh preserves the last server plan and a retry recovers the paid plan', async () => {
    api.token = 'token-a'; api.fetch.mockResolvedValue(json(profile('basic')));
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.fetch.mockResolvedValue(json({ error: 'Temporarily unavailable' }, 503));
    await act(async () => { await expect(result.current.refreshUser()).rejects.toThrow(); });
    expect(result.current.user?.subscription).toBe('basic');
    api.fetch.mockResolvedValue(json(profile('premium')));
    await act(async () => { await result.current.refreshUser(); });
    expect(result.current.user?.subscription).toBe('premium');
  });

  it('an older refresh cannot overwrite a newer paid profile', async () => {
    api.token = 'token-a'; api.fetch.mockResolvedValue(json(profile('free')));
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const old = deferred<Response>();
    api.fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(json(profile('premium')));
    let pending!: Promise<unknown>;
    await act(async () => { pending = result.current.refreshUser(); await result.current.refreshUser(); });
    await act(async () => { old.resolve(json(profile('free'))); await pending; });
    expect(result.current.user?.subscription).toBe('premium');
  });

  it('a delayed old-account profile cannot replace a new login', async () => {
    api.token = 'token-a';
    const old = deferred<Response>(); api.fetch.mockReturnValueOnce(old.promise);
    const { result } = renderHook(useAuth, { wrapper });
    api.fetch.mockImplementation(async (path: string) => path === '/api/auth/me'
      ? json(profile('free', 'user-b')) : json({ token: 'token-b', user: profile('free', 'user-b') }));
    await act(async () => { await result.current.login('b@example.test', 'password'); });
    await act(async () => { old.resolve(json(profile('premium', 'user-a'))); });
    expect(result.current.user?.id).toBe('user-b'); expect(result.current.user?.subscription).toBe('free');
    expect(api.profile.id).toBe('user-b');
  });

  it('successful credentials with a failed profile read never invent a free entitlement', async () => {
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.fetch.mockImplementation(async (path: string) => path === '/api/auth/me'
      ? json({ error: 'Try again' }, 503) : json({ token: 'token-a', user: profile('premium') }));
    await act(async () => { await expect(result.current.login('a@example.test', 'password')).rejects.toThrow(); });
    expect(result.current.user).toBeNull(); expect(api.token).toBeNull();
  });

  it('profile editing cannot fabricate a free downgrade from a local payload', async () => {
    api.token = 'token-a'; api.fetch.mockResolvedValue(json(profile('premium')));
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.fetch.mockImplementation(async (path: string) => path === '/api/auth/me'
      ? json({ ...profile('premium'), name: 'Updated' }) : json({ success: true }));
    await act(async () => { await result.current.updateProfile({ name: 'Updated', subscription: 'free' }); });
    expect(result.current.user?.name).toBe('Updated'); expect(result.current.user?.subscription).toBe('premium');
  });

  it('returning to the app refreshes a plan activated by a delayed server confirmation', async () => {
    api.token = 'token-a'; api.fetch.mockResolvedValue(json(profile('free')));
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.fetch.mockResolvedValue(json(profile('premium')));
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(result.current.user?.subscription).toBe('premium'));
  });

  it('a new phone number needing a name does not invent an authenticated free account', async () => {
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.fetch.mockResolvedValue(json({ needsName: true }));
    await act(async () => { expect(await result.current.loginWithPhone('firebase-token')).toEqual({ needsName: true, isNew: false }); });
    expect(result.current.user).toBeNull(); expect(api.token).toBeNull();
  });

  it('admin sign-in does not load or grant customer subscription state', async () => {
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.fetch.mockResolvedValue(json({ role: 'admin', token: 'admin-token', user: { id: 'admin', name: 'Admin' } }));
    await act(async () => { await result.current.login('admin@example.test', 'password'); });
    expect(result.current.user).toBeNull(); expect(api.token).toBeNull();
    expect(api.fetch.mock.calls.map(call => call[0])).not.toContain('/api/auth/me');
  });

  it('aborting email login while its profile is pending cannot authenticate or report success', async () => {
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const pending = deferred<Response>();
    const started = deferred<void>();
    let profileOptions: any;
    api.fetch.mockImplementation(async (path: string, options: any) => {
      if (path === '/api/auth/me') { profileOptions=options; started.resolve(); return pending.promise; }
      return json({token:'token-a',user:{id:'user-a',name:'Customer'}});
    });
    const controller = new AbortController();
    let outcome!: Promise<any>;
    await act(async () => {
      outcome=result.current.login('a@example.test','password',{signal:controller.signal})
        .then(() => ({success:true}),error => ({error}));
      await started.promise;
    });
    await act(async () => { controller.abort(); pending.resolve(json(profile('premium'))); await outcome; });
    expect((await outcome).error?.name).toBe('AbortError');
    expect(profileOptions.signal).toBe(controller.signal);
    expect(result.current.user).toBeNull(); expect(api.token).toBeNull(); expect(api.profile).toBeNull();
  });
});

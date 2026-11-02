import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let previousFetch: typeof window.fetch;
beforeEach(() => {
  previousFetch=window.fetch; localStorage.clear(); vi.resetModules();
  vi.stubEnv('VITE_FRONTEND_ONLY','true'); vi.stubEnv('VITE_API_URL','');
  localStorage.setItem('resqnow_user_token','demo-user-token');
});
afterEach(() => { window.fetch=previousFetch; vi.unstubAllEnvs(); });
it('demo verified subscription is returned by subsequent authoritative profile reads', async () => {
  const { apiFetch } = await import('./api');
  expect((await (await apiFetch('/api/auth/me')).json()).subscription).toBe('free');
  const verified=await apiFetch('/api/payments/verify-subscription-payment',{method:'POST',body:JSON.stringify({planId:'basic'})});
  expect(verified.ok).toBe(true);
  expect((await (await apiFetch('/api/auth/me',{cache:'no-store'})).json()).subscription).toBe('basic');
});
it('demo unknown plan cannot replace an existing plan', async () => {
  const { apiFetch } = await import('./api');
  const response=await apiFetch('/api/payments/verify-subscription-payment',{method:'POST',body:JSON.stringify({planId:'unknown-plan'})});
  expect(response.status).toBe(400);
  expect((await (await apiFetch('/api/auth/me')).json()).subscription).toBe('free');
});

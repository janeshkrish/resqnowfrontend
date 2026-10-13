import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let previousFetch: typeof window.fetch;
beforeEach(() => {
  previousFetch = window.fetch;
  localStorage.clear();
  vi.resetModules();
  vi.stubEnv('VITE_FRONTEND_ONLY', 'true');
  vi.stubEnv('VITE_API_URL', '');
  localStorage.setItem('resqnow_technician_token', 'demo-tech-token');
  localStorage.setItem('resqnow_technician', JSON.stringify({ id: 'tech-101' }));
});
afterEach(() => { window.fetch = previousFetch; vi.unstubAllEnvs(); });

it('demo recovery reads the stored assignment before and after accepting it', async () => {
  const { acceptanceTechnicianId, postJobAcceptance, readJobAcceptance } = await import('./technicianJobAcceptance');
  expect(acceptanceTechnicianId()).toBe('demo:tech-101');
  expect(await readJobAcceptance('req-1001')).toEqual({ state: 'available' });
  await postJobAcceptance('req-1001');
  expect(await readJobAcceptance('req-1001')).toMatchObject({ state: 'accepted', job: { id: 'req-1001' } });
});

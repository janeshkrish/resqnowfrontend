import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TechnicianJobProvider, useTechnicianJob } from './TechnicianJobContext';

const api = vi.hoisted(() => ({ fetch: vi.fn(), token: '', demo: false }));
vi.mock('@/lib/api', () => ({
  get FRONTEND_ONLY_MODE() { return api.demo; },
  apiFetch: api.fetch,
  getTechnicianToken: () => api.token,
  readJsonSafely: async (response: Response) => response.json(),
}));

const tokenFor = (id: number) => `header.${btoa(JSON.stringify({ id, type: 'technician' }))}.signature`;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const accepted = { id: 101, technician_id: 7, status: 'accepted' };
const key = 'resqnow_pending_acceptance_7';
function show() {
  return renderHook(() => ({ ...useTechnicianJob(), path: useLocation().pathname }), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/technician/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TechnicianJobProvider>{children}</TechnicianJobProvider></MemoryRouter>,
  });
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); api.token = tokenFor(7); api.demo = false; api.fetch.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('authoritative job acceptance', () => {
  it('retains an uncertain acceptance instead of treating a lost response as failure', async () => {
    api.fetch.mockRejectedValue(new TypeError('Network disconnected'));
    const { result } = show();
    await act(async () => { await expect(result.current.acceptJob('101')).rejects.toMatchObject({ code: 'acceptance_unknown' }); });
    expect(result.current.pendingAcceptanceId).toBe('101');
    expect(result.current.acceptedJobId).toBeNull();
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ jobId: '101' });
  });

  it('restores a committed acceptance after restart using GET only', async () => {
    localStorage.setItem(key, JSON.stringify({ jobId: '101' }));
    api.fetch.mockResolvedValue(response({ state: 'accepted', job: accepted }));
    const { result } = show();
    await waitFor(() => expect(result.current.acceptedJobId).toBe('101'));
    expect(result.current.path).toBe('/technician/active-job/101');
    expect(localStorage.getItem(key)).toBeNull();
    expect(api.fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('rechecks ownership on reconnect without replaying acceptance', async () => {
    api.fetch.mockRejectedValue(new TypeError('Offline'));
    const { result } = show();
    await act(async () => { await result.current.acceptJob('101').catch(() => {}); });
    api.fetch.mockImplementation(async (path: string) => path.endsWith('/acceptance') ? response({ state: 'accepted', job: accepted }) : response({}));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(result.current.acceptedJobId).toBe('101'));
    expect(api.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it('reports a busy technician distinctly and clears a definitive conflict', async () => {
    api.fetch.mockResolvedValue(response({ code: 'technician_busy', error: 'You already have another active job.' }, 409));
    const { result } = show();
    await act(async () => { await expect(result.current.acceptJob('101')).rejects.toMatchObject({ code: 'technician_busy' }); });
    expect(result.current.pendingAcceptanceId).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('does not recover another account’s pending acceptance', async () => {
    localStorage.setItem(key, JSON.stringify({ jobId: '101' }));
    api.token = tokenFor(9);
    const { result } = show();
    expect(result.current.pendingAcceptanceId).toBeNull();
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('leaves an expired job available to dispatch without replaying the old acceptance', async () => {
    localStorage.setItem(key, JSON.stringify({ jobId: '101' }));
    api.fetch.mockResolvedValue(response({ state: 'expired' }));
    const { result } = show();
    await waitFor(() => expect(result.current.acceptanceMessage).toMatch(/expired/));
    expect(result.current.acceptedJobId).toBeNull();
    expect(result.current.pendingAcceptanceId).toBeNull();
    expect(api.fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('continues tracking an available snapshot because the delayed POST may still commit', async () => {
    localStorage.setItem(key, JSON.stringify({ jobId: '101' }));
    api.fetch.mockResolvedValue(response({ state: 'available' }));
    const { result } = show();
    await waitFor(() => expect(api.fetch).toHaveBeenCalled());
    expect(result.current.acceptedJobId).toBeNull();
    expect(result.current.pendingAcceptanceId).toBe('101');
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(api.fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    api.fetch.mockResolvedValue(response({ state: 'accepted', job: accepted }));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(result.current.acceptedJobId).toBe('101'));
    expect(result.current.path).toBe('/technician/active-job/101');
  });

  it('allows an explicit same-job retry while retaining uncertainty until confirmation', async () => {
    localStorage.setItem(key, JSON.stringify({ jobId: '101' }));
    api.fetch.mockResolvedValue(response({ state: 'available' }));
    const { result } = show();
    await waitFor(() => expect(result.current.canRetryAcceptance).toBe(true));
    api.fetch.mockResolvedValue(response({ success: true, job: accepted }));
    await act(async () => { await result.current.retryAcceptance(); });
    expect(result.current.acceptedJobId).toBe('101');
    expect(result.current.pendingAcceptanceId).toBeNull();
    expect(result.current.path).toBe('/technician/active-job/101');
    expect(api.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it('does not forget the original uncertain attempt when an explicit retry is rejected', async () => {
    localStorage.setItem(key, JSON.stringify({ jobId: '101' }));
    api.fetch.mockResolvedValue(response({ state: 'available' }));
    const { result } = show();
    await waitFor(() => expect(result.current.canRetryAcceptance).toBe(true));
    api.fetch.mockResolvedValue(response({ code: 'technician_busy', error: 'You already have another active job.' }, 409));
    await act(async () => { await result.current.retryAcceptance().catch(() => {}); });
    expect(result.current.pendingAcceptanceId).toBe('101');
    expect(localStorage.getItem(key)).not.toBeNull();
  });

  it('preserves frontend-only acceptance with its demo identity and request ID', async () => {
    api.demo = true;
    api.token = 'demo-tech-token';
    localStorage.setItem('resqnow_technician', JSON.stringify({ id: 'tech-101' }));
    api.fetch.mockResolvedValue(response({ success: true, job: { id: 'req-1001', status: 'accepted' } }));
    const { result } = show();
    await act(async () => { await result.current.acceptJob('req-1001'); });
    expect(result.current.acceptedJobId).toBe('req-1001');
  });

  it('restores frontend-only pending acceptance without sharing state with production accounts', async () => {
    api.demo = true;
    api.token = 'demo-tech-token';
    localStorage.setItem('resqnow_technician', JSON.stringify({ id: 'tech-101' }));
    localStorage.setItem('resqnow_pending_acceptance_demo:tech-101', JSON.stringify({ jobId: 'req-1001' }));
    api.fetch.mockResolvedValue(response({ state: 'accepted', job: { id: 'req-1001', status: 'accepted' } }));
    const { result } = show();
    await waitFor(() => expect(result.current.acceptedJobId).toBe('req-1001'));
    expect(api.fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('keeps checking when the recovery request itself fails', async () => {
    localStorage.setItem(key, JSON.stringify({ jobId: '101' }));
    api.fetch.mockRejectedValue(new TypeError('Still offline'));
    const { result } = show();
    await waitFor(() => expect(api.fetch).toHaveBeenCalled());
    expect(result.current.pendingAcceptanceId).toBe('101');
    expect(localStorage.getItem(key)).not.toBeNull();
  });

  it('does not announce an old account’s response after the technician session changes', async () => {
    let finish: (value: Response) => void;
    api.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result } = show();
    let acceptance: Promise<unknown>;
    act(() => { acceptance = result.current.acceptJob('101').catch(error => error); });
    api.token = tokenFor(9);
    await act(async () => { finish!(response({ success: true, job: accepted })); await acceptance!; });
    expect(await acceptance!).toMatchObject({ code: 'session_changed' });
    expect(result.current.acceptedJobId).toBeNull();
    expect(localStorage.getItem(key)).not.toBeNull();
  });

  it('bounds a hanging request and retains its unknown outcome', async () => {
    vi.useFakeTimers();
    api.fetch.mockImplementation((_path, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const { result } = show();
    let acceptance: Promise<unknown>;
    act(() => { acceptance = result.current.acceptJob('101').catch(error => error); });
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(await acceptance!).toMatchObject({ code: 'acceptance_unknown' });
    expect(result.current.pendingAcceptanceId).toBe('101');
    expect(result.current.acceptedJobId).toBeNull();
  });
});

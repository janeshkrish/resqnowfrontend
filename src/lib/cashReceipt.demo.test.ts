import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let previousFetch: typeof window.fetch;
const job = { id: 'cash-job', user_id: 'demo-user-1', technician_id: 'tech-101', service_type: 'battery', isTowing: false,
  status: 'awaiting_payment', payment_status: 'pending', amount: 100, technician_estimated_earning: 100 };
beforeEach(() => {
  previousFetch = window.fetch; localStorage.clear(); vi.resetModules();
  vi.stubEnv('VITE_FRONTEND_ONLY','true'); vi.stubEnv('VITE_API_URL','');
  localStorage.setItem('resqnow_technician_token','demo-tech-token');
  localStorage.setItem('resqnow_user_token','demo-user-token');
  localStorage.setItem('resqnow_technician',JSON.stringify({ id: 'tech-101' }));
  localStorage.setItem('resqnow_mock_requests',JSON.stringify([job]));
});
afterEach(() => { window.fetch = previousFetch; vi.unstubAllEnvs(); });
const stored = () => JSON.parse(localStorage.getItem('resqnow_mock_requests')!)[0];
it('demo cash choice waits unpaid for the assigned technician receipt', async () => {
  const { apiFetch } = await import('./api');
  const choice = await apiFetch('/api/payments/cash',{ method: 'POST', body: JSON.stringify({ requestId: job.id }) });
  const body = await choice.json(); expect(body.pendingReceipt).toBe(true); expect(stored().status).toBe('awaiting_payment'); expect(stored().payment_status).toBe('pending');
  const payload = { requestId: job.id, ...body.cash_intent, received: true };
  expect((await apiFetch('/api/payments/cash/confirm',{ method: 'POST', body: JSON.stringify(payload) })).status).toBe(403);
  const confirmed = await apiFetch('/api/payments/cash/confirm',{ method: 'POST', technician: true, body: JSON.stringify(payload) });
  expect(confirmed.ok).toBe(true); expect(stored().payment_status).toBe('paid');
  expect((await apiFetch('/api/payments/cash/confirm',{ method: 'POST', technician: true, body: JSON.stringify(payload) })).ok).toBe(true);
});
it('demo rejects early cash selection and keeps service progress intact', async () => {
  localStorage.setItem('resqnow_mock_requests',JSON.stringify([{ ...job, status: 'accepted' }]));
  const { apiFetch } = await import('./api');
  expect((await apiFetch('/api/payments/cash',{ method: 'POST', body: JSON.stringify({ requestId: job.id }) })).status).toBe(409);
  expect(stored().status).toBe('accepted'); expect(stored().payment_status).toBe('pending');
});
it('demo complete-work action leaves a cash-capable service awaiting payment', async () => {
  const { apiFetch } = await import('./api');
  await apiFetch(`/api/service-requests/${job.id}/technician-status`,{ method: 'PATCH', technician: true, body: JSON.stringify({ status: 'completed' }) });
  expect(stored().status).toBe('awaiting_payment'); expect(stored().payment_status).toBe('pending');
});

it.each(['awaiting_payment', 'payment_pending', 'paid'])('demo status change cannot mark unpaid %s job paid', async (status) => {
  const initial = { ...job, status };
  localStorage.setItem('resqnow_mock_requests', JSON.stringify([initial]));
  const { apiFetch } = await import('./api');
  const response = await apiFetch(`/api/service-requests/${job.id}/technician-status`, { method: 'PATCH', technician: true,
    body: JSON.stringify({ status: 'paid', payment_status: 'paid' }) });
  expect(response.status).toBe(409); expect(stored()).toEqual(initial);
});

it.each(['payment_pending', 'closed'])('demo refuses unpaid towing closure from %s', async (status) => {
  const initial = { ...job, service_type: 'towing', isTowing: true, status };
  localStorage.setItem('resqnow_mock_requests', JSON.stringify([initial]));
  const { apiFetch } = await import('./api');
  const response = await apiFetch(`/api/service-requests/${job.id}/technician-status`, { method: 'PATCH', technician: true, body: JSON.stringify({ status: 'closed' }) });
  expect(response.status).toBe(409); expect(stored()).toEqual(initial);
});

it('demo refuses a towing paid flag without confirmed payment evidence', async () => {
  const initial = { ...job, service_type: 'towing', isTowing: true, status: 'payment_pending', payment_status: 'paid' };
  localStorage.setItem('resqnow_mock_requests', JSON.stringify([initial]));
  const { apiFetch } = await import('./api');
  expect((await apiFetch(`/api/service-requests/${job.id}/technician-status`, { method: 'PATCH', technician: true, body: JSON.stringify({ status: 'paid' }) })).status).toBe(409);
  expect(stored()).toEqual(initial);
});

it('demo towing closure follows confirmed cash receipt without changing payment evidence', async () => {
  localStorage.setItem('resqnow_mock_requests', JSON.stringify([{ ...job, service_type: 'towing', isTowing: true, status: 'payment_pending' }]));
  const { apiFetch } = await import('./api');
  const choice = await apiFetch('/api/payments/cash', { method: 'POST', body: JSON.stringify({ requestId: job.id }) });
  const { cash_intent } = await choice.json();
  await apiFetch('/api/payments/cash/confirm', { method: 'POST', technician: true, body: JSON.stringify({ requestId: job.id, ...cash_intent, received: true }) });
  const receipt = stored().cash_payment_receipt;
  const response = await apiFetch(`/api/service-requests/${job.id}/technician-status`, { method: 'PATCH', technician: true, body: JSON.stringify({ status: 'closed' }) });
  expect(response.ok).toBe(true); expect(stored().status).toBe('closed'); expect(stored().payment_status).toBe('paid'); expect(stored().cash_payment_receipt).toEqual(receipt);
});

it('demo verified online payment permits towing closure', async () => {
  localStorage.setItem('resqnow_mock_requests', JSON.stringify([{ ...job, service_type: 'towing', isTowing: true, status: 'payment_pending' }]));
  const { apiFetch } = await import('./api');
  await apiFetch('/api/payments/confirm', { method: 'POST', body: JSON.stringify({ requestId: job.id }) });
  const response = await apiFetch(`/api/service-requests/${job.id}/technician-status`, { method: 'PATCH', technician: true, body: JSON.stringify({ status: 'closed' }) });
  expect(response.ok).toBe(true); expect(stored().status).toBe('closed'); expect(stored().payment_status).toBe('completed');
});

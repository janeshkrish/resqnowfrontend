import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CashReceiptConfirmation from './CashReceiptConfirmation';

vi.mock('@/lib/api',() => ({ apiUrl: (path: string) => path }));
const fixture = () => ({ id: 'job-1', isTowing: false, status: 'payment_pending', payment_status: 'pending', payment_method: 'cash',
  cash_payment_intent: { intentId: 'intent-1', technicianId: 'tech-1', amountPaise: 11000, currency: 'INR' } });
beforeEach(() => { vi.stubGlobal('fetch',vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });
it.each(['accepted','en-route','vehicle_loaded'])('does not offer receipt confirmation during %s', status => {
  render(<CashReceiptConfirmation job={{ ...fixture(), status }} token='tech-token' technicianId='tech-1' onConfirmed={vi.fn()} onStale={vi.fn()} />);
  expect(screen.queryByRole('button')).toBeNull();
});
it('does not show another technician the receipt action',() => {
  render(<CashReceiptConfirmation job={fixture()} token='tech-token' technicianId='other-tech' onConfirmed={vi.fn()} onStale={vi.fn()} />);
  expect(screen.queryByRole('button')).toBeNull();
});
it('keeps the job unpaid when the server rejects a stale receipt', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Cash details changed' }),{ status: 409 }));
  const confirmed = vi.fn(), refresh = vi.fn();
  render(<CashReceiptConfirmation job={fixture()} token='tech-token' technicianId='tech-1' onConfirmed={confirmed} onStale={refresh} />);
  fireEvent.click(screen.getByRole('button',{ name: 'I received INR 110.00 cash' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cash details changed');
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1)); expect(confirmed).not.toHaveBeenCalled();
});
it('does not claim receipt confirmed for a success response that still says unpaid', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: true, request: { payment_status: 'pending' } }),{ status: 200 }));
  const confirmed = vi.fn();
  render(<CashReceiptConfirmation job={fixture()} token='tech-token' technicianId='tech-1' onConfirmed={confirmed} onStale={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{ name: 'I received INR 110.00 cash' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cash receipt is still pending'); expect(confirmed).not.toHaveBeenCalled();
});
it('blocks repeated taps while the real receipt request is pending', async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const confirmed = vi.fn();
  render(<CashReceiptConfirmation job={fixture()} token='tech-token' technicianId='tech-1' onConfirmed={confirmed} onStale={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{ name: 'I received INR 110.00 cash' }));
  expect(screen.getByRole('button',{ name: 'Confirming receipt…' })).toBeDisabled(); expect(confirmed).not.toHaveBeenCalled();
  finish(new Response(JSON.stringify({ success: true, request: { payment_status: 'paid' } }),{ status: 200 }));
  await waitFor(() => expect(screen.getByRole('button',{ name: 'Cash receipt confirmed' })).toBeDisabled());
  expect(confirmed).toHaveBeenCalledTimes(1);
});

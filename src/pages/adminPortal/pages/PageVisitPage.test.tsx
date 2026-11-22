import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import PageVisitPage from './PageVisitPage';
import { getPageVisitSummary, listPageVisits } from '../api/pageVisitApi';

vi.mock('../api/pageVisitApi', () => ({
  getPageVisitSummary: vi.fn(async () => ({
    visitorsToday: 12,
    pageViewsToday: 48,
    avgTimeOnPageSeconds: 42,
    topPageToday: '/services',
    topPageViews: 20,
    topSourceToday: 'referral (chatgpt)',
    topSourceVisits: 14,
  })),
  listPageVisits: vi.fn(async () => ({
    rows: [
      {
        id: 'visit-1',
        ip_address: '103.21.244.2',
        page_visited: '/services',
        previous_page: 'referral (chatgpt)',
        time_spent_seconds: 45,
        device: 'Desktop (Windows)',
        browser: 'Chrome 122',
        location: 'Bengaluru, Karnataka, India',
        session_id: 's_abc123',
        user_name: 'Ramesh Kumar',
        user_email: 'ramesh@gmail.com',
        user_phone: '+91 9876543210',
        user_role: 'customer',
        created_at: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    limit: 25,
    totalPages: 1,
    sources: ['referral (chatgpt)', 'direct'],
    devices: ['Desktop (Windows)'],
    browsers: ['Chrome 122'],
  })),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PageVisitPage />
    </QueryClientProvider>
  );
}

describe('PageVisitPage', () => {
  it('renders KPI metrics and visitor log table with user identity and route journey', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('kpi-visitors')).toHaveTextContent('12'));
    expect(screen.getByTestId('kpi-pageviews')).toHaveTextContent('48');
    expect(screen.getByTestId('kpi-toppage')).toHaveTextContent('/services');
    expect(screen.getByTestId('kpi-topsource')).toHaveTextContent('referral (chatgpt)');

    // Table rows
    expect(await screen.findByText('103.21.244.2')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru, Karnataka, India')).toBeInTheDocument();
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.getByText('ramesh@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('+91 9876543210')).toBeInTheDocument();
    expect(screen.getAllByText('referral (chatgpt)').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('45s')).toBeInTheDocument();
  });

  it('updates query when changing date range filter', async () => {
    renderPage();
    await screen.findByText('Visitors today');

    const select = screen.getByLabelText('Date range');
    fireEvent.change(select, { target: { value: '7d' } });

    await waitFor(() => {
      expect(getPageVisitSummary).toHaveBeenCalledWith('7d');
      expect(listPageVisits).toHaveBeenCalledWith(
        expect.objectContaining({ range: '7d' })
      );
    });
  });
});

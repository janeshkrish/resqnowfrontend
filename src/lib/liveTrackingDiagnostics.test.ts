import { afterEach, describe, expect, it, vi } from 'vitest';

import { logLiveTrackingDiagnostic } from './liveTrackingDiagnostics';

describe('live tracking staging diagnostics', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not log while the staging diagnostic flag is disabled', () => {
    const logger = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubEnv('VITE_LIVE_TRACKING_DIAGNOSTICS', 'false');

    logLiveTrackingDiagnostic('[RT-CUSTOMER-RECEIVE]', 'location_received', { sequenceId: 42 });

    expect(logger).not.toHaveBeenCalled();
  });

  it('uses the required trace prefix when staging diagnostics are enabled', () => {
    const logger = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubEnv('VITE_LIVE_TRACKING_DIAGNOSTICS', 'true');

    logLiveTrackingDiagnostic('[RT-CUSTOMER-RECEIVE]', 'location_received', {
      requestId: 'request-1',
      sequenceId: 42,
      lat: 11.123,
      lng: 76.456,
    });

    expect(logger).toHaveBeenCalledWith('[RT-CUSTOMER-RECEIVE]', {
      event: 'location_received',
      requestId: 'request-1',
      sequenceId: 42,
      lat: 11.123,
      lng: 76.456,
    });
  });
});

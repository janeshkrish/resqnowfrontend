import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ platform: 'web', web: vi.fn(), native: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => state.platform } }));
vi.mock('./MapplsMapSurface', () => ({ MapplsMapSurface: (props: unknown) => { state.web(props); return <div>Web map</div>; } }));
vi.mock('./NativeMapSurface', () => ({ NativeMapSurface: (props: unknown) => { state.native(props); return <div>Native map</div>; } }));
import { PlatformMapSurface } from './PlatformMapSurface';

describe('map platform boundary', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => { vi.clearAllMocks(); state.platform = 'web'; });
  const props = { ariaLabel: 'Map', markers: [], circles: [], polylines: [] };
  it('disables only Android maps explicitly without loading either renderer', () => {
    vi.stubEnv('VITE_NATIVE_MAPPLS_ENABLED', 'false');
    state.platform = 'android'; render(<PlatformMapSurface {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent('Maps are temporarily disabled in this Android release');
    expect(state.native).not.toHaveBeenCalled(); expect(state.web).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'Retry map'})).not.toBeInTheDocument();
  });
  it('keeps website maps enabled when the Android-only setting is false', () => {
    vi.stubEnv('VITE_NATIVE_MAPPLS_ENABLED', 'false');
    render(<PlatformMapSurface {...props} />);
    expect(screen.getByText('Web map')).toBeInTheDocument();
  });
  it('notifies the existing parent fallback once when maps are deliberately disabled', () => {
    vi.stubEnv('VITE_NATIVE_MAPPLS_ENABLED', 'false'); state.platform = 'android';
    const unavailable=vi.fn();const view=render(<PlatformMapSurface {...props} onUnavailable={unavailable} />);
    expect(unavailable).toHaveBeenCalledTimes(1);
    view.rerender(<PlatformMapSurface {...props} onUnavailable={unavailable} />);
    expect(unavailable).toHaveBeenCalledTimes(1);
  });
  it('preserves the existing renderer on desktop and mobile browsers', () => {
    render(<PlatformMapSurface {...props} />);
    expect(screen.getByText('Web map')).toBeInTheDocument();
    expect(state.web).toHaveBeenCalledWith(props);
    expect(state.native).not.toHaveBeenCalled();
  });
  it('uses only the native renderer on Android', async () => {
    state.platform = 'android'; render(<PlatformMapSurface {...props} />);
    expect(await screen.findByText('Native map')).toBeInTheDocument();
    expect(state.web).not.toHaveBeenCalled();
  });
  it('retains the website implementation on other platforms', () => {
    state.platform = 'ios'; render(<PlatformMapSurface {...props} />);
    expect(screen.getByText('Web map')).toBeInTheDocument();
  });
});

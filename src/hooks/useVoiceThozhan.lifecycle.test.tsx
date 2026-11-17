import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useVoiceThozhan} from './useVoiceThozhan';
import {askVoiceAi} from '@/lib/voice/api';
import {speak} from '@/lib/voice/speech';

vi.mock('@/lib/voice/api', () => ({askVoiceAi: vi.fn()}));
vi.mock('@/lib/voice/speech', () => ({
  explainMicError: vi.fn(), listen: vi.fn(), prepareSpeech: vi.fn(),
  setNaturalVoice: vi.fn(), silence: vi.fn(), speak: vi.fn().mockResolvedValue(undefined),
  speechReady: vi.fn().mockResolvedValue(undefined), unlockAudio: vi.fn(),
}));
const visibility = (value: string) => {
  Object.defineProperty(document, 'visibilityState', {configurable:true, value});
  document.dispatchEvent(new Event('visibilitychange'));
};
beforeEach(() => {vi.useFakeTimers(); visibility('visible');});
afterEach(() => {vi.useRealTimers(); vi.clearAllMocks(); visibility('visible');});

it('does not start a queued prompt after the app is hidden and reopened', async () => {
  const hook = renderHook(() => useVoiceThozhan({garage:[], ai:false, onHandoff:vi.fn()}));
  let turn: Promise<void>;
  act(() => {turn = hook.result.current.handleInput('My car battery is dead', 'typed');});
  act(() => {visibility('hidden'); visibility('visible');});
  await act(async () => {await vi.advanceTimersByTimeAsync(10000); await turn;});
  expect(speak).not.toHaveBeenCalled();
  expect(hook.result.current.busy).toBe(false);
  hook.unmount();
});

it('cancels AI work on hide and ignores its late answer after a new turn starts', async () => {
  let resolve!: (value: {service:string; family:string}) => void;
  vi.mocked(askVoiceAi).mockReturnValueOnce(new Promise(r => {resolve=r;}));
  const hook = renderHook(() => useVoiceThozhan({garage:[], ai:true, onHandoff:vi.fn()}));
  let old: Promise<void>;
  act(() => {old = hook.result.current.handleInput('Vandi odala, help pannunga', 'typed');});
  const signal = vi.mocked(askVoiceAi).mock.calls[0][1];
  act(() => {visibility('hidden'); visibility('visible');});
  expect(signal?.aborted).toBe(true);
  let current: Promise<void>;
  act(() => {current = hook.result.current.handleInput('My bike has a puncture', 'typed');});
  await act(async () => {
    resolve({service:'towing',family:'car'});
    await vi.advanceTimersByTimeAsync(10000);
    await Promise.all([old,current]);
  });
  expect(hook.result.current.draft.service).toBe('flat-tire');
  expect(hook.result.current.draft.family).toBe('bike');
  hook.unmount();
});

it('asks for clarification when a later answer describes conflicting vehicle types', async () => {
  const hook = renderHook(() => useVoiceThozhan({garage:[], ai:false, onHandoff:vi.fn()}));
  let first: Promise<void>;
  act(() => {first = hook.result.current.handleInput('My car battery is dead', 'typed');});
  await act(async () => {await vi.advanceTimersByTimeAsync(10000); await first;});
  let correction: Promise<void>;
  act(() => {correction = hook.result.current.handleInput('car or bike', 'typed');});
  await act(async () => {await vi.advanceTimersByTimeAsync(10000); await correction;});
  expect(hook.result.current.draft.family).toBeNull();
  expect(hook.result.current.step?.kind).toBe('family');
  hook.unmount();
});

it('processes a resumed description after hiding before the first question', async () => {
  const hook = renderHook(() => useVoiceThozhan({garage:[], ai:false, onHandoff:vi.fn()}));
  let first: Promise<void>;
  act(() => {first = hook.result.current.handleInput('My car battery is dead', 'typed');});
  act(() => {visibility('hidden'); visibility('visible');});
  await act(async () => {await vi.advanceTimersByTimeAsync(10000); await first;});
  expect(hook.result.current.step).toBeNull();
  let resumed: Promise<void>;
  act(() => {resumed = hook.result.current.handleInput('Actually my bike has a puncture near the bus stop', 'typed');});
  await act(async () => {await vi.advanceTimersByTimeAsync(10000); await resumed;});
  expect(hook.result.current.draft.service).toBe('flat-tire');
  expect(hook.result.current.draft.family).toBe('bike');
  hook.unmount();
});

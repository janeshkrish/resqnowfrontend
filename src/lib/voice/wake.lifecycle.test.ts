import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ReadableStream} from 'node:stream/web';
import {listenForWakeWord, stopSpotter} from './wake';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: {data: {type: string}}) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  emit(type: string) { this.onmessage?.({data:{type}}); }
}
const microphone = () => {
  const track = {stop:vi.fn()};
  return {track, stream:{getAudioTracks:()=>[track],getTracks:()=>[track]} as unknown as MediaStream};
};

describe('wake listener ownership', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('MediaStreamTrackProcessor', class {readable = new ReadableStream();});
  });
  afterEach(() => {stopSpotter();vi.unstubAllGlobals();});

  it('an older listener stopping cannot clear or reset the newer active listener', async () => {
    const firstMic = microphone();const secondMic = microphone();
    vi.stubGlobal('navigator', {mediaDevices:{getUserMedia:vi.fn().mockResolvedValueOnce(firstMic.stream).mockResolvedValueOnce(secondMic.stream)}});
    const firstHeard=vi.fn();const secondHeard=vi.fn();
    const firstPending=listenForWakeWord(firstHeard);
    const worker=FakeWorker.instances[0];worker.emit('ready');
    const first=await firstPending;
    const second=await listenForWakeWord(secondHeard);
    first.stop();worker.emit('heard');
    expect(secondHeard).toHaveBeenCalledTimes(1);
    expect(firstHeard).not.toHaveBeenCalled();
    expect(worker.postMessage).not.toHaveBeenCalledWith({type:'reset'});
    expect(firstMic.track.stop).toHaveBeenCalledTimes(1);
    expect(secondMic.track.stop).not.toHaveBeenCalled();
    second.stop();worker.emit('heard');
    expect(secondHeard).toHaveBeenCalledTimes(1);
    expect(secondMic.track.stop).toHaveBeenCalledTimes(1);
  });

  it('a late microphone result from a superseded startup cannot replace the current callback', async () => {
    const oldMic=microphone();const currentMic=microphone();
    let releaseOld!: (stream:MediaStream)=>void;
    const oldPermission=new Promise<MediaStream>(resolve=>{releaseOld=resolve;});
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockReturnValueOnce(oldPermission).mockResolvedValueOnce(currentMic.stream)}});
    const oldHeard=vi.fn();const currentHeard=vi.fn();
    const old=listenForWakeWord(oldHeard);
    const rejected=expect(old).rejects.toMatchObject({name:'AbortError'});
    const current=listenForWakeWord(currentHeard);
    const worker=FakeWorker.instances[0];worker.emit('ready');
    const listening=await current;
    releaseOld(oldMic.stream);await rejected;
    worker.emit('heard');
    expect(currentHeard).toHaveBeenCalledTimes(1);
    expect(oldHeard).not.toHaveBeenCalled();
    expect(oldMic.track.stop).toHaveBeenCalledTimes(1);
    expect(currentMic.track.stop).not.toHaveBeenCalled();
    listening.stop();
  });

  it('turning off during model loading releases that microphone without terminating a later worker', async () => {
    const oldMic=microphone();const nextMic=microphone();
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockResolvedValueOnce(oldMic.stream).mockResolvedValueOnce(nextMic.stream)}});
    const old=listenForWakeWord(vi.fn());
    const rejected=expect(old).rejects.toMatchObject({name:'AbortError'});
    await Promise.resolve();
    const oldWorker=FakeWorker.instances[0];stopSpotter();
    const nextHeard=vi.fn();const next=listenForWakeWord(nextHeard);
    const nextWorker=FakeWorker.instances[1];nextWorker.emit('ready');
    const listening=await next;await rejected;
    expect(oldMic.track.stop).toHaveBeenCalledTimes(1);
    expect(oldWorker.terminate).toHaveBeenCalledTimes(1);
    expect(nextWorker.terminate).not.toHaveBeenCalled();
    nextWorker.emit('heard');expect(nextHeard).toHaveBeenCalledTimes(1);
    listening.stop();
  });

  it('releases the microphone and callback if audio capture setup fails', async () => {
    const mic=microphone();const heard=vi.fn();
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockResolvedValue(mic.stream)}});
    vi.stubGlobal('MediaStreamTrackProcessor', undefined);
    vi.stubGlobal('AudioContext', class {constructor(){throw Error('capture setup failed');}});
    const pending=listenForWakeWord(heard);
    const worker=FakeWorker.instances[0];worker.emit('ready');
    await expect(pending).rejects.toThrow('capture setup failed');
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
    worker.emit('heard');expect(heard).not.toHaveBeenCalled();
  });
});

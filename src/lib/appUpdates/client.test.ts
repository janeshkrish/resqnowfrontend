import { expect, it, vi } from 'vitest';
import fixture from '@/test/fixtures/android-release.json';
import { fetchUpdateOffer, parseRelease } from './client';

it('accepts the cross-platform release contract and rejects unsafe metadata',()=>{
  expect(parseRelease(fixture).versionCode).toBe(12);
  expect(parseRelease({...fixture,publishedAt:'2026-10-30T12:00:00.125Z'}).versionCode).toBe(12);
  for(const patch of [{apkUrl:'https://evil.test/app.apk'},{versionCode:4.5},{sha256:'A'.repeat(64)},{extra:true},{publishedAt:'2026-02-30T12:00:00Z'},{versionName:'1\n2'},{versionName:' '},{versionName:'a'.repeat(61)}]) expect(()=>parseRelease({...fixture,...patch})).toThrow();
});
it('fetches public metadata without identity or caching and distinguishes disabled',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({state:'ready',release:fixture})));
  expect((await fetchUpdateOffer('https://api.example',fetcher)).state).toBe('ready');
  expect(fetcher).toHaveBeenCalledWith('https://api.example/api/public/android-app/update',expect.objectContaining({credentials:'omit',cache:'no-store',redirect:'error'}));
  expect(await fetchUpdateOffer('https://api.example',async()=>new Response('{"state":"disabled"}'))).toEqual({state:'disabled'});
});
it('rejects unavailable, oversized and malformed replies',async()=>{
  for(const response of [new Response('{"state":"unavailable"}',{status:503}),new Response('x'.repeat(17000)),new Response('{"state":"ready"}')]) await expect(fetchUpdateOffer('https://api.example',async()=>response)).rejects.toThrow();
});

import {it,expect} from 'vitest';import {buildTrackedApkDownloadUrl} from './download';
it('adds a per-action ID without losing existing query parameters',()=>{const url=new URL(buildTrackedApkDownloadUrl('https://example.test/api/public/android-app/download?source=home','abc'));expect(url.searchParams.get('download_id')).toBe('abc');expect(url.searchParams.get('source')).toBe('home');});

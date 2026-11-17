import assert from 'node:assert/strict';
import test from 'node:test';
const api=await import('./android-web-assets.mjs').catch(()=>({}));
test('native web settings reuse production public configuration without enabling publication or updates',()=>{
  assert.equal(typeof api.nativePublicSettings,'function');
  let input;
  const actual=api.nativePublicSettings({root:'controlled-root',load:(...args)=>{input=args;return {VITE_MAPPLS_MAP_SDK_KEY:'controlled-sdk-key',VITE_API_URL:'https://resqnowbackend-production-c392.up.railway.app',VITE_NATIVE_BUILD:'false',VITE_APP_UPDATES_ENABLED:'false',PRIVATE_CREDENTIAL:'must-not-forward'};}});
  assert.deepEqual(input,['production','controlled-root','VITE_']);
  assert.equal(actual.VITE_NATIVE_BUILD,'true');assert.equal(actual.VITE_APP_UPDATES_ENABLED,'false');
  assert.equal(actual.VITE_MAPPLS_MAP_SDK_KEY,'controlled-sdk-key');assert.equal(actual.PRIVATE_CREDENTIAL,undefined);
  assert.equal(actual.ANDROID_AUTO_RELEASE_ENABLED,undefined);
});

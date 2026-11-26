import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {checkAndroidNetworkPolicy} from './android-network-policy.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

const STRICT_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors><certificates src="system" /></trust-anchors>
  </base-config>
</network-security-config>`;
const GOOD_MANIFEST = '<manifest><application android:networkSecurityConfig="@xml/network_security_config"></application></manifest>';
const GOOD_CAPACITOR = "const config = { server: { androidScheme: 'https' } };";

async function fixture(files, body) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'resqnow-netpolicy-'));
  try {
    const all = {
      'android/app/src/main/res/xml/network_security_config.xml': STRICT_XML,
      'android/app/src/main/AndroidManifest.xml': GOOD_MANIFEST,
      'capacitor.config.ts': GOOD_CAPACITOR,
      ...files,
    };
    for (const [relative, content] of Object.entries(all)) {
      if (content === null) continue;
      const file = path.join(root, relative);
      await fs.mkdir(path.dirname(file), {recursive: true});
      await fs.writeFile(file, content);
    }
    await body(root);
  } finally {
    await fs.rm(root, {recursive: true, force: true});
  }
}

test('the repository release configuration is HTTPS-only with system CAs', async () => {
  assert.deepEqual(await checkAndroidNetworkPolicy({root: repoRoot}), []);
});

test('a strict configuration passes', () => fixture({}, async (root) => {
  assert.deepEqual(await checkAndroidNetworkPolicy({root}), []);
}));

test('global cleartext in base-config is rejected', () => fixture({
  'android/app/src/main/res/xml/network_security_config.xml': STRICT_XML.replace('"false"', '"true"'),
}, async (root) => {
  assert.match((await checkAndroidNetworkPolicy({root})).join('\n'), /must not permit cleartext/);
}));

test('cleartext for a single domain is also rejected in release resources', () => fixture({
  'android/app/src/main/res/xml/network_security_config.xml': STRICT_XML.replace('</network-security-config>',
    '<domain-config cleartextTrafficPermitted="true"><domain>10.0.2.2</domain></domain-config></network-security-config>'),
}, async (root) => {
  assert.match((await checkAndroidNetworkPolicy({root})).join('\n'), /must not permit cleartext/);
}));

test('user-installed CAs are rejected outside debug-overrides', () => fixture({
  'android/app/src/main/res/xml/network_security_config.xml': STRICT_XML.replace('<certificates src="system" />',
    '<certificates src="system" /><certificates src="user" />'),
}, async (root) => {
  assert.match((await checkAndroidNetworkPolicy({root})).join('\n'), /user-installed CAs/);
}));

test('user CAs inside debug-overrides are allowed (debuggable builds only)', () => fixture({
  'android/app/src/main/res/xml/network_security_config.xml': STRICT_XML.replace('</network-security-config>',
    '<debug-overrides><trust-anchors><certificates src="user" /></trust-anchors></debug-overrides></network-security-config>'),
}, async (root) => {
  assert.deepEqual(await checkAndroidNetworkPolicy({root}), []);
}));

test('a release source-set override is checked too', () => fixture({
  'android/app/src/release/res/xml/network_security_config.xml': STRICT_XML.replace('"false"', '"true"'),
}, async (root) => {
  assert.match((await checkAndroidNetworkPolicy({root})).join('\n'), /src\/release\/.*cleartext/);
}));

test('usesCleartextTraffic="true" in the main manifest is rejected', () => fixture({
  'android/app/src/main/AndroidManifest.xml': GOOD_MANIFEST.replace('<application', '<application android:usesCleartextTraffic="true"'),
}, async (root) => {
  assert.match((await checkAndroidNetworkPolicy({root})).join('\n'), /usesCleartextTraffic/);
}));

test('a manifest that drops the network security config is rejected', () => fixture({
  'android/app/src/main/AndroidManifest.xml': '<manifest><application></application></manifest>',
}, async (root) => {
  assert.match((await checkAndroidNetworkPolicy({root})).join('\n'), /must reference/);
}));

test('a missing main network security config is rejected', () => fixture({
  'android/app/src/main/res/xml/network_security_config.xml': null,
}, async (root) => {
  assert.match((await checkAndroidNetworkPolicy({root})).join('\n'), /missing/);
}));

test('Capacitor server.cleartext: true is rejected, but a commented example is not', async () => {
  await fixture({'capacitor.config.ts': "const c = { server: { cleartext: true } };"}, async (root) => {
    assert.match((await checkAndroidNetworkPolicy({root})).join('\n'), /server\.cleartext/);
  });
  await fixture({'capacitor.config.ts': "const c = { server: {} }; // cleartext: true for live reload"}, async (root) => {
    assert.deepEqual(await checkAndroidNetworkPolicy({root}), []);
  });
});

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Files that end up in a release APK/AAB. Debug and acceptance source sets may
// relax these rules; anything here ships to customers.
const RELEASE_NETWORK_CONFIGS = [
  'android/app/src/main/res/xml/network_security_config.xml',
  'android/app/src/release/res/xml/network_security_config.xml',
];
const MAIN_MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const CAPACITOR_CONFIG = 'capacitor.config.ts';

async function readIfPresent(file) {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// <debug-overrides> only applies to debuggable builds, so user CAs are allowed there.
function releaseVisibleXml(xml) {
  return xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<debug-overrides\b[\s\S]*?<\/debug-overrides>/g, '');
}

/** Returns a list of problems; empty means release builds are HTTPS-only with system CAs. */
export async function checkAndroidNetworkPolicy({root}) {
  const problems = [];
  let foundMainConfig = false;

  for (const relative of RELEASE_NETWORK_CONFIGS) {
    const xml = await readIfPresent(path.join(root, relative));
    if (xml === null) continue;
    if (relative.includes('/main/')) foundMainConfig = true;
    const visible = releaseVisibleXml(xml);
    if (/cleartextTrafficPermitted\s*=\s*"true"/.test(visible)) {
      problems.push(`${relative}: release builds must not permit cleartext HTTP`);
    }
    if (/<certificates\b[^>]*\bsrc\s*=\s*"user"/.test(visible)) {
      problems.push(`${relative}: release builds must not trust user-installed CAs`);
    }
  }
  if (!foundMainConfig) problems.push(`${RELEASE_NETWORK_CONFIGS[0]}: missing`);

  const manifest = await readIfPresent(path.join(root, MAIN_MANIFEST));
  if (manifest === null) {
    problems.push(`${MAIN_MANIFEST}: missing`);
  } else {
    if (/android:usesCleartextTraffic\s*=\s*"true"/.test(manifest)) {
      problems.push(`${MAIN_MANIFEST}: must not set usesCleartextTraffic="true"`);
    }
    if (!/android:networkSecurityConfig\s*=\s*"@xml\/network_security_config"/.test(manifest)) {
      problems.push(`${MAIN_MANIFEST}: must reference @xml/network_security_config`);
    }
  }

  const capacitor = await readIfPresent(path.join(root, CAPACITOR_CONFIG));
  if (capacitor !== null && /\bcleartext\s*:\s*true\b/.test(capacitor.replace(/\/\/.*$/gm, ''))) {
    problems.push(`${CAPACITOR_CONFIG}: server.cleartext must not be enabled for shipped builds`);
  }

  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  checkAndroidNetworkPolicy({root}).then((problems) => {
    if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
    else console.log('Android network policy: OK (HTTPS-only, system CAs).');
  });
}

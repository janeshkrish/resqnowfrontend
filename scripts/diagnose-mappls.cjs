const fs = require('node:fs');
const { mappls } = require('mappls-web-maps');
const env = require('dotenv').parse(fs.readFileSync('.env'));
const sdk = new mappls();
console.log({ initialize: typeof sdk.initialize, Map: typeof sdk.Map, map: typeof sdk.map });
console.log(Object.fromEntries(Object.entries(env).filter(([key]) => /MAPPLS/.test(key)).map(([key, value]) => [key, { present: !!value.trim(), length: value.trim().length, jwt: value.split('.').length === 3 }])));
async function diagnose() {
  const key = env.VITE_MAPPLS_MAP_SDK_KEY.trim();
  for (const origin of ['https://resqnow.org', 'https://www.resqnow.org', 'http://localhost:8080']) {
    for (const auth of ['auth2', 'legacy']) {
      const url = auth === 'legacy'
        ? `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(key)}/map_sdk?v=3.0`
        : `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(key)}`;
      try {
        const response = await fetch(url, { headers: { Referer: origin + '/', Origin: origin }, signal: AbortSignal.timeout(20000) });
        const body = await response.text();
        console.log({ origin, auth, status: response.status, contentType: response.headers.get('content-type'), bytes: body.length,
          error: response.status !== 200 ? body.replaceAll(key, '[REDACTED]').slice(0, 350) : undefined });
      } catch (error) { console.log({origin, auth, error: error.name}); }
    }
  }
  try {
    const origin = 'https://www.resqnow.org';
    const page = await (await fetch(origin + '/map')).text();
    const entry = page.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1];
    if (!entry) throw new Error('entry_not_found');
    const main = await (await fetch(new URL(entry, origin))).text();
    const mapAsset = main.match(/(?:\.\/|assets\/)?MapplsMapSurface-[A-Za-z0-9_-]+\.js/)?.[0];
    if (!mapAsset) throw new Error('map_asset_not_found');
    const mapUrl = new URL(mapAsset.split('/').pop(), origin + '/assets/');
    const assetResponse = await fetch(mapUrl);
    if (!assetResponse.ok || !/javascript/.test(assetResponse.headers.get('content-type') || '')) {
      throw new Error('map_asset_unavailable');
    }
    const mapBundle = await assetResponse.text();
    console.log({ productionEntry: entry, mapBundle: mapUrl.pathname,
      deployedKeyMatchesLocal: mapBundle.includes(key),
      deployedUsesObsoleteMapCall: /\.map\(\{id:[^}]*key:/.test(mapBundle),
      deployedHasInitialization: /\.initialize\(/.test(mapBundle) });
  } catch (error) {
    console.log({ productionInspection: 'unavailable', reason: error.name });
  }
}
diagnose();

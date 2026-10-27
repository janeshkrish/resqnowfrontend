import {existsSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
process.env.NODE_ENV='test';process.env.DB_MIGRATION_MODE='off';process.env.APP_ANALYTICS_TEST_DB='1';
const backend=process.env.APP_ANALYTICS_BACKEND_DIR||[resolve('../backend'),resolve('../resqnowbackend')].find(p=>existsSync(resolve(p,'tests/helpers/appAnalyticsServer.mjs')));
if(!backend)throw Error('Set APP_ANALYTICS_BACKEND_DIR to the analytics backend checkout');
const {startAppAnalyticsTestServer}=await import(pathToFileURL(resolve(backend,'tests/helpers/appAnalyticsServer.mjs')));
const service=await startAppAnalyticsTestServer({exitOnShutdown:true});process.on('SIGINT',()=>void service.close().then(()=>process.exit(0)));process.on('SIGTERM',()=>void service.close().then(()=>process.exit(0)));

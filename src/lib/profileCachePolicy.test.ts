// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
const pwa = vi.hoisted(() => ({options:null as any}));
vi.mock('vite-plugin-pwa',()=>({VitePWA:(options:any)=>{pwa.options=options;return[];}}));
vi.mock('@vitejs/plugin-react-swc',()=>({default:()=>({name:'react-test'})}));
vi.mock('lovable-tagger',()=>({componentTagger:()=>({name:'tagger-test'})}));
import configure from '../../vite.config';
afterEach(()=>vi.unstubAllEnvs());
it.each(['/api/auth/me','/api/auth/me?refresh=1','/api/payments/verify-subscription-payment','/api/password-recovery/user/status','/api/password-recovery/technician/status'])(
  'profile/payment response %s uses the network before any generic API cache', (path) => {
    vi.stubEnv('VITE_API_URL','https://api.example.test'); vi.stubEnv('VITE_FRONTEND_ONLY','false');
    (configure as any)({mode:'development',command:'serve'});
    const rules=pwa.options.workbox.runtimeCaching;
    const rule=rules.find((candidate:any)=>(candidate.method || 'GET')==='GET' && candidate.urlPattern instanceof RegExp &&
      candidate.urlPattern.test(`https://api.example.test${path}`));
    expect(rule?.handler).toBe('NetworkOnly');
  });

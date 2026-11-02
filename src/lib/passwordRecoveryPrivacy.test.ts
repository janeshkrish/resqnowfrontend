// @vitest-environment node
import { expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

it('initial recovery documents skip marketing and checkout scripts and suppress referrers',()=>{
  const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  expect(html).toContain('<meta name="referrer" content="no-referrer"');
  expect(html).not.toContain('checkout.razorpay.com');
  const tracker=html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)![1];
  for(const path of ['/forgot-password','/reset-password','/verify-recovery-email','/technician/forgot-password','/technician/reset-password','/technician/verify-recovery-email']) {
    let loaded=false;
    vm.runInNewContext(tracker,{window:{location:{pathname:path}},document:{createElement:()=>{loaded=true;throw Error('must not load tracker');}}});
    expect(loaded).toBe(false);
  }
});

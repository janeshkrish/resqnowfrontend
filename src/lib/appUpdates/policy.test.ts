import { describe, expect, it } from 'vitest';
import { canInstallHere, hasUnfinishedWork } from './policy';

describe('safe installation policy', () => {
  it.each(['/request-service/puncture/bike','/request-service-tracking/1','/payment/1','/auth/success','/thozhan','/technician/active-job/1','/map','/admin'])('defers on %s', path => {
    expect(canInstallHere({path, authenticated:true, visible:true, dialog:false, technicianBusy:false})).toBe(false);
  });
  it.each(['/settings','/profile','/technician/profile','/technician/settings','/','/technician/dashboard'])('permits idle safe screen %s', path => {
    expect(canInstallHere({path, authenticated:true, visible:true, dialog:false, technicianBusy:false})).toBe(true);
  });
  it.each(['authenticated','visible','dialog','technicianBusy'] as const)('fails closed for %s', field => {
    const input={path:'/settings',authenticated:true,visible:true,dialog:false,technicianBusy:false};
    input[field]=!input[field]; expect(canInstallHere(input)).toBe(false);
  });
  it('does not interrupt completed-but-unpaid or unrecognized work',()=>{
    expect(hasUnfinishedWork([{status:'completed',payment_status:'pending'}])).toBe(true);
    expect(hasUnfinishedWork([{status:'mystery'}])).toBe(true);
    expect(hasUnfinishedWork([{status:'completed',payment_status:'paid'},{status:'cancelled'}])).toBe(false);
    expect(hasUnfinishedWork({})).toBe(true);
  });
});

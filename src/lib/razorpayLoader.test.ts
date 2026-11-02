import { afterEach, expect, it, vi } from 'vitest';
import { loadRazorpay } from './razorpayLoader';
afterEach(()=>{delete (window as any).Razorpay;document.getElementById('resqnow-razorpay')?.remove();vi.useRealTimers();});
it('loads checkout only on demand and shares concurrent requests',async()=>{
  expect(document.getElementById('resqnow-razorpay')).toBeNull();
  const first=loadRazorpay(),second=loadRazorpay();expect(first).toBe(second);
  const script=document.getElementById('resqnow-razorpay') as HTMLScriptElement;
  expect(script.src).toBe('https://checkout.razorpay.com/v1/checkout.js');
  (window as any).Razorpay=function(){};script.dispatchEvent(new Event('load'));await first;await second;
});
it('handles failed loading and permits retry',async()=>{
  const failure=loadRazorpay();const assertion=expect(failure).rejects.toThrow('payment gateway');
  document.getElementById('resqnow-razorpay')!.dispatchEvent(new Event('error'));await assertion;
  expect(document.getElementById('resqnow-razorpay')).toBeNull();
  const retry=loadRazorpay();(window as any).Razorpay=function(){};document.getElementById('resqnow-razorpay')!.dispatchEvent(new Event('load'));await retry;
});

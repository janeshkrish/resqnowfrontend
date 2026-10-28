import {afterEach,describe,it,expect,vi} from 'vitest';
import {createAppAnalyticsClient} from './client';
import type {AnalyticsTransport} from './types';
const identity={installationId:'d9695b75-b6cc-432a-944e-5ca18fb26121',installationSecret:'a'.repeat(64),appId:'com.resqnow1.app',versionName:'1.3',versionCode:4,consentRevision:1,consentPolicyVersion:'2026-10-27',consentGranted:true,consentDecided:true,everConsented:true,acknowledgedRevision:0,pendingWithdrawalRevision:0};
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
afterEach(()=>vi.useRealTimers());
describe('non-blocking native analytics collector',()=>{
 it('persists offline withdrawal across re-consent and restart, then clears old links before registration',async()=>{
  vi.useFakeTimers();let online=false;
  const state={...identity,consentRevision:3,acknowledgedRevision:1,pendingWithdrawalRevision:2};
  const native={getIdentity:async()=>({...state}),acknowledge:vi.fn(async({revision,withdrawal}:{revision:number;withdrawal?:boolean})=>{state.acknowledgedRevision=Math.max(state.acknowledgedRevision,revision);if(withdrawal&&state.pendingWithdrawalRevision===revision)state.pendingWithdrawalRevision=0;})};
  const transport=vi.fn<AnalyticsTransport>(async()=>({status:200}));
  let c=createAppAnalyticsClient({native,transport,enabled:true,isOnline:()=>online});c.start();await flush();c.stop();expect(transport).not.toHaveBeenCalled();
  online=true;c=createAppAnalyticsClient({native,transport,enabled:true,isOnline:()=>online});c.start();await flush();
  expect(transport.mock.calls.map(([path,body])=>[path,body.consentRevision])).toEqual([['/installations/withdraw',2],['/installations/register',3]]);
  expect(native.acknowledge).toHaveBeenNthCalledWith(1,{revision:2,withdrawal:true});expect(state.pendingWithdrawalRevision).toBe(0);c.stop();
 });
 it('does not register renewed consent while an earlier withdrawal has not succeeded',async()=>{
  vi.useFakeTimers();const transport=vi.fn<AnalyticsTransport>(async()=>({status:503}));
  const c=createAppAnalyticsClient({native:{getIdentity:async()=>({...identity,consentRevision:3,pendingWithdrawalRevision:2}),acknowledge:vi.fn()},transport,enabled:true});c.start();await flush();
  expect(transport.mock.calls.map(([path])=>path)).toEqual(['/installations/withdraw']);c.stop();
 });
 it('delivers a pending withdrawal even after offline re-consent with collection disabled',async()=>{
  const transport=vi.fn<AnalyticsTransport>(async()=>({status:200}));const c=createAppAnalyticsClient({native:{getIdentity:async()=>({...identity,consentRevision:3,pendingWithdrawalRevision:2}),acknowledge:vi.fn()},transport,enabled:false});c.start();await flush();expect(transport.mock.calls.map(([path])=>path)).toEqual(['/installations/withdraw']);c.stop();
 });
 it('does not send extra heartbeats on repeated foreground events within five minutes',async()=>{
  vi.useFakeTimers();const transport=vi.fn<AnalyticsTransport>(async()=>({status:200}));const c=createAppAnalyticsClient({native:{getIdentity:async()=>({...identity,acknowledgedRevision:1}),acknowledge:vi.fn()},transport,enabled:true});c.start();await flush();c.resume();await flush();c.resume();await flush();expect(transport).toHaveBeenCalledTimes(1);expect(transport.mock.calls[0][0]).toBe('/installations/heartbeat');c.stop();
 });
 it('does nothing on web or before consent',async()=>{
  const transport=vi.fn();let c=createAppAnalyticsClient({native:null,transport,enabled:true});c.start();await flush();expect(transport).not.toHaveBeenCalled();c.stop();
  c=createAppAnalyticsClient({native:{getIdentity:async()=>({...identity,consentGranted:false,everConsented:false}),acknowledge:vi.fn()},transport,enabled:true});c.start();await flush();expect(transport).not.toHaveBeenCalled();c.stop();
 });
 it('registers once on duplicate start; links only the current role token; heartbeat is bounded',async()=>{
  vi.useFakeTimers();const transport=vi.fn<AnalyticsTransport>(async()=>({status:200})),ack=vi.fn();
  const c=createAppAnalyticsClient({native:{getIdentity:async()=>identity,acknowledge:ack},transport,enabled:true});
  c.setAccounts({customer:{id:'customer',getToken:()=> 'current-user'},technician:null});c.start();c.start();await flush();
  expect(transport.mock.calls.map(c=>c[0])).toEqual(['/installations/register','/accounts/customer/link']);expect(transport.mock.calls[1][2]).toBe('current-user');
  await vi.advanceTimersByTimeAsync(299999);expect(transport).toHaveBeenCalledTimes(2);c.stop();
 });
 it('withdraws before other operations even with collection disabled',async()=>{
  const transport=vi.fn<AnalyticsTransport>(async()=>({status:200}));const c=createAppAnalyticsClient({native:{getIdentity:async()=>({...identity,consentGranted:false,consentRevision:2,pendingWithdrawalRevision:2}),acknowledge:vi.fn()},transport,enabled:false});c.start();await flush();
  expect(transport.mock.calls.map(c=>c[0])).toEqual(['/installations/withdraw']);c.stop();
 });
 it('retries offline registration at 5 seconds without persisting authentication',async()=>{
  vi.useFakeTimers();let online=false;const transport=vi.fn<AnalyticsTransport>(async()=>({status:200}));const c=createAppAnalyticsClient({native:{getIdentity:async()=>identity,acknowledge:vi.fn()},transport,enabled:true,isOnline:()=>online});c.start();await flush();expect(transport).not.toHaveBeenCalled();online=true;await vi.advanceTimersByTimeAsync(5000);expect(transport.mock.calls[0][0]).toBe('/installations/register');c.stop();
 });
});

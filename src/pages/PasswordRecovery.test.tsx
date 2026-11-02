import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PasswordRecovery from './PasswordRecovery';
import RecoveryEmailSettings from '@/components/RecoveryEmailSettings';
import { clearRecoveryToken } from '@/lib/passwordRecoveryLink';
vi.mock('@/lib/api',()=>({apiUrl:(p:string)=>`https://api.example.test${p}`,FRONTEND_ONLY_MODE:false,getUserToken:()=> 'customer-session',getTechnicianToken:()=> 'technician-session'}));
const fetchMock=vi.fn();
const token='a'.repeat(64);
beforeEach(()=>{vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();localStorage.clear();clearRecoveryToken();window.history.replaceState({},'', '/');});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const mount=(role:'user'|'technician',mode:'request'|'reset'|'verify')=>render(<MemoryRouter><PasswordRecovery role={role} mode={mode}/></MemoryRouter>);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});

it.each(['user','technician'] as const)('%s forgot-password sends a role-specific public request and shows neutral confirmation',async role=>{
  fetchMock.mockResolvedValue(json({message:'If eligible, check your email.'},202));mount(role,'request');
  fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'a@example.test'}});fireEvent.click(screen.getByRole('button',{name:'Send reset link'}));
  await screen.findByRole('status');const [url,options]=fetchMock.mock.calls[0];
  expect(url).toBe(`https://api.example.test/api/password-recovery/${role}/request`);
  expect(options.headers.Authorization).toBeUndefined();expect(options.cache).toBe('no-store');expect(options.credentials).toBe('omit');
  expect(screen.getByRole('link',{name:'Back to sign in'})).toHaveAttribute('href',role==='user'?'/login':'/technician/login');
});

it.each(['user','technician'] as const)('%s reset scrubs the fragment, checks matching passwords and never auto-logs in',async role=>{
  const prefix=role==='technician'?'/technician':'';window.history.replaceState({},'',`${prefix}/reset-password#token=${token}`);
  fetchMock.mockResolvedValue(json({message:'Password updated.'}));mount(role,'reset');expect(window.location.hash).toBe('');
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'new-safe-password!'}});
  fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'does-not-match!'}});
  fireEvent.click(screen.getByRole('button',{name:'Reset password'}));expect(fetchMock).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('match');
  fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'new-safe-password!'}});fireEvent.click(screen.getByRole('button',{name:'Reset password'}));
  await screen.findByRole('status');expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({token,password:'new-safe-password!'});
  expect(localStorage.length).toBe(0);expect(screen.queryByLabelText('New password')).toBeNull();
});

it('missing links and failed/expired confirmation do not claim success',async()=>{
  mount('user','reset');expect(screen.getByRole('alert')).toHaveTextContent('invalid');expect(fetchMock).not.toHaveBeenCalled();cleanup();
  window.history.replaceState({},'',`/reset-password#token=${token}`);fetchMock.mockResolvedValue(json({error:'This link is invalid or expired.'},400));mount('user','reset');
  for(const label of ['New password','Confirm new password'])fireEvent.change(screen.getByLabelText(label),{target:{value:'new-safe-password!'}});
  fireEvent.click(screen.getByRole('button',{name:'Reset password'}));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('expired'));expect(screen.queryByRole('status')).toBeNull();
});

it('verification requires an explicit action, preventing link preview/scanner consumption',async()=>{
  window.history.replaceState({},'',`/technician/verify-recovery-email#token=${token}`);fetchMock.mockResolvedValue(json({message:'Recovery email verified.'}));mount('technician','verify');
  expect(fetchMock).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Verify recovery email'}));
  await screen.findByRole('status');expect(fetchMock.mock.calls[0][0]).toContain('/technician/verification/confirm');
});

it('request failures are visible and can be retried',async()=>{
  fetchMock.mockRejectedValueOnce(Error('Offline')).mockResolvedValueOnce(json({message:'Check your email.'},202));mount('user','request');
  fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'a@example.test'}});fireEvent.click(screen.getByRole('button',{name:'Send reset link'}));
  await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Send reset link'}));await screen.findByRole('status');expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each(['user','technician'] as const)('%s recovery setup requires current password and uses that role session',async role=>{
  fetchMock.mockResolvedValueOnce(json({email:'a@example.test',hasPassword:true,verified:false})).mockResolvedValueOnce(json({message:'Check your email to verify.'},202));
  render(<MemoryRouter><RecoveryEmailSettings role={role}/></MemoryRouter>);await screen.findByLabelText('Current password');
  fireEvent.change(screen.getByLabelText('Current password'),{target:{value:'current-password!'}});fireEvent.click(screen.getByRole('button',{name:'Verify recovery email'}));await screen.findByRole('status');
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${role==='user'?'customer':'technician'}-session`);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({currentPassword:'current-password!'});expect(screen.queryByText('Recovery email verified')).toBeNull();
});

it('passwordless accounts keep their existing sign-in method',async()=>{
  fetchMock.mockResolvedValue(json({email:null,hasPassword:false,verified:false}));render(<MemoryRouter><RecoveryEmailSettings role='user'/></MemoryRouter>);
  await screen.findByText(/Google or mobile/);expect(screen.queryByLabelText('Current password')).toBeNull();
});

it('following a completed verification to forgot-password opens a fresh request form',async()=>{
  window.history.replaceState({},'',`/verify-recovery-email#token=${token}`);
  fetchMock.mockResolvedValue(json({message:'Verified successfully.'}));
  render(<MemoryRouter initialEntries={['/verify-recovery-email']}><Routes>
    <Route path='/verify-recovery-email' element={<PasswordRecovery role='user' mode='verify'/>}/>
    <Route path='/forgot-password' element={<PasswordRecovery role='user' mode='request'/>}/>
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Verify recovery email'}));await screen.findByRole('status');
  fireEvent.click(screen.getByRole('link',{name:'Request a new reset link'}));
  expect(await screen.findByLabelText('Email address')).toBeInTheDocument();expect(screen.queryByRole('status')).toBeNull();
});

it('changing accounts clears the previous recovery email and form state',async()=>{
  fetchMock.mockResolvedValueOnce(json({email:'old@example.test',hasPassword:true,verified:true}));
  const view=render(<MemoryRouter><RecoveryEmailSettings role='user' accountId='old'/></MemoryRouter>);
  await screen.findByText('Recovery email verified: old@example.test');
  fetchMock.mockResolvedValueOnce(json({email:'new@example.test',hasPassword:true,verified:false}));
  view.rerender(<MemoryRouter><RecoveryEmailSettings role='user' accountId='new'/></MemoryRouter>);
  await screen.findByLabelText('Current password');expect(screen.queryByText(/old@example.test/)).toBeNull();
});

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recoveryRequest, type RecoveryRole } from '@/lib/passwordRecovery';
type Status = { email: string | null; hasPassword: boolean; verified: boolean };

export default function RecoveryEmailSettings({ role, accountId }: { role: RecoveryRole; accountId?: string }) {
  return <RecoverySettingsForm key={`${role}:${accountId || ''}`} role={role} />;
}

function RecoverySettingsForm({ role }: { role: RecoveryRole }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true; setError('');setStatus(null);
    recoveryRequest(role, 'status', undefined, true).then(value => { if (active) setStatus(value); })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [role, reload]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');setMessage('');
    try { const result = await recoveryRequest(role, 'verification/request', { currentPassword: password }, true);setMessage(result.message);setPassword(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <section aria-label='Password recovery' className='my-5 space-y-3 rounded-xl border bg-card p-4'>
    <h2 className='font-semibold'>Password recovery</h2>
    {error && <p role='alert' className='text-destructive'>{error}</p>}
    {message && <p role='status'>{message}</p>}
    {!status && !error && <p>Checking recovery email…</p>}
    {status && (!status.hasPassword ? <p>Use your existing Google or mobile sign-in. This account has no password to reset.</p>
      : !status.email ? <p>A real email address is needed for recovery. Contact support to update your account email.</p>
      : status.verified ? <><p>Recovery email verified: {status.email}</p><Link className='text-primary underline' to={`${role==='technician'?'/technician':''}/forgot-password`}>Reset password by email</Link></>
      : <form onSubmit={submit} className='space-y-3'>
        <p>Verify {status.email} now so you can recover your account if you forget your password.</p>
        <label className='block space-y-2'><span>Current password</span><Input type='password' autoComplete='current-password' required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <Button type='submit' disabled={busy}>{busy?'Sending…':'Verify recovery email'}</Button>
      </form>)}
    <Button type='button' variant='outline' onClick={()=>setReload(n=>n+1)}>Refresh recovery status</Button>
  </section>;
}

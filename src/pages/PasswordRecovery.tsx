import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recoveryRequest, type RecoveryRole } from '@/lib/passwordRecovery';
import { clearRecoveryToken, getRecoveryToken } from '@/lib/passwordRecoveryLink';

type RecoveryProps = { role: RecoveryRole; mode: 'request' | 'reset' | 'verify' };
export default function PasswordRecovery(props: RecoveryProps) {
  return <RecoveryForm key={`${props.role}:${props.mode}`} {...props} />;
}

function RecoveryForm({ role, mode }: RecoveryProps) {
  const [token] = useState(getRecoveryToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const prefix = role === 'technician' ? '/technician' : '';
  const invalid = mode !== 'request' && !token;
  const title = mode === 'request' ? 'Forgot password' : mode === 'reset' ? 'Set a new password' : 'Verify recovery email';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setError('');
    if (mode === 'reset') {
      if (password !== confirmation) { setError('Your passwords must match.'); return; }
      if (password.trim().length < 12 || new TextEncoder().encode(password).length > 72) { setError('Use at least 12 nonblank characters and no more than 72 UTF-8 bytes.'); return; }
    }
    setBusy(true);
    try {
      const result = await recoveryRequest(role, mode === 'request' ? 'request' : mode === 'reset' ? 'confirm' : 'verification/confirm',
        mode === 'request' ? { email } : mode === 'reset' ? { token, password } : { token });
      setMessage(result.message); setPassword(''); setConfirmation('');
      if (mode !== 'request') clearRecoveryToken();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { setBusy(false); }
  };

  return <main className='min-h-screen bg-background px-5 py-12'>
    <section className='mx-auto max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm'>
      <p className='font-semibold text-primary'>ResQNow · {role === 'technician' ? 'Technician' : 'Customer'}</p>
      <h1 className='text-2xl font-bold'>{title}</h1>
      {mode === 'request' && <p className='text-sm text-muted-foreground'>Enter your account email. Recovery works after you have verified your recovery address. If you use Google or mobile sign-in, continue using that method. Without a verified address, contact support.</p>}
      {mode === 'reset' && <p className='text-sm text-muted-foreground'>Use at least 12 characters and no more than 72 UTF-8 bytes. After resetting, sign in again with your new password.</p>}
      {mode === 'verify' && <p className='text-sm text-muted-foreground'>Confirm that you want to use this email for password recovery.</p>}
      {invalid && <p role='alert'>This link is invalid or missing. Request a new link.</p>}
      {error && <p role='alert' className='text-destructive'>{error}</p>}
      {message ? <p role='status'>{message}</p> : !invalid && <form onSubmit={submit} className='space-y-4'>
        {mode === 'request' && <label className='block space-y-2'><span>Email address</span><Input type='email' autoComplete='email' required value={email} onChange={e=>setEmail(e.target.value)} /></label>}
        {mode === 'reset' && <>
          <label className='block space-y-2'><span>New password</span><Input type='password' autoComplete='new-password' required minLength={12} value={password} onChange={e=>setPassword(e.target.value)} /></label>
          <label className='block space-y-2'><span>Confirm new password</span><Input type='password' autoComplete='new-password' required minLength={12} value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label>
        </>}
        <Button className='w-full' type='submit' disabled={busy}>{busy ? 'Please wait…' : mode === 'request' ? 'Send reset link' : mode === 'reset' ? 'Reset password' : 'Verify recovery email'}</Button>
      </form>}
      {mode !== 'request' && <Link className='block text-primary underline' to={`${prefix}/forgot-password`}>Request a new reset link</Link>}
      {mode === 'verify' && <p className='text-sm'>For a new verification link, sign in and open your account’s security settings.</p>}
      <Link className='block text-primary underline' to={`${prefix}/login`}>Back to sign in</Link>
      <Link className='block text-sm underline' to='/contact'>Contact support</Link>
    </section>
  </main>;
}

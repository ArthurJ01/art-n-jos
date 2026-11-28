import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LOGIN_CODE_LENGTH } from '@art-web/shared';
import { useMe, useRequestCode, useVerifyCode } from '../lib/api';
import { paths } from '../lib/paths';

/**
 * Login in two steps: first your email address, then the code that was sent
 * to it. There is no password to remember.
 */
export function LoginPage() {
  const { data: me, isPending } = useMe();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const requestCode = useRequestCode();
  const verifyCode = useVerifyCode();
  // Where RequireAuth sent us from, to go back there after logging in.
  const from = (useLocation().state as { from?: string } | null)?.from ?? paths.home;

  if (isPending) return <p className="muted">Laddar…</p>;
  // Also what moves you on after a successful login: verifying the code
  // updates `me`, and this page then steps aside.
  if (me?.authenticated) return <Navigate to={from} replace />;

  const onRequestCode = (e: FormEvent) => {
    e.preventDefault();
    requestCode.mutate(email);
  };

  const onVerifyCode = (e: FormEvent) => {
    e.preventDefault();
    verifyCode.mutate({ email, code });
  };

  const startOver = () => {
    setCode('');
    requestCode.reset();
    verifyCode.reset();
  };

  if (!requestCode.isSuccess) {
    return (
      <form className="form form-narrow" onSubmit={onRequestCode}>
        <h1>Logga in</h1>
        <p className="muted">Skriv din e-postadress, så skickar vi en kod att logga in med.</p>
        <label>
          E-post
          <input
            className="input"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {requestCode.error && <p className="error">{requestCode.error.message}</p>}
        <div className="actions">
          <button type="submit" className="button button-primary" disabled={requestCode.isPending}>
            {requestCode.isPending ? 'Skickar…' : 'Skicka kod'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="form form-narrow" onSubmit={onVerifyCode}>
      <h1>Skriv in koden</h1>
      <p className="muted">
        Om <strong>{email.trim()}</strong> har tillgång har vi skickat en kod dit. Den gäller i 10
        minuter.
      </p>
      <label>
        Kod
        <input
          className="input code-input"
          // Not type="number": a code is digits, not an amount, and it may start with 0.
          type="text"
          inputMode="numeric"
          // Lets phones offer the code straight from the email or message.
          autoComplete="one-time-code"
          required
          autoFocus
          maxLength={LOGIN_CODE_LENGTH}
          pattern={`\\d{${LOGIN_CODE_LENGTH}}`}
          title={`${LOGIN_CODE_LENGTH} siffror`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      {verifyCode.error && <p className="error">{verifyCode.error.message}</p>}
      <div className="actions">
        <button type="submit" className="button button-primary" disabled={verifyCode.isPending}>
          Logga in
        </button>
        <button type="button" className="button button-ghost" onClick={startOver}>
          Börja om
        </button>
      </div>
    </form>
  );
}

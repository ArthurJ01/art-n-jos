import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LOGIN_CODE_LENGTH } from '@art-web/shared';
import { useMe, useRequestCode, useVerifyCode } from '../lib/api';
import { paths } from '../lib/paths';

/** Which six digits you are about to type: a code from an email, or the fixed PIN. */
type CodeKind = 'emailed' | 'pin';

/**
 * Login in two steps: first your email address, then six digits. You choose
 * which six: a code that is sent to the address, or the PIN you already know.
 */
export function LoginPage() {
  const { data: me, isPending } = useMe();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  /** null while still on the first step. */
  const [kind, setKind] = useState<CodeKind | null>(null);
  const emailForm = useRef<HTMLFormElement>(null);
  const requestCode = useRequestCode();
  const verifyCode = useVerifyCode();
  // Where RequireAuth sent us from, to go back there after logging in.
  const from = (useLocation().state as { from?: string } | null)?.from ?? paths.home;

  if (isPending) return <p className="muted">Laddar…</p>;
  // Also what moves you on after a successful login: verifying the code
  // updates `me`, and this page then steps aside.
  if (me?.authenticated) return <Navigate to={from} replace />;

  // Pressing Enter in the address field does this, the first button of the form.
  const onEmailCode = (e: FormEvent) => {
    e.preventDefault();
    requestCode.mutate(email, { onSuccess: () => setKind('emailed') });
  };

  const onUsePin = () => {
    // This button doesn't submit the form, so ask the browser to check the
    // address (and show its usual message) before moving on.
    if (emailForm.current?.reportValidity()) setKind('pin');
  };

  const onVerifyCode = (e: FormEvent) => {
    e.preventDefault();
    verifyCode.mutate({ email, code });
  };

  const startOver = () => {
    setKind(null);
    setCode('');
    requestCode.reset();
    verifyCode.reset();
  };

  if (kind === null) {
    return (
      <form ref={emailForm} className="form form-narrow" onSubmit={onEmailCode}>
        <h1>Logga in</h1>
        <p className="muted">
          {me?.pinLogin
            ? 'Skriv din e-postadress. Logga sedan in med en kod som vi skickar dit, eller med PIN-koden.'
            : 'Skriv din e-postadress, så skickar vi en kod att logga in med.'}
        </p>
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
          {me?.pinLogin && (
            <button type="button" className="button" onClick={onUsePin}>
              Använd PIN-kod
            </button>
          )}
        </div>
      </form>
    );
  }

  const digits = {
    className: 'input code-input',
    inputMode: 'numeric',
    required: true,
    autoFocus: true,
    maxLength: LOGIN_CODE_LENGTH,
    pattern: `\\d{${LOGIN_CODE_LENGTH}}`,
    title: `${LOGIN_CODE_LENGTH} siffror`,
    value: code,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setCode(e.target.value.replace(/\D/g, '')),
  } as const;

  return (
    <form className="form form-narrow" onSubmit={onVerifyCode}>
      <h1>{kind === 'pin' ? 'Skriv in PIN-koden' : 'Skriv in koden'}</h1>
      {kind === 'pin' ? (
        <>
          <p className="muted">
            Loggar in som <strong>{email.trim()}</strong>.
          </p>
          <label>
            PIN-kod
            {/* A password field, so the digits are hidden and the browser can offer to remember them. */}
            <input {...digits} type="password" autoComplete="current-password" />
          </label>
        </>
      ) : (
        <>
          <p className="muted">
            Om <strong>{email.trim()}</strong> har tillgång har vi skickat en kod dit. Den gäller i
            10 minuter.
          </p>
          <label>
            Kod
            {/* Not type="number": a code is digits, not an amount, and it may start with 0.
                "one-time-code" lets phones offer the code straight from the email. */}
            <input {...digits} type="text" autoComplete="one-time-code" />
          </label>
        </>
      )}
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

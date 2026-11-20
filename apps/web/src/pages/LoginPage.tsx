import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useLogin } from '../lib/api';
import { paths } from '../lib/paths';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? paths.home;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(password, { onSuccess: () => navigate(from, { replace: true }) });
  };

  return (
    <form className="form form-narrow" onSubmit={onSubmit}>
      <h1>Logga in</h1>
      <p className="muted">Ange det gemensamma lösenordet för att lägga till och ändra saker.</p>
      <label>
        Lösenord
        <input
          className="input"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {login.error && <p className="error">{login.error.message}</p>}
      <div className="actions">
        <button type="submit" className="button button-primary" disabled={login.isPending}>
          Logga in
        </button>
      </div>
    </form>
  );
}

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '../components/RequireAuth';
import { LoginPage } from './LoginPage';

const CODE = '042137';

/**
 * A fake API with the two login steps. Returns what the page has sent, so a
 * test can check it. The "session" is just a variable here.
 */
function fakeApi({ authenticated = false } = {}) {
  const sent: { path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    const path = url.replace('/api', '');
    const json = (body: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (path === '/auth/me') return json({ authenticated });

    const body = JSON.parse(init.body as string) as { email: string; code?: string };
    sent.push({ path, body });
    if (path === '/auth/request-code') return json({ sent: true });
    if (path === '/auth/verify-code') {
      if (body.code !== CODE) return json({ error: 'Fel kod, eller så har den gått ut' }, 401);
      authenticated = true;
      return json({ authenticated });
    }
    return json({ error: 'Hittades inte' }, 404);
  });
  return sent;
}

/** A tiny copy of the real router: one private page, and the login page. */
function renderApp(startAt = '/recept/3') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[startAt]}>
        <Routes>
          <Route path="/logga-in" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>Startsidan</p>} />
            <Route path="/recept/:id" element={<p>Ett hemligt recept</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login', () => {
  it('shows the login page instead of a private page, and the page itself after logging in', async () => {
    const sent = fakeApi();
    const user = userEvent.setup();
    renderApp('/recept/3');

    await user.type(await screen.findByLabelText('E-post'), 'art@example.com');
    expect(screen.queryByText('Ett hemligt recept')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skicka kod' }));

    await user.type(await screen.findByLabelText('Kod'), CODE);
    await user.click(screen.getByRole('button', { name: 'Logga in' }));

    // Back on the page that was asked for, not on the start page.
    expect(await screen.findByText('Ett hemligt recept')).toBeInTheDocument();
    expect(sent).toEqual([
      { path: '/auth/request-code', body: { email: 'art@example.com' } },
      { path: '/auth/verify-code', body: { email: 'art@example.com', code: CODE } },
    ]);
  });

  it('says so when the code is wrong, and lets you start over', async () => {
    fakeApi();
    const user = userEvent.setup();
    renderApp('/logga-in');

    await user.type(await screen.findByLabelText('E-post'), 'art@example.com');
    await user.click(screen.getByRole('button', { name: 'Skicka kod' }));
    // Anything that is not a digit is dropped while typing.
    const codeInput = await screen.findByLabelText('Kod');
    await user.type(codeInput, '11 11-11');
    expect(codeInput).toHaveValue('111111');
    await user.click(screen.getByRole('button', { name: 'Logga in' }));

    expect(await screen.findByText('Fel kod, eller så har den gått ut')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Börja om' }));
    // The address is still filled in, ready to ask for a new code.
    expect(screen.getByLabelText('E-post')).toHaveValue('art@example.com');
  });

  it('skips the login page for someone who is already logged in', async () => {
    fakeApi({ authenticated: true });
    renderApp('/logga-in');
    expect(await screen.findByText('Startsidan')).toBeInTheDocument();
  });
});

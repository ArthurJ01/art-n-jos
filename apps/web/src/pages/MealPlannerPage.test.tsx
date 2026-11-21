import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MealPlanEntry } from '@art-web/shared';
import { MealPlannerPage } from './MealPlannerPage';

const lasagne = { id: 3, title: 'Lasagne' };
const planned: MealPlanEntry = {
  id: 1,
  date: '2026-11-17',
  meal: 'dinner',
  kind: 'recipe',
  recipeId: 3,
  recipeTitle: 'Lasagne',
  title: null,
  isLeftover: false,
};

/**
 * Replaces fetch with a tiny fake API that remembers the plan in memory, and
 * returns the list of write requests (POST, DELETE) the page has made.
 */
const parseBody = (init: RequestInit): unknown =>
  init.body ? JSON.parse(init.body as string) : undefined;

function fakeApi({ authenticated }: { authenticated: boolean }) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  let entries = [planned];
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    const path = url.replace('/api', '');
    const method = init.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ method, path, body: parseBody(init) });
    }
    if (method === 'POST') {
      const created = { ...(parseBody(init) as MealPlanEntry), id: 99, recipeTitle: 'Lasagne' };
      entries = [...entries, created];
      return json(created, 201);
    }
    if (method === 'DELETE') {
      entries = entries.filter((e) => `/meal-plan/${e.id}` !== path);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (path === '/auth/me') return json({ authenticated });
    if (path.startsWith('/recipes')) return json([lasagne]);
    if (path.startsWith('/meal-plan')) return json(entries);
    return json({ error: 'Hittades inte' }, 404);
  });
  return writes;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      {/* The week of Monday 16 November 2026. */}
      <MemoryRouter initialEntries={['/matplanering?vecka=2026-11-16']}>
        <MealPlannerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MealPlannerPage', () => {
  it('shows the week and its planned meals read-only when logged out', async () => {
    fakeApi({ authenticated: false });
    renderPage();

    expect(screen.getByText('Vecka 47')).toBeInTheDocument();
    const tuesday = screen.getByRole('region', { name: /tisdag 17 nov/ });
    const link = await within(tuesday).findByRole('link', { name: 'Lasagne' });
    expect(link).toHaveAttribute('href', '/recept/3');

    expect(await screen.findByText(/för att ändra planeringen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ta bort Lasagne' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Recept att planera')).not.toBeInTheDocument();

    // Double-clicking a slot does nothing for visitors.
    await userEvent.setup().dblClick(within(tuesday).getByText('Frukost'));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('places a recipe by clicking it and then a slot', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const palette = await screen.findByLabelText('Recept att planera');
    await user.click(await within(palette).findByRole('button', { name: 'Lasagne' }));
    await user.click(screen.getByRole('button', { name: 'Lägg till Lasagne: onsdag lunch' }));

    expect(writes).toEqual([
      {
        method: 'POST',
        path: '/meal-plan',
        body: {
          date: '2026-11-18',
          meal: 'lunch',
          kind: 'recipe',
          recipeId: 3,
          isLeftover: false,
        },
      },
    ]);
  });

  it('plans a custom meal typed into the search box', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const palette = await screen.findByLabelText('Recept att planera');
    await user.type(within(palette).getByRole('searchbox'), '  Tacos   hos mamma ');
    await user.click(within(palette).getByRole('button', { name: 'Egen måltid: Tacos hos mamma' }));
    await user.click(
      screen.getByRole('button', { name: 'Lägg till Tacos hos mamma: fredag middag' }),
    );

    expect(writes).toEqual([
      {
        method: 'POST',
        path: '/meal-plan',
        body: {
          date: '2026-11-20',
          meal: 'dinner',
          kind: 'custom',
          title: 'Tacos hos mamma',
          isLeftover: false,
        },
      },
    ]);
    const friday = screen.getByRole('region', { name: /fredag 20 nov/ });
    expect(await within(friday).findByText('Tacos hos mamma')).toBeInTheDocument();
  });

  it('does not offer a custom meal named like an existing recipe', async () => {
    fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const palette = await screen.findByLabelText('Recept att planera');
    await within(palette).findByRole('button', { name: 'Lasagne' });
    await user.type(within(palette).getByRole('searchbox'), 'lasagne');
    expect(within(palette).getByRole('button', { name: 'Lasagne' })).toBeInTheDocument();
    expect(within(palette).queryByRole('button', { name: /Egen måltid/ })).not.toBeInTheDocument();
  });

  it('adds a meal typed into a slot after double-clicking it', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const thursday = screen.getByRole('region', { name: /torsdag 19 nov/ });
    await user.dblClick(await within(thursday).findByText('Middag'));
    const box = screen.getByRole('combobox', {
      name: 'Sök recept eller skriv en måltid för torsdag middag',
    });
    expect(box).toHaveFocus();

    await user.keyboard('Pizza{Enter}');
    expect(writes).toEqual([
      {
        method: 'POST',
        path: '/meal-plan',
        body: {
          date: '2026-11-19',
          meal: 'dinner',
          kind: 'custom',
          title: 'Pizza',
          isLeftover: false,
        },
      },
    ]);
    // The search box closes once something is picked.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('picks a recipe from the double-click search with the arrow keys', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();
    // Wait for the recipes to load.
    await within(await screen.findByLabelText('Recept att planera')).findByRole('button', {
      name: 'Lasagne',
    });

    const monday = screen.getByRole('region', { name: /måndag 16 nov/ });
    await user.dblClick(within(monday).getByText('Frukost'));
    await user.keyboard('las');
    // "Lasagne" first, then "Egen måltid: las"; move down and back up again.
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Lasagne', 'Egen måltid: las']);
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');

    expect(writes[0]?.body).toEqual({
      date: '2026-11-16',
      meal: 'breakfast',
      kind: 'recipe',
      recipeId: 3,
      isLeftover: false,
    });
  });

  it('closes the double-click search with Escape without adding anything', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const monday = screen.getByRole('region', { name: /måndag 16 nov/ });
    await user.dblClick(await within(monday).findByText('Lunch'));
    await user.keyboard('Pizza{Escape}');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it('turns a planned recipe into a lunch box for the next day', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'Gör matlåda av Lasagne till lunch dagen efter',
      }),
    );

    expect(writes[0]?.body).toEqual({
      date: '2026-11-18',
      meal: 'lunch',
      kind: 'recipe',
      recipeId: 3,
      isLeftover: true,
    });
    const wednesday = screen.getByRole('region', { name: /onsdag 18 nov/ });
    expect(await within(wednesday).findByText('Matlåda')).toBeInTheDocument();
  });

  it('removes a planned meal', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Ta bort Lasagne' }));
    expect(writes).toEqual([{ method: 'DELETE', path: '/meal-plan/1', body: undefined }]);
  });
});

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
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
 * returns the list of write requests (POST, PUT, DELETE) the page has made.
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
    if (method === 'PUT') {
      const body = parseBody(init) as Partial<MealPlanEntry>;
      const id = Number(path.split('/').pop());
      const updated = {
        recipeId: null,
        title: null,
        ...body,
        id,
        recipeTitle: body.recipeId ? 'Lasagne' : null,
      } as MealPlanEntry;
      entries = entries.map((e) => (e.id === id ? updated : e));
      return json(updated);
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

/** Shows which page the router is on, so a test can tell whether a link was followed. */
function CurrentPath() {
  return <output aria-label="Sida">{useLocation().pathname}</output>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      {/* The week of Monday 16 November 2026. */}
      <MemoryRouter initialEntries={['/matplanering?vecka=2026-11-16']}>
        <MealPlannerPage />
        <CurrentPath />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Waits in real time, longer than a press-and-hold takes. */
const holdFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const lasagne = await within(palette).findByRole('button', { name: 'Lasagne' });
    // The list has no instructions: the only text is what a clicked recipe is waiting for.
    expect(within(palette).queryByText(/Välj en ruta/)).not.toBeInTheDocument();
    await user.click(lasagne);
    expect(within(palette).getByText('Välj en ruta för ”Lasagne”.')).toBeInTheDocument();
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

  it('saves what is typed when clicking outside the search box', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const thursday = screen.getByRole('region', { name: /torsdag 19 nov/ });
    await user.dblClick(await within(thursday).findByText('Middag'));
    await user.keyboard('Pizza');
    await user.click(screen.getByRole('heading', { name: 'Matplanering' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(writes.map((w) => w.body)).toEqual([
      { date: '2026-11-19', meal: 'dinner', kind: 'custom', title: 'Pizza', isLeftover: false },
    ]);
  });

  it('saves the typed text as it stands, not the nearest recipe', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();
    await within(await screen.findByLabelText('Recept att planera')).findByRole('button', {
      name: 'Lasagne',
    });
    const outside = screen.getByRole('heading', { name: 'Matplanering' });
    const monday = screen.getByRole('region', { name: /måndag 16 nov/ });

    // "las" is part of "Lasagne", but it is not what was typed.
    await user.dblClick(within(monday).getByText('Frukost'));
    await user.keyboard('las');
    await user.click(outside);
    // The whole name of a recipe is that recipe.
    await user.dblClick(within(monday).getByText('Lunch'));
    await user.keyboard('lasagne');
    await user.click(outside);

    expect(writes.map((w) => w.body)).toMatchObject([
      { meal: 'breakfast', kind: 'custom', title: 'las' },
      { meal: 'lunch', kind: 'recipe', recipeId: 3 },
    ]);
  });

  it('closes an empty search box without adding anything when clicking outside', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const monday = screen.getByRole('region', { name: /måndag 16 nov/ });
    await user.dblClick(await within(monday).findByText('Lunch'));
    await user.keyboard('  ');
    await user.click(screen.getByRole('heading', { name: 'Matplanering' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it('changes a planned meal after double-clicking it', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const tuesday = screen.getByRole('region', { name: /tisdag 17 nov/ });
    await user.dblClick(await within(tuesday).findByRole('link', { name: 'Lasagne' }));
    const box = screen.getByRole('combobox');
    expect(box).toHaveFocus();
    expect(box).toHaveValue('Lasagne');

    // The name is selected, so typing replaces it.
    await user.keyboard('Pizza{Enter}');
    expect(writes).toEqual([
      {
        method: 'PUT',
        path: '/meal-plan/1',
        body: {
          date: '2026-11-17',
          meal: 'dinner',
          kind: 'custom',
          title: 'Pizza',
          isLeftover: false,
        },
      },
    ]);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(await within(tuesday).findByText('Pizza')).toBeInTheDocument();
    // A double-click changes the meal; it does not open the recipe.
    expect(screen.getByLabelText('Sida')).toHaveTextContent('/matplanering');
  });

  it('leaves a meal alone when its search box is closed untouched', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();
    const tuesday = screen.getByRole('region', { name: /tisdag 17 nov/ });
    const edit = await within(tuesday).findByRole('button', { name: 'Ändra Lasagne' });

    await user.click(edit);
    expect(screen.getByRole('combobox')).toHaveValue('Lasagne');
    await user.click(screen.getByRole('heading', { name: 'Matplanering' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await user.click(edit);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    expect(writes).toEqual([]);
  });

  it('opens a recipe on a single click, after waiting for a second one', async () => {
    fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'Ändra Lasagne' }); // logged in

    await user.click(screen.getByRole('link', { name: 'Lasagne' }));
    expect(screen.getByLabelText('Sida')).toHaveTextContent('/matplanering');
    await act(() => holdFor(400));
    expect(screen.getByLabelText('Sida')).toHaveTextContent('/recept/3');
  });

  it('opens the search box on press and hold with a finger', async () => {
    const writes = fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();

    const wednesday = screen.getByRole('region', { name: /onsdag 18 nov/ });
    const label = await within(wednesday).findByText('Middag');
    const touch = { clientX: 10, clientY: 10 };
    await user.pointer({ keys: '[TouchA>]', target: label, coords: touch });
    await act(() => holdFor(600));
    await user.pointer({ keys: '[/TouchA]', target: label, coords: touch });
    // Phones only open the keyboard for focus() while the finger lifts.
    fireEvent.touchEnd(label);

    const box = screen.getByRole('combobox', {
      name: 'Sök recept eller skriv en måltid för onsdag middag',
    });
    expect(box).toHaveFocus();
    await user.keyboard('Pizza{Enter}');
    expect(writes[0]?.body).toMatchObject({ date: '2026-11-18', meal: 'dinner', title: 'Pizza' });
  });

  it('does not open the search box for a short tap, a scroll or a mouse hold', async () => {
    fakeApi({ authenticated: true });
    const user = userEvent.setup();
    renderPage();
    const wednesday = screen.getByRole('region', { name: /onsdag 18 nov/ });
    const label = await within(wednesday).findByText('Middag');

    const isOpen = () => screen.queryByRole('combobox') !== null;

    // A short tap.
    await user.pointer({ keys: '[TouchA]', target: label });
    await act(() => holdFor(600));
    expect(isOpen()).toBe(false);

    // A finger that moves (scrolling) before the time is up.
    await user.pointer({ keys: '[TouchA>]', target: label, coords: { clientX: 10, clientY: 10 } });
    await user.pointer({
      pointerName: 'TouchA',
      target: label,
      coords: { clientX: 10, clientY: 60 },
    });
    await act(() => holdFor(600));
    expect(isOpen()).toBe(false);
    await user.pointer({ keys: '[/TouchA]', target: label });

    // Holding the mouse button: mice have double-click instead.
    await user.pointer({ keys: '[MouseLeft>]', target: label });
    await act(() => holdFor(600));
    expect(isOpen()).toBe(false);
    await user.pointer({ keys: '[/MouseLeft]', target: label });
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

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@art-web/shared';
import { RecipeDetailPage } from './RecipeDetailPage';

const recipe: Recipe = {
  id: 3,
  title: 'Krämig kycklinggryta',
  description: 'En mild gryta.',
  servings: 4,
  prepMinutes: 15,
  cookMinutes: 30,
  ingredients: [
    'ca 500 g kycklingfilé',
    '2 vitlöksklyftor',
    'Sås:',
    '2 dl grädde',
    'Saften av 1 lime',
  ],
  steps: ['Bryn kycklingen.', 'Sås:', 'Rör ner grädden.', 'Servera.'],
  tips: 'Passar bra som matlåda.',
  tags: ['kyckling'],
  sourceUrl: 'https://www.example.com/gryta',
  createdBy: 'Arthur',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function renderPage(shown: Recipe = recipe) {
  vi.stubGlobal('fetch', (url: string) => {
    const body = url.endsWith('/auth/me') ? { authenticated: false } : shown;
    return Promise.resolve(new Response(JSON.stringify(body)));
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/recept/3']}>
        <Routes>
          <Route path="/recept/:id" element={<RecipeDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: shown.title });
}

/** What each ingredient row says: its name, then its amount. */
const ingredientRows = () =>
  within(screen.getByRole('region', { name: 'Ingredienser' }))
    .getAllByRole('checkbox')
    .map((box) => box.closest('label')?.textContent);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RecipeDetailPage', () => {
  it('lists the ingredients in groups, with the name and the amount apart', async () => {
    await renderPage();
    const ingredients = screen.getByRole('region', { name: 'Ingredienser' });

    expect(ingredientRows()).toEqual([
      'kycklingfilé ca 500 g',
      'vitlöksklyftor 2',
      'grädde 2 dl',
      'Saften av 1 lime ',
    ]);
    expect(within(ingredients).getByRole('heading', { name: 'Sås:' })).toBeInTheDocument();
    // Each row is a checkbox, named by what it says.
    const garlic = within(ingredients).getByRole('checkbox', { name: 'vitlöksklyftor 2' });
    await userEvent.setup().click(garlic);
    expect(garlic).toBeChecked();
  });

  it('recalculates the amounts for another number of portions', async () => {
    await renderPage();
    const user = userEvent.setup();
    const portions = screen.getByRole('group', { name: 'Antal portioner' });
    expect(within(portions).getByRole('status')).toHaveTextContent('4 port');

    await user.click(within(portions).getByRole('button', { name: 'Fler portioner' }));
    await user.click(within(portions).getByRole('button', { name: 'Fler portioner' }));
    expect(within(portions).getByRole('status')).toHaveTextContent('6 port');
    expect(ingredientRows()).toEqual([
      'kycklingfilé ca 750 g',
      'vitlöksklyftor 3',
      'grädde 3 dl',
      // An amount in the middle of a line can't be recalculated, and is marked.
      'Saften av 1 lime * ',
    ]);
    expect(screen.getByText(/Omräknat från 4 port/)).toHaveTextContent(
      'Rader med * har en mängd som inte gick att räkna om.',
    );

    // Back at the recipe's own portions the amounts are as they were typed.
    await user.click(within(portions).getByRole('button', { name: 'Färre portioner' }));
    await user.click(within(portions).getByRole('button', { name: 'Färre portioner' }));
    expect(ingredientRows()[0]).toBe('kycklingfilé ca 500 g');
    expect(screen.queryByText(/Omräknat/)).not.toBeInTheDocument();
  });

  it('has no portion buttons for a recipe without portions', async () => {
    await renderPage({ ...recipe, servings: null });
    expect(screen.queryByRole('group', { name: 'Antal portioner' })).not.toBeInTheDocument();
    expect(ingredientRows()[0]).toBe('kycklingfilé ca 500 g');
  });

  it('numbers the steps across the groups and lets them be ticked off', async () => {
    await renderPage();
    const steps = screen.getByRole('region', { name: 'Gör så här' });

    expect(
      within(steps)
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual(['1. Bryn kycklingen.', '2. Rör ner grädden.', '3. Servera.']);
    expect(within(steps).getByRole('heading', { name: 'Sås:' })).toBeInTheDocument();

    const last = within(steps).getByRole('checkbox', { name: '3. Servera.' });
    await userEvent.setup().click(last);
    expect(last).toBeChecked();
  });

  it('shows the times, the tips and where the recipe is from', async () => {
    await renderPage();
    expect(screen.getByText(/45 min/)).toHaveTextContent(
      '45 min (15 min förberedelse, 30 min tillagning)',
    );
    expect(
      within(screen.getByRole('region', { name: 'Tips' })).getByText(recipe.tips!),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Från example.com ↗' })).toHaveAttribute(
      'href',
      'https://www.example.com/gryta',
    );
    // Visitors can't change anything.
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Redigera' })).toBeNull());
  });
});

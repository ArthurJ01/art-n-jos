import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecipeImport } from '@art-web/shared';
import { RecipeFormPage } from './RecipeFormPage';

const pancakes: RecipeImport = {
  found: 'full',
  recipe: {
    title: 'Pannkakor',
    description: 'Tunna pannkakor.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 30,
    ingredients: ['2 ½ dl vetemjöl', '6 dl mjölk', '3 ägg'],
    steps: ['Vispa ihop smeten.', 'Stek tunna pannkakor.'],
    tags: ['middag'],
    sourceUrl: 'https://example.com/pannkakor',
  },
};

/** A fake API that records what the page sends. `importResult` is what "Hämta recept" gets back. */
function fakeApi(importResult: RecipeImport | { error: string } = pancakes) {
  const sent: { path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    const path = url.replace('/api', '');
    const json = (body: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (init.method !== 'POST') return json({ authenticated: true });

    const body: unknown = JSON.parse(init.body as string);
    sent.push({ path, body });
    if (path === '/recipes/import') return json(importResult, 'error' in importResult ? 422 : 200);
    return json({ ...(body as object), id: 9 }, 201);
  });
  return sent;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/recept/ny']}>
        <Routes>
          <Route path="/recept/ny" element={<RecipeFormPage />} />
          <Route path="/recept/:id" element={<p>Receptet är sparat</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The two lists of the form. Looked up each time they are used, since the
// form is built anew when a recipe has been fetched from a link.
const ingredientList = () => screen.getByRole('group', { name: /Ingredienser/ });
const stepList = () => screen.getByRole('group', { name: /Gör så här/ });

/** The text of every row in one of the two lists. */
const rowTexts = (list: HTMLElement) =>
  within(list)
    .getAllByRole('textbox')
    .map((box) => (box as HTMLTextAreaElement).value);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RecipeFormPage', () => {
  it('builds a recipe row by row, with Enter for the next row', async () => {
    const sent = fakeApi();
    const user = userEvent.setup();
    renderPage();
    const ingredients = ingredientList();
    const steps = stepList();

    await user.type(screen.getByLabelText('Titel'), 'Gryta');
    await user.type(screen.getByLabelText('Portioner'), '4');

    await user.click(within(ingredients).getByLabelText('Ingrediens 1'));
    await user.keyboard('500 g kyckling{Enter}2 dl grädde');
    // A heading splits the list into groups. Enter after it goes on with ingredients.
    await user.click(within(ingredients).getByRole('button', { name: '+ Rubrik' }));
    await user.keyboard('Till servering{Enter}Ris');
    expect(rowTexts(ingredients)).toEqual([
      '500 g kyckling',
      '2 dl grädde',
      'Till servering',
      'Ris',
    ]);

    await user.click(within(steps).getByLabelText('Steg 1'));
    // A colon at the end of a step is dropped: it would make the step a heading.
    await user.keyboard('Bryn kycklingen.{Enter}Blanda såsen:{Enter}');
    await user.type(screen.getByLabelText(/^Tips/), 'Blir godare dagen efter.');

    await user.click(screen.getByRole('button', { name: 'Spara' }));
    expect(await screen.findByText('Receptet är sparat')).toBeInTheDocument();
    expect(sent).toEqual([
      {
        path: '/recipes',
        body: {
          title: 'Gryta',
          description: null,
          servings: 4,
          prepMinutes: null,
          cookMinutes: null,
          ingredients: ['500 g kyckling', '2 dl grädde', 'Till servering:', 'Ris'],
          steps: ['Bryn kycklingen.', 'Blanda såsen'],
          tips: 'Blir godare dagen efter.',
          tags: [],
          sourceUrl: null,
          createdBy: null,
        },
      },
    ]);
  });

  it('removes an empty row with Backspace, and moves and removes rows with the buttons', async () => {
    fakeApi();
    const user = userEvent.setup();
    renderPage();
    const ingredients = ingredientList();

    await user.click(within(ingredients).getByLabelText('Ingrediens 1'));
    await user.keyboard('Ägg{Enter}Mjölk{Enter}Smör{Enter}');
    expect(rowTexts(ingredients)).toEqual(['Ägg', 'Mjölk', 'Smör', '']);

    // Backspace in the empty row takes it away and goes back to the row above.
    await user.keyboard('{Backspace}');
    expect(rowTexts(ingredients)).toEqual(['Ägg', 'Mjölk', 'Smör']);
    expect(within(ingredients).getByLabelText('Ingrediens 3')).toHaveFocus();

    await user.click(
      within(ingredients).getByRole('button', { name: 'Flytta upp ingrediens Smör' }),
    );
    expect(rowTexts(ingredients)).toEqual(['Ägg', 'Smör', 'Mjölk']);
    await user.click(
      within(ingredients).getByRole('button', { name: 'Flytta ner ingrediens Ägg' }),
    );
    expect(rowTexts(ingredients)).toEqual(['Smör', 'Ägg', 'Mjölk']);
    await user.click(within(ingredients).getByRole('button', { name: 'Ta bort ingrediens Ägg' }));
    expect(rowTexts(ingredients)).toEqual(['Smör', 'Mjölk']);
  });

  it('turns several pasted lines into rows', async () => {
    fakeApi();
    const user = userEvent.setup();
    renderPage();
    const ingredients = ingredientList();

    await user.click(within(ingredients).getByLabelText('Ingrediens 1'));
    await user.paste('- 3 ägg\n- 6 dl mjölk\nTill servering:\nSylt');
    expect(rowTexts(ingredients)).toEqual(['3 ägg', '6 dl mjölk', 'Till servering', 'Sylt']);
    expect(within(ingredients).getByLabelText('Rubrik 3')).toHaveValue('Till servering');

    // One line is pasted into the row like any text.
    await user.keyboard('{Enter}');
    await user.paste('grädde');
    expect(rowTexts(ingredients).at(-1)).toBe('grädde');
  });

  it('fills the form with a recipe fetched from a link', async () => {
    const sent = fakeApi();
    const user = userEvent.setup();
    renderPage();

    // An address copied without https:// works too.
    await user.type(screen.getByLabelText(/Hämta från en länk/), 'example.com/pannkakor');
    await user.click(screen.getByRole('button', { name: 'Hämta recept' }));

    expect(await screen.findByDisplayValue('Pannkakor')).toBe(screen.getByLabelText('Titel'));
    expect(sent).toEqual([
      { path: '/recipes/import', body: { url: 'https://example.com/pannkakor' } },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Receptet är hämtat');
    expect(screen.getByLabelText('Portioner')).toHaveValue(4);
    expect(screen.getByLabelText('Tillagning (min)')).toHaveValue(30);
    expect(rowTexts(ingredientList())).toEqual(['2 ½ dl vetemjöl', '6 dl mjölk', '3 ägg']);
    expect(rowTexts(stepList())).toEqual(['Vispa ihop smeten.', 'Stek tunna pannkakor.']);
    expect(screen.getByLabelText(/^Taggar/)).toHaveValue('middag');
    expect(screen.getByLabelText('Länk till källa')).toHaveValue('https://example.com/pannkakor');

    // Nothing is saved until "Spara".
    await user.click(screen.getByRole('button', { name: 'Spara' }));
    expect(await screen.findByText('Receptet är sparat')).toBeInTheDocument();
    expect(sent[1]).toMatchObject({ path: '/recipes', body: { title: 'Pannkakor' } });
  });

  it('asks before a fetched recipe replaces what has been typed', async () => {
    const sent = fakeApi();
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Titel'), 'Mitt eget recept');
    await user.type(screen.getByLabelText(/Hämta från en länk/), 'https://example.com/pannkakor');
    await user.keyboard('{Enter}');

    expect(confirm).toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(screen.getByLabelText('Titel')).toHaveValue('Mitt eget recept');
  });

  it('says why when a recipe can not be fetched, and when only a title was found', async () => {
    fakeApi({ error: 'Hittade inget recept på den sidan.' });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/Hämta från en länk/), 'https://example.com/x');
    await user.click(screen.getByRole('button', { name: 'Hämta recept' }));
    expect(await screen.findByText('Hittade inget recept på den sidan.')).toBeInTheDocument();

    fakeApi({
      found: 'basic',
      recipe: { title: 'Bara en titel', ingredients: [], steps: [], tags: [] },
    });
    await user.click(screen.getByRole('button', { name: 'Hämta recept' }));
    expect(await screen.findByDisplayValue('Bara en titel')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('bara titel och beskrivning följde med');
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Recipe } from '@art-web/shared';
import { RecipeCard } from './RecipeCard';

const recipe: Recipe = {
  id: 7,
  title: 'Pasta aglio e olio',
  description: 'Garlicky',
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 10,
  ingredients: [],
  steps: [],
  tags: ['pasta', 'quick'],
  sourceUrl: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('RecipeCard', () => {
  it('shows the title, total time and tags, and links to the recipe', () => {
    render(
      <MemoryRouter>
        <RecipeCard recipe={recipe} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Pasta aglio e olio' })).toBeInTheDocument();
    expect(screen.getByText('15 min')).toBeInTheDocument();
    expect(screen.getByText('2 portioner')).toBeInTheDocument();
    expect(screen.getByText('quick')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/recept/7');
  });
});

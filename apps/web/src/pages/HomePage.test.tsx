import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('links to each area', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Recept/ })).toHaveAttribute('href', '/recept');
    expect(screen.getByRole('link', { name: /Matplanering/ })).toHaveAttribute(
      'href',
      '/matplanering',
    );
  });
});

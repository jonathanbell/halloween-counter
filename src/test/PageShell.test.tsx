import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageShell } from '../components/PageShell';

describe('PageShell', () => {
  it('links the game page to the other two pages', () => {
    render(<PageShell active="game" title="Test">content</PageShell>);

    expect(screen.getByRole('link', { name: /counter/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /stats/i })).toHaveAttribute('href', '/stats');
    expect(screen.queryByRole('link', { name: /game/i })).not.toBeInTheDocument();
  });

  it('links the stats page to the other two pages', () => {
    render(<PageShell active="stats" title="Test">content</PageShell>);

    expect(screen.getByRole('link', { name: /counter/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /game/i })).toHaveAttribute('href', '/game');
  });

  it('links the counter page to the other two pages', () => {
    render(<PageShell active="counter" title="Test">content</PageShell>);

    expect(screen.getByRole('link', { name: /game/i })).toHaveAttribute('href', '/game');
    expect(screen.getByRole('link', { name: /stats/i })).toHaveAttribute('href', '/stats');
    expect(screen.queryByRole('link', { name: /counter/i })).not.toBeInTheDocument();
  });

  it('renders the title and children', () => {
    render(<PageShell active="game" title="My Title">page body</PageShell>);

    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('page body')).toBeInTheDocument();
  });
});

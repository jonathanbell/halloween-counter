import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageShell } from '../components/PageShell';

// Halloween night, which is what every test but the frozen ones is about
const OPEN = { frozen: false, opensAt: 0 };
const FROZEN = { frozen: true, opensAt: 0 };

describe('PageShell', () => {
  it('drops the game link any day but Halloween', () => {
    render(<PageShell active="counter" title="Test" freeze={FROZEN}>content</PageShell>);

    expect(screen.getByRole('link', { name: /stats/i })).toHaveAttribute('href', '/stats');
    expect(screen.queryByRole('link', { name: /game/i })).not.toBeInTheDocument();
  });

  it('keeps the links out of sight until the server answers', () => {
    render(<PageShell active="counter" title="Test" freeze={null}>content</PageShell>);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links the game page to the other two pages', () => {
    render(<PageShell active="game" title="Test" freeze={OPEN}>content</PageShell>);

    expect(screen.getByRole('link', { name: /counter/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /stats/i })).toHaveAttribute('href', '/stats');
    expect(screen.queryByRole('link', { name: /game/i })).not.toBeInTheDocument();
  });

  it('links the stats page to the other two pages', () => {
    render(<PageShell active="stats" title="Test" freeze={OPEN}>content</PageShell>);

    expect(screen.getByRole('link', { name: /counter/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /game/i })).toHaveAttribute('href', '/game');
  });

  it('links the counter page to the other two pages', () => {
    render(<PageShell active="counter" title="Test" freeze={OPEN}>content</PageShell>);

    expect(screen.getByRole('link', { name: /game/i })).toHaveAttribute('href', '/game');
    expect(screen.getByRole('link', { name: /stats/i })).toHaveAttribute('href', '/stats');
    expect(screen.queryByRole('link', { name: /counter/i })).not.toBeInTheDocument();
  });

  it('renders the title and children', () => {
    render(<PageShell active="game" title="My Title" freeze={OPEN}>page body</PageShell>);

    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('page body')).toBeInTheDocument();
  });
});

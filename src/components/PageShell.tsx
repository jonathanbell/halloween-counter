import type { ReactNode } from 'react';
import './PageShell.css';

type PageId = 'counter' | 'game' | 'stats';

const TABS: Array<{ id: PageId; href: string; label: string; icon: string }> = [
  { id: 'counter', href: '/', label: 'Counter', icon: '🏠' },
  { id: 'game', href: '/game', label: 'Game', icon: '🎮' },
  { id: 'stats', href: '/stats', label: 'Stats', icon: '📊' },
];

interface PageShellProps {
  active: PageId;
  title: string;
  children: ReactNode;
}

// Shared chrome for every user-facing page. The projection page never
// renders this - it stays chrome-free for the garage door.
export const PageShell = ({ active, title, children }: PageShellProps) => (
  <div className="page-shell">
    <nav className="page-nav">
      {TABS.filter(tab => tab.id !== active).map(tab => (
        <a key={tab.id} href={tab.href} className="pill">
          <span aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </a>
      ))}
    </nav>

    <h1 className="page-title">{title}</h1>
    <div className="rule"><i /><b /><i /></div>

    <div className="page-content page-end">{children}</div>
  </div>
);

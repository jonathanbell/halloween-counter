import type { ReactNode } from 'react';
import type { Freeze } from '../hooks/useFreeze';
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
  // The page's useFreeze() answer; null while the server is being asked
  freeze: Freeze | null;
  children: ReactNode;
}

// Shared chrome for every user-facing page. The projection page never
// renders this - it stays chrome-free for the garage door.
export const PageShell = ({ active, title, freeze, children }: PageShellProps) => {
  // Any day but Halloween there is no game to link to
  const tabs = TABS.filter(tab => tab.id !== active && !(tab.id === 'game' && freeze?.frozen));

  return (
    <div className="page-shell">
      {/* Kept out of sight (but in the layout) until the server answers, so
          the Game pill never shows up and then vanishes */}
      <nav className="page-nav" style={{ visibility: freeze ? 'visible' : 'hidden' }}>
        {tabs.map(tab => (
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
};

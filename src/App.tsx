import { useEffect, useState } from 'react';
import type { CSSProperties, JSX, MouseEvent } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SUBJECTS } from './domain/types';
import type { Subject } from './domain/types';
import { About, Settings } from './pages/Settings';
import { Home } from './pages/Home';
import { Mock } from './pages/Mock';
import { Mistakes } from './pages/Mistakes';
import { Practice } from './pages/Practice';
import { StatsPage } from './pages/StatsPage';
import { loadSettings } from './storage/store';

interface Route {
  readonly path: string;
  /** Optional `?seed=` carried in the hash; reported by the error boundary. */
  readonly seed: number | undefined;
}

function isSubject(value: string): value is Subject {
  return SUBJECTS.some((subject) => subject === value);
}

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const queryStart = raw.indexOf('?');
  const path = queryStart === -1 ? raw : raw.slice(0, queryStart);
  const search = queryStart === -1 ? '' : raw.slice(queryStart + 1);
  const seedParam = new URLSearchParams(search).get('seed');
  const seedNumber = seedParam === null ? Number.NaN : Number(seedParam);
  return {
    path: path === '' ? '/' : path,
    seed: Number.isFinite(seedNumber) ? seedNumber : undefined,
  };
}

function pageFor(path: string): JSX.Element {
  const practice = path.match(/^\/practice\/([^/]+)$/);
  if (practice && isSubject(practice[1])) return <Practice subject={practice[1]} />;
  switch (path) {
    case '/mock':
      return <Mock />;
    case '/stats':
      return <StatsPage />;
    case '/mistakes':
      return <Mistakes />;
    case '/settings':
      return <Settings />;
    case '/about':
      return <About />;
    default:
      return <Home />;
  }
}

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly match: (path: string) => boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '#/practice/arithmetic', label: '四則', match: (p) => p === '/practice/arithmetic' },
  { href: '#/practice/pattern', label: '法則', match: (p) => p === '/practice/pattern' },
  { href: '#/practice/commands', label: '命令', match: (p) => p === '/practice/commands' },
  { href: '#/practice/cipher', label: '暗号', match: (p) => p === '/practice/cipher' },
  { href: '#/mock', label: '模試', match: (p) => p === '/mock' },
  { href: '#/stats', label: '統計', match: (p) => p === '/stats' },
  { href: '#/mistakes', label: '間違い', match: (p) => p === '/mistakes' },
  { href: '#/settings', label: '設定', match: (p) => p === '/settings' },
];

function applyFontScale(): void {
  const settings = loadSettings();
  document.documentElement.style.setProperty('--font-scale', String(settings.fontScale));
}

function focusMain(event: MouseEvent<HTMLAnchorElement>): void {
  event.preventDefault();
  document.getElementById('main')?.focus();
}

function SkipLink(): JSX.Element {
  const [focused, setFocused] = useState(false);
  const hidden: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    border: 0,
  };
  const shown: CSSProperties = {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 20,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    textDecoration: 'none',
  };
  return (
    <a
      href="#main"
      className="btn"
      style={focused ? shown : hidden}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={focusMain}
    >
      本文へスキップ
    </a>
  );
}

export default function App(): JSX.Element {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const onHashChange = (): void => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    applyFontScale();
    const onSettings = (): void => applyFontScale();
    const onStorage = (): void => applyFontScale();
    window.addEventListener('webcab:settings', onSettings);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('webcab:settings', onSettings);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <div className="app">
      <SkipLink />
      <header className="topbar">
        <a href="#/" className="brand">
          Web-CAB Trainer
        </a>
        <nav aria-label="メインナビゲーション">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.match(route.path) ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <ErrorBoundary key={route.path} seed={route.seed}>
          {pageFor(route.path)}
        </ErrorBoundary>
      </main>
    </div>
  );
}

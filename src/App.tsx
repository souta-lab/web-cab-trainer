import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Practice } from './pages/Practice';
import { Mock } from './pages/Mock';
import { StatsPage } from './pages/StatsPage';
import { Mistakes } from './pages/Mistakes';
import { About, Settings } from './pages/Settings';
import type { Subject } from './types';
import { loadSettings } from './storage/store';

function route(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

export default function App() {
  const [path, setPath] = useState(route());
  useEffect(() => {
    const s = loadSettings();
    document.documentElement.style.setProperty('--font-scale', String(s.fontScale));
    const onHash = () => { setPath(route()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  let body: React.ReactNode = <Home />;
  const m = path.match(/^\/practice\/(arithmetic|pattern|commands|cipher)/);
  if (m) body = <Practice key={m[1]} subject={m[1] as Subject} />;
  else if (path === '/mock') body = <Mock />;
  else if (path === '/stats') body = <StatsPage />;
  else if (path === '/mistakes') body = <Mistakes />;
  else if (path === '/settings') body = <Settings />;
  else if (path === '/about') body = <About />;

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">Web-CAB Trainer</a>
        <nav>
          <a href="#/practice/arithmetic">四則</a>
          <a href="#/practice/pattern">法則</a>
          <a href="#/practice/commands">命令</a>
          <a href="#/practice/cipher">暗号</a>
          <a href="#/mock">模試</a>
          <a href="#/stats">統計</a>
        </nav>
      </header>
      <main>{body}</main>
    </div>
  );
}

import type { Subject } from '../types';

export const SUBJECT_LABEL: Record<Subject, string> = {
  arithmetic: '四則逆算',
  pattern: '法則性',
  commands: '命令表',
  cipher: '暗号',
};

export function Home() {
  const link = (href: string, title: string, sub: string) => (
    <a href={href} className="tile" style={tile}>
      <strong style={{ fontSize: 20 }}>{title}</strong>
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{sub}</span>
    </a>
  );
  return (
    <div>
      <h1 style={{ margin: '8px 0 4px' }}>Web-CAB Trainer</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 16px' }}>開いたら即開始。1クリックで大量反復。</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {link('#/practice/arithmetic', '四則逆算', '50問/9分想定')}
        {link('#/practice/pattern', '法則性', '30問/12分想定')}
        {link('#/practice/commands', '命令表', '36問/15分想定')}
        {link('#/practice/cipher', '暗号', '30問/16分想定')}
        {link('#/mock', '総合模試', '本番形式・解説なし')}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <a href="#/stats">統計</a><a href="#/mistakes">復習</a><a href="#/settings">設定</a><a href="#/about">About</a>
      </div>
    </div>
  );
}

const tile: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 16px',
  border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', color: 'inherit',
  background: 'var(--card)',
};

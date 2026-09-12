// allow: SIZE_OK — lane H1 contract mandates one file exporting both the
// Settings page and the About page, including export/import/reset wiring.
import { useRef, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import { LiveRegion } from '../components/LiveRegion';
import { SUBJECTS } from '../domain/types';
import type { MockConfig, Settings as SettingsData, Subject } from '../domain/types';
import { exportData, importData } from '../features/exportImport';
import { paceSecPerQ } from '../stats/engine';
import { DEFAULT_SETTINGS, clearAll, loadPersisted, loadSettings, savePersisted, saveSettings } from '../storage/store';
import { SUBJECT_LABEL } from '../domain/labels';

const MOCK_QUESTIONS_MAX = 200;
const MOCK_MINUTES_MAX = 120;
const FONT_SCALE_MIN = 0.85;
const FONT_SCALE_MAX = 1.3;
const FONT_SCALE_STEP = 0.05;
const TIME_ATTACK_CHOICES: readonly number[] = [1, 3, 5, 10];

function cloneSettings(source: SettingsData): SettingsData {
  return {
    mock: {
      arithmetic: { ...source.mock.arithmetic },
      pattern: { ...source.mock.pattern },
      commands: { ...source.mock.commands },
      cipher: { ...source.mock.cipher },
    },
    timeAttackMin: [...source.timeAttackMin],
    speedTargetSec: source.speedTargetSec,
    fontScale: source.fontScale,
  };
}

function withMockConfig(preset: SettingsData['mock'], subject: Subject, config: MockConfig): SettingsData['mock'] {
  switch (subject) {
    case 'arithmetic':
      return { ...preset, arithmetic: config };
    case 'pattern':
      return { ...preset, pattern: config };
    case 'commands':
      return { ...preset, commands: config };
    case 'cipher':
      return { ...preset, cipher: config };
  }
}

function withMockField(config: MockConfig, field: 'questions' | 'minutes', value: number): MockConfig {
  return field === 'questions' ? { ...config, questions: value } : { ...config, minutes: value };
}

/** Comma-separated text -> positive numbers (deduped); empty/invalid -> defaults. */
function parseTimeAttackList(text: string): number[] {
  const out: number[] = [];
  for (const part of text.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const value = Number(trimmed);
    if (Number.isFinite(value) && value > 0 && !out.includes(value)) out.push(value);
  }
  return out.length > 0 ? out : [...DEFAULT_SETTINGS.timeAttackMin];
}

export function Settings(): JSX.Element {
  const [draft, setDraft] = useState<SettingsData>(loadSettings);
  const [timeText, setTimeText] = useState<string>(() => loadSettings().timeAttackMin.join(', '));
  const [status, setStatus] = useState<string>('');
  const [exportText, setExportText] = useState<string>('');
  const fileInput = useRef<HTMLInputElement | null>(null);

  const currentSettings = (): SettingsData => ({
    ...draft,
    timeAttackMin: parseTimeAttackList(timeText),
  });

  const selectedMinutes = parseTimeAttackList(timeText);

  function setMockField(subject: Subject, field: 'questions' | 'minutes', raw: string): void {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    setDraft((prev) => ({
      ...prev,
      mock: withMockConfig(prev.mock, subject, withMockField(prev.mock[subject], field, value)),
    }));
  }

  function toggleTimeAttack(minutes: number): void {
    const next = selectedMinutes.includes(minutes)
      ? selectedMinutes.filter((value) => value !== minutes)
      : [...selectedMinutes, minutes].sort((a, b) => a - b);
    setTimeText(next.join(', '));
  }

  function handleSave(): void {
    const next = currentSettings();
    setDraft(next);
    saveSettings(next);
    window.dispatchEvent(new CustomEvent('webcab:settings'));
    setStatus('設定を保存しました。');
  }

  function handleDefaults(): void {
    const fresh = cloneSettings(DEFAULT_SETTINGS);
    setDraft(fresh);
    setTimeText(fresh.timeAttackMin.join(', '));
    setStatus('初期値に戻しました。「保存」で反映されます。');
  }

  function handleExport(): void {
    try {
      const text = exportData(loadPersisted(), currentSettings());
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `webcab-trainer-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportText(text);
      setStatus('エクスポートファイルを書き出しました。');
    } catch {
      setStatus('エクスポートに失敗しました。');
    }
  }

  async function handleCopy(): Promise<void> {
    const text = exportData(loadPersisted(), currentSettings());
    setExportText(text);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('エクスポート内容をクリップボードにコピーしました。');
    } catch {
      setStatus('クリップボードにコピーできませんでした。下のテキストを選択してコピーしてください。');
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      setStatus('ファイルを読み込めませんでした。');
      return;
    }

    const result = importData(text);
    if (!result.ok) {
      setStatus(`読み込みに失敗しました: ${result.error}`);
      return;
    }

    const confirmed = window.confirm(
      '現在の回答データ・間違い・模試履歴・設定を、読み込んだ内容で置き換えます。よろしいですか？',
    );
    if (!confirmed) return;

    savePersisted(result.persisted);
    saveSettings(result.settings);

    setDraft(cloneSettings(result.settings));
    setTimeText(result.settings.timeAttackMin.join(', '));
    window.dispatchEvent(new CustomEvent('webcab:settings'));
    setStatus(`読み込みが完了しました（回答 ${result.persisted.attempts.length} 件）。`);
    if (fileInput.current !== null) fileInput.current.value = '';
  }

  function handleReset(): void {
    const confirmed = window.confirm(
      '回答履歴・間違い・模試履歴・設定をすべて削除します。この操作は元に戻せません。よろしいですか？',
    );
    if (!confirmed) return;
    clearAll();
    const fresh = cloneSettings(DEFAULT_SETTINGS);
    setDraft(fresh);
    setTimeText(fresh.timeAttackMin.join(', '));
    setExportText('');
    window.dispatchEvent(new CustomEvent('webcab:settings'));
    setStatus('すべてのデータをリセットしました。');
  }

  return (
    <div>
      <h1>設定</h1>

      <h2>模試プリセット</h2>
      <p className="meta">模試・時間制限モードの出題数と制限時間の目安です。</p>
      {SUBJECTS.map((subject) => {
        const config = draft.mock[subject];
        const pace = paceSecPerQ(draft.mock, subject);
        return (
          <fieldset
            key={subject}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <legend>{SUBJECT_LABEL[subject]}</legend>
            <label
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginRight: 'var(--space-4)' }}
            >
              問題数
              <input
                type="number"
                min={1}
                max={MOCK_QUESTIONS_MAX}
                value={config.questions}
                onChange={(event) => setMockField(subject, 'questions', event.target.value)}
                style={{ width: 88 }}
              />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              制限時間（分）
              <input
                type="number"
                min={1}
                max={MOCK_MINUTES_MAX}
                value={config.minutes}
                onChange={(event) => setMockField(subject, 'minutes', event.target.value)}
                style={{ width: 80 }}
              />
            </label>
            <span className="meta" style={{ marginLeft: 'var(--space-3)' }}>
              約 {pace.toFixed(1)} 秒/問
            </span>
          </fieldset>
        );
      })}

      <h2>練習の目標</h2>
      <div className="card">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <span id="time-attack-label" style={{ display: 'block', fontWeight: 600 }}>
            時間制限プリセット（分）
          </span>
          <div className="segmented" role="group" aria-labelledby="time-attack-label">
            {TIME_ATTACK_CHOICES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={selectedMinutes.includes(minutes)}
                onClick={() => toggleTimeAttack(minutes)}
              >
                {minutes}分
              </button>
            ))}
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <label htmlFor="time-attack-text">カンマ区切りで直接入力（例: 1, 3, 5）</label>
            <input
              id="time-attack-text"
              type="text"
              value={timeText}
              onChange={(event) => setTimeText(event.target.value)}
              style={{ display: 'block', width: '100%', maxWidth: 320 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="speed-target" style={{ display: 'block' }}>
              目標スピード（秒/問）
            </label>
            <input
              id="speed-target"
              type="number"
              min={1}
              max={60}
              value={draft.speedTargetSec}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value > 0) {
                  setDraft((prev) => ({ ...prev, speedTargetSec: value }));
                }
              }}
              style={{ width: 88 }}
            />
          </div>
          <div>
            <label htmlFor="font-scale" style={{ display: 'block' }}>
              文字サイズ（{Math.round(draft.fontScale * 100)}%）
            </label>
            <input
              id="font-scale"
              type="range"
              min={FONT_SCALE_MIN}
              max={FONT_SCALE_MAX}
              step={FONT_SCALE_STEP}
              value={draft.fontScale}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, fontScale: Number(event.target.value) }))
              }
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            保存
          </button>
          <button type="button" className="btn" onClick={handleDefaults}>
            初期値に戻す
          </button>
        </div>
      </div>

      <h2>データのエクスポート / インポート</h2>
      <p className="meta">
        学習データと設定をJSONファイルに書き出したり、別の端末から読み込めます。データはこの端末のlocalStorageにのみ保存されます。
      </p>
      <div className="card">
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
          <button type="button" className="btn btn--primary" onClick={handleExport}>
            JSONファイルに書き出す
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void handleCopy();
            }}
          >
            クリップボードにコピー
          </button>
        </div>
        <div>
          <label htmlFor="import-file">エクスポートファイル（JSON）を読み込む</label>
          <input
            id="import-file"
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void handleFile(event);
            }}
            style={{ display: 'block', marginTop: 'var(--space-1)' }}
          />
        </div>
        {exportText !== '' && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <label htmlFor="export-text">書き出しテキスト（手動コピー用）</label>
            <textarea
              id="export-text"
              readOnly
              rows={6}
              value={exportText}
              style={{ display: 'block', width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
            />
          </div>
        )}
      </div>

      <h2>データのリセット</h2>
      <p className="meta">回答履歴・間違い・模試履歴・設定を削除して初期状態に戻します。</p>
      <button type="button" className="btn" onClick={handleReset}>
        データをリセット
      </button>

      <LiveRegion message={status} />
      {status !== '' && <p className="meta">{status}</p>}
    </div>
  );
}

export function About(): JSX.Element {
  return (
    <div>
      <h1>このアプリについて</h1>
      <div className="card">
        <p>
          <strong>Web-CAB Trainerは非公式の独立練習ツールです。</strong>
          Web-CAB形式の能力検査対策として、四則逆算・法則性・命令表・暗号のオリジナル問題を自動生成し、繰り返し練習できます。
        </p>
        <ul>
          <li>試験を実施する機関・企業とは一切関係のない、個人による非公式ツールです（非提携）。</li>
          <li>
            実際の試験問題・画像・文章・UIは収録も複製もしていません。出題される問題は、すべてアプリ内のルールから生成されるオリジナルです。
          </li>
          <li>
            ログイン・広告・バックエンドは不要です。学習データはお使いのブラウザのlocalStorageにのみ保存され、外部に送信されません。
          </li>
          <li>表示されるペース比較は練習の目安です。合否判定や合格率の表示は行いません。</li>
          <li>
            ブラウザのデータ削除やシークレットモードの終了でデータが消える場合があります。必要に応じて設定画面からエクスポートしてください。
          </li>
        </ul>
        <p className="meta" style={{ marginBottom: 0 }}>
          問題生成にはseed付き乱数を使っているため、同じseedからは同じ問題が再現されます。
        </p>
      </div>
      <p style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
        <a className="btn" href="#/settings">
          設定へ
        </a>
        <a className="btn" href="#/">
          トップへ
        </a>
      </p>
    </div>
  );
}

import { Component } from 'react';
import type { ErrorInfo, JSX, ReactNode } from 'react';

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  /** Problem seed currently on screen; included in the report text when known. */
  readonly seed?: number;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Catches render-time errors and shows a Japanese fallback panel instead of a
 * blank screen. The panel reports `location.hash` and the optional `seed` so a
 * screenshot is enough to reproduce the failing problem.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack, window.location.hash);
  }

  render(): JSX.Element {
    const { error } = this.state;
    if (!error) return <>{this.props.children}</>;

    const hash = window.location.hash || '#/';
    const { seed } = this.props;

    return (
      <div className="error-panel" role="alert">
        <h2>エラーが発生しました</h2>
        <p>
          予期しないエラーにより画面を表示できませんでした。読み込み直すか、下の情報を添えて報告してください。
        </p>
        <dl className="error-panel__details">
          <dt>画面</dt>
          <dd>{hash}</dd>
          {seed !== undefined && (
            <>
              <dt>seed</dt>
              <dd>{seed}</dd>
            </>
          )}
          <dt>内容</dt>
          <dd>{error.message || String(error)}</dd>
        </dl>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => window.location.reload()}
        >
          再読み込み
        </button>
      </div>
    );
  }
}

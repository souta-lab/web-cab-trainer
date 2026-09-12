import { useState } from 'react';
import type { JSX } from 'react';

export interface LiveRegionProps {
  /** Text to announce. Empty string renders an empty (silent) region. */
  readonly message: string;
  /** Use `assertive` for time-critical or error messages; polite by default. */
  readonly assertive?: boolean;
}

/**
 * Invisible variation that makes two identical consecutive messages distinct
 * to assistive tech (zero-width space renders as nothing on screen).
 */
const ZERO_WIDTH_SPACE = '\u200B';

/**
 * Visually hidden `aria-live` region that is mounted once and never remounted.
 *
 * Screen readers announce a live region when its DOM text changes, so the text
 * node is updated in place. Two identical consecutive messages alternate a
 * trailing zero-width space, which re-announces the same string without
 * replacing the live region node.
 */
export function LiveRegion({ message, assertive = false }: LiveRegionProps): JSX.Element {
  const [entry, setEntry] = useState<{ raw: string; text: string; parity: number }>({
    raw: message,
    text: message,
    parity: 0,
  });

  // Derive from props during render (React's official pattern): a new message
  // value is written into the same always-mounted node.
  if (entry.raw !== message) {
    const parity = entry.parity + 1;
    const variation = parity % 2 === 0 ? ZERO_WIDTH_SPACE : '';
    setEntry({ raw: message, text: message === '' ? '' : `${message}${variation}`, parity });
  }

  return (
    <span
      className="visually-hidden"
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {entry.text}
    </span>
  );
}

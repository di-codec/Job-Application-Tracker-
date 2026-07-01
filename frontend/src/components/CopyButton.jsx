import { useEffect, useState } from 'react';
import { copyToClipboard } from '../utils/copyToClipboard.js';

export default function CopyButton({ getText, disabled = false, label = 'Copy' }) {
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (status === 'idle') return undefined;

    const timer = window.setTimeout(() => setStatus('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function handleClick() {
    const text = typeof getText === 'function' ? getText() : '';
    const copied = await copyToClipboard(text);
    setStatus(copied ? 'copied' : 'error');
  }

  const buttonLabel =
    status === 'copied' ? 'Copied' : status === 'error' ? 'Copy failed' : label;

  return (
    <button
      type="button"
      className={`search-panel__copy-btn${
        status === 'copied' ? ' search-panel__copy-btn--copied' : ''
      }`}
      onClick={handleClick}
      disabled={disabled || status === 'copied'}
      aria-label={label}
    >
      {buttonLabel}
    </button>
  );
}

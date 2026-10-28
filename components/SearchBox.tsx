'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { search, type SearchResult } from '@/lib/search';
import type { LngLat } from '@/lib/geo';
import { LocateIcon, PinIcon, SearchIcon, CloseIcon } from './icons';

export type Extra = { id: string; label: string; icon?: ReactNode; onSelect: () => void };

type Props = {
  value: string;
  placeholder: string;
  near: () => LngLat;
  onSelect: (r: SearchResult) => void;
  onClear?: () => void;
  extras?: Extra[];
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  autoFocus?: boolean;
};

export default function SearchBox({ value, placeholder, near, onSelect, onClear, extras = [], leading, trailing, className = '', autoFocus }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  // Debounced search; each new keystroke cancels the request before it.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2 || q === value) {
      setResults([]);
      setError('');
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await search(q, near(), ctrl.signal));
        setError('');
      } catch (e) {
        if (!ctrl.signal.aborted) setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, open, value, near]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const showExtras = query.trim() === '' || query === value;
  const items: (Extra | SearchResult)[] = showExtras ? extras : results;

  function choose(item: Extra | SearchResult) {
    setOpen(false);
    setActive(-1);
    if ('onSelect' in item) item.onSelect();
    else {
      setQuery(item.name);
      onSelect(item);
    }
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <div ref={root} className={`searchbox ${open ? 'is-open' : ''} ${className}`}>
      <div className="searchbox-field">
        {leading ?? <SearchIcon className="searchbox-icon" />}
        <input
          value={query}
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck={false}
          onFocus={(e) => { setOpen(true); e.target.select(); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && items.length) { e.preventDefault(); choose(items[Math.max(active, 0)]); }
            else if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); }
          }}
          aria-label={placeholder}
        />
        {loading && <span className="spinner" aria-label="Searching" />}
        {query && onClear && !loading && (
          <button className="icon-btn ghost" aria-label="Clear" onClick={() => { setQuery(''); onClear(); }}>
            <CloseIcon width={16} height={16} />
          </button>
        )}
        {trailing}
      </div>

      {open && (items.length > 0 || error || (!showExtras && !loading && query.trim().length >= 2)) && (
        <ul className="results" role="listbox">
          {error && <li className="results-note">{error}</li>}
          {!error && items.length === 0 && <li className="results-note">No places found in Cambodia</li>}
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                className={`result ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
              >
                <span className="result-icon">
                  {'onSelect' in item ? item.icon ?? <LocateIcon width={16} height={16} /> : <PinIcon width={16} height={16} />}
                </span>
                <span className="result-text">
                  <span className="result-name">{'onSelect' in item ? item.label : item.name}</span>
                  {!('onSelect' in item) && (item.category || item.detail) && (
                    <span className="result-detail">{[item.category, item.detail].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

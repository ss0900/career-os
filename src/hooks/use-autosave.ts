import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { jobError } from './use-job-action';

export function useAutosave<T, R extends { id: string; revision: number; content: T }>(
  initial: R,
  save: (id: string, content: T, revision: number) => Promise<R>,
) {
  const [content, setContent] = useState(initial.content);
  const [status, setStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [error, setError] = useState('');
  const persisted = useRef(initial);
  const latest = useRef(initial.content);
  const running = useRef<Promise<R> | null>(null);
  const accept = useCallback((row: R) => {
    persisted.current = row;
    latest.current = row.content;
    setContent(row.content);
    setStatus('saved');
    setError('');
  }, []);
  const change = useCallback((next: T | ((current: T) => T)) => {
    const value = typeof next === 'function' ? (next as (c: T) => T)(latest.current) : next;
    latest.current = value;
    setContent(value);
    setStatus('pending');
  }, []);
  const flush = useCallback(
    async function persist(): Promise<R> {
      if (running.current) {
        await running.current;
        return persist();
      }
      if (JSON.stringify(latest.current) === JSON.stringify(persisted.current.content)) {
        setStatus('saved');
        return persisted.current;
      }
      const snapshot = structuredClone(latest.current);
      setStatus('saving');
      setError('');
      const task = save(initial.id, snapshot, persisted.current.revision)
        .then((row) => {
          persisted.current = row;
          setStatus(
            JSON.stringify(latest.current) === JSON.stringify(snapshot) ? 'saved' : 'pending',
          );
          return row;
        })
        .catch((cause: unknown) => {
          setError(jobError(cause));
          setStatus('error');
          throw cause;
        })
        .finally(() => {
          running.current = null;
        });
      running.current = task;
      await task;
      return persist();
    },
    [initial.id, save],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [content, flush]);
  useEffect(() => {
    if (status === 'saved') return;
    const protect = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [status]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      status !== 'saved' && currentLocation.pathname !== nextLocation.pathname,
  );
  return { content, status, error, change, flush, accept, blocker };
}

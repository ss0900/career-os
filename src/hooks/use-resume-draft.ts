import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { resumeRepository } from '../data/resume-repository';
import type { Resume, ResumeDocument } from '../data/resume-schema';
import { errorMessage } from '../lib/utils';

export function useResumeDraft(initial: Resume) {
  const [document, setDocument] = useState(initial.content);
  const [status, setStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [error, setError] = useState('');
  const persisted = useRef(initial);
  const latest = useRef(initial.content);
  const running = useRef<Promise<Resume> | null>(null);
  const flush = useCallback(
    async function saveLatest(): Promise<Resume> {
      if (running.current) {
        await running.current;
        return saveLatest();
      }
      if (JSON.stringify(latest.current) === JSON.stringify(persisted.current.content)) {
        setStatus('saved');
        setError('');
        return persisted.current;
      }
      const snapshot = structuredClone(latest.current);
      setStatus('saving');
      setError('');
      const task = resumeRepository
        .save(initial.id, snapshot, persisted.current.revision)
        .then((saved) => {
          persisted.current = saved;
          setStatus(
            JSON.stringify(latest.current) === JSON.stringify(snapshot) ? 'saved' : 'pending',
          );
          return saved;
        })
        .catch((cause: unknown) => {
          setError(errorMessage(cause));
          setStatus('error');
          throw cause;
        })
        .finally(() => {
          running.current = null;
        });
      running.current = task;
      await task;
      return saveLatest();
    },
    [initial.id],
  );
  const change = (next: ResumeDocument) => {
    latest.current = next;
    setDocument(next);
    setStatus('pending');
    setError('');
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 550);
    return () => clearTimeout(timer);
  }, [document, flush]);
  useEffect(() => {
    if (status === 'saved') return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [status]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      status !== 'saved' && currentLocation.pathname !== nextLocation.pathname,
  );
  return { document, status, error, change, flush, blocker };
}

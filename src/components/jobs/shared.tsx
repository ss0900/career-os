import { useEffect, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { jobError } from '../../hooks/use-job-action';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { RequiredMark } from '../ui/field';
import './jobs.css';

export function Choice({
  label,
  value,
  onChange,
  children,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <RequiredMark />}
      </span>
      <select
        className="input"
        aria-label={label}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
export function DataDialog<T>({
  title,
  description = '빨간 * 표시는 필수 항목입니다.',
  initial,
  onSave,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  initial: T;
  onSave: (value: T) => Promise<unknown>;
  onClose: () => void;
  children: (value: T, change: (value: T) => void) => ReactNode;
}) {
  const [value, setValue] = useState(initial);
  const [original] = useState(initial);
  // Keep the opening revision and input together so another tab cannot be overwritten.
  const [save] = useState(() => onSave);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(value) !== JSON.stringify(original);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !busy && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('저장하지 않은 변경사항을 버리고 이동할까요?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  const close = () => {
    if (!busy && (!dirty || window.confirm('저장하지 않은 변경사항을 버릴까요?'))) onClose();
  };
  return (
    <Dialog wide title={title} description={description} onClose={close} canClose={!busy}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          void save(value)
            .then(onClose)
            .catch((cause) => {
              setError(jobError(cause));
              setBusy(false);
            });
        }}
      >
        <fieldset disabled={busy} className="form-content">
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          {children(value, setValue)}
        </fieldset>
        <div className="dialog-footer">
          <span className="save-note">{dirty ? '저장하지 않은 변경사항' : '저장된 내용'}</span>
          <Button variant="outline" disabled={busy} onClick={close}>
            취소
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

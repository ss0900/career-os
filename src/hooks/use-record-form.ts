import { useEffect, useState, type FormEvent } from 'react';
import type { z } from 'zod';
import { errorMessage } from '../lib/utils';

export function useRecordForm<T>(
  schema: z.ZodType<T>,
  onSave: (value: T) => Promise<unknown>,
  onClose: () => void,
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function close() {
    if (!busy && (!dirty || window.confirm('저장하지 않은 변경사항을 닫을까요?'))) onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>, read: (form: FormData) => unknown) {
    event.preventDefault();
    if (busy) return;
    const result = schema.safeParse(read(new FormData(event.currentTarget)));
    setError('');
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) nextErrors[String(issue.path[0])] ??= issue.message;
      setErrors(nextErrors);
      setError('입력 내용을 확인해 주세요.');
      const fieldName = String(result.error.issues[0]?.path[0]);
      const field = event.currentTarget.elements.namedItem(fieldName);
      if (field instanceof HTMLElement) {
        field.closest('details')?.setAttribute('open', '');
        field.focus();
      }
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSave(result.data);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  return { errors, error, busy, close, submit, markDirty: () => setDirty(true) };
}

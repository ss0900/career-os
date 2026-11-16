import { useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '../lib/utils';
import { useNotice } from './app-context';
export function jobError(cause: unknown) {
  return cause instanceof z.ZodError
    ? cause.issues.map((i) => i.message).join(' · ')
    : errorMessage(cause);
}
export function useJobAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const notice = useNotice();
  async function run(action: () => Promise<unknown>, message = '저장했습니다.') {
    setBusy(true);
    setError('');
    try {
      await action();
      notice(message);
    } catch (cause) {
      setError(jobError(cause));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

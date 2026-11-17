import type { Blocker } from 'react-router-dom';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import '../jobs/jobs.css';
import './interview.css';

export function SaveState({
  status,
  error,
  flush,
}: {
  status: string;
  error: string;
  flush: () => Promise<unknown>;
}) {
  return (
    <div className="save-state">
      <span role="status">
        {status === 'saved'
          ? '저장 완료'
          : status === 'saving'
            ? '저장 중…'
            : status === 'error'
              ? '저장 실패 · 입력 유지'
              : '저장 대기'}
      </span>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {status !== 'saved' && (
        <Button variant="outline" onClick={() => void flush().catch(() => undefined)}>
          지금 저장
        </Button>
      )}
    </div>
  );
}
export function SaveGuard({ blocker, flush }: { blocker: Blocker; flush: () => Promise<unknown> }) {
  return blocker.state === 'blocked' ? (
    <Dialog
      title="저장하지 않은 변경사항"
      description="저장 후 이동하거나 현재 화면에서 입력을 계속할 수 있습니다."
      onClose={() => blocker.reset()}
    >
      <div className="jobs-actions">
        <Button
          onClick={() =>
            void flush()
              .then(() => blocker.proceed())
              .catch(() => blocker.reset())
          }
        >
          저장 후 이동
        </Button>
        <Button variant="outline" onClick={() => blocker.reset()}>
          계속 작성
        </Button>
        <Button variant="ghost" onClick={() => blocker.proceed()}>
          변경 버리고 이동
        </Button>
      </div>
    </Dialog>
  ) : null;
}

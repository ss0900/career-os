import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { Component, useCallback, useState, type ReactNode } from 'react';
import { repository } from '../data/repository';
import { DataContext, NoticeContext } from '../hooks/app-context';
import { errorMessage } from '../lib/utils';
import { Button } from './ui/button';

export function DataProvider({ children }: { children: ReactNode }) {
  const result = useLiveQuery(async () => {
    try {
      return { data: await repository.readAll(), error: null };
    } catch (cause) {
      return { data: null, error: errorMessage(cause) };
    }
  }, []);
  if (!result)
    return (
      <div className="loading-state" role="status">
        <LoaderCircle className="spin" />
        <p>기록을 불러오는 중입니다.</p>
      </div>
    );
  if (result.error || !result.data)
    return (
      <div className="panel error-state" role="alert">
        <h1>기록을 불러오지 못했어요</h1>
        <p>{result.error}</p>
        <Button onClick={() => window.location.reload()}>다시 시도</Button>
      </div>
    );
  return <DataContext.Provider value={result.data}>{children}</DataContext.Provider>;
}

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<{ id: string; text: string }[]>([]);
  const notify = useCallback((text: string) => {
    const id = crypto.randomUUID();
    setNotices((current) => [...current.slice(-2), { id, text }]);
    setTimeout(() => setNotices((current) => current.filter((notice) => notice.id !== id)), 6000);
  }, []);
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {notices.map((notice) => (
          <div className="toast" key={notice.id}>
            <CheckCircle2 size={18} />
            <span>{notice.text}</span>
            <button
              aria-label="알림 닫기"
              onClick={() =>
                setNotices((current) => current.filter((item) => item.id !== notice.id))
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="error-state">
          <h1>화면을 표시하지 못했어요</h1>
          <p>저장된 기록은 삭제되지 않았습니다. 페이지를 다시 열어 주세요.</p>
          <Button onClick={() => window.location.reload()}>새로고침</Button>
        </main>
      );
    return this.props.children;
  }
}

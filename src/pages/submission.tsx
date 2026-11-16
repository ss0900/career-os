import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../hooks/app-context';
import { ResumePreview } from '../components/resume/preview';
import { Button } from '../components/ui/button';

export function SubmissionPage() {
  const { id, submissionId } = useParams();
  const { applications } = useAppData();
  const app = applications.find((a) => a.id === id);
  const submission = app?.submissions.find((s) => s.id === submissionId);
  const [ready, setReady] = useState('');
  const onLayout = useCallback((key: string) => setReady(key), []);
  if (!app || !submission?.version)
    return (
      <div className="panel jobs-section">
        <h1>등록된 제출 문서가 없습니다.</h1>
        <Link to="/applications">지원 현황으로</Link>
      </div>
    );
  const content = submission.version.content;
  return (
    <div className="resume-studio">
      <div className="studio-heading">
        <div>
          <Link to={`/applications/${app.id}`}>← 지원 기록</Link>
          <h1>{app.job.company} 제출 증빙</h1>
          <p>
            {submission.date} · {submission.method} · V{submission.version.number} · 읽기 전용
          </p>
        </div>
      </div>
      <div className="studio-toolbar">
        <Button
          disabled={ready !== JSON.stringify(content)}
          onClick={() => {
            const previous = document.title;
            document.title = `${app.job.company} 제출본`;
            try {
              window.print();
            } finally {
              document.title = previous;
            }
          }}
        >
          인쇄 / PDF 저장
        </Button>
      </div>
      <section className="resume-preview-panel">
        <div
          className="preview-scroll"
          tabIndex={0}
          role="region"
          aria-label="보관 제출본 미리보기"
        >
          <ResumePreview
            document={content}
            zoom={window.matchMedia('(max-width: 700px)').matches ? 0.4 : 0.8}
            onLayout={onLayout}
          />
        </div>
        <p className="print-help">A4 · 배율 100% · 여백 없음 · 머리글/바닥글 끄기</p>
      </section>
    </div>
  );
}

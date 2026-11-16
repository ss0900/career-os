import { Copy, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, PageHeading } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/dialog';
import { resumeRepository } from '../data/resume-repository';
import type { Resume } from '../data/resume-schema';
import { useAppData, useNotice } from '../hooks/app-context';
import { dateLabel, errorMessage } from '../lib/utils';

export function ResumesPage() {
  const { resumes, resumeVersions } = useAppData();
  const navigate = useNavigate();
  const notice = useNotice();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Resume | null>(null);
  const [query, setQuery] = useState('');
  async function create(copy?: Resume) {
    setBusy(true);
    setError('');
    try {
      const result = await resumeRepository.create(
        copy
          ? {
              ...structuredClone(copy.content),
              title: `${copy.content.title} (복사)`.slice(0, 300),
            }
          : undefined,
      );
      navigate(`/resumes/${result.id}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  const filtered = resumes.filter((item) =>
    `${item.content.title} ${item.content.company} ${item.content.role}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="RESUME STUDIO"
        title="이력서 작성"
        description="나의 경험을 지원하는 기회에 맞춰 정리하세요."
        action={
          <Button disabled={busy} onClick={() => void create()}>
            <Plus size={17} />새 이력서 만들기
          </Button>
        }
      />
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="project-toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="이력서 검색"
            placeholder="제목, 기업, 지원 직무 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="result-count">총 {filtered.length}개</span>
      </div>
      {filtered.length ? (
        <div className="project-grid">
          {filtered.map((item) => {
            const versions = resumeVersions.filter((version) => version.resumeId === item.id);
            return (
              <article className="panel project-card" key={item.id}>
                <div className="project-card-top">
                  <span className="project-symbol">
                    <FileText size={23} />
                  </span>
                  <span className="badge">편집 가능한 초안</span>
                </div>
                <p className="project-company">{item.content.company || '지원 기업 미입력'}</p>
                <h2>
                  <Link to={`/resumes/${item.id}`}>{item.content.title || '제목 없는 이력서'}</Link>
                </h2>
                <p className="project-summary">{item.content.role || '지원 직무 미입력'}</p>
                <p className="muted">
                  저장 버전 {versions.length}개 · 제출본{' '}
                  {versions.filter((version) => version.kind === 'submitted').length}개
                </p>
                <p className="muted">최근 수정 · {dateLabel(item.updatedAt)}</p>
                <div className="project-card-footer">
                  <Link className="text-link" to={`/resumes/${item.id}`}>
                    이어서 작성
                  </Link>
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={`${item.content.title} 복제`}
                      onClick={() => void create(item)}
                    >
                      <Copy size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${item.content.title} 삭제`}
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            icon={FileText}
            title={resumes.length ? '검색 결과가 없어요' : '첫 이력서를 만들어 보세요'}
            description="등록한 프로필, 경력, 프로젝트가 독립된 초안으로 복사됩니다. 원본은 그대로 유지됩니다."
            action={
              <Button disabled={busy} onClick={() => void create()}>
                새 이력서 만들기
              </Button>
            }
          />
        </section>
      )}
      {deleting && (
        <ConfirmDialog
          title="이력서를 삭제할까요?"
          description={`‘${deleting.content.title}’ 초안과 연결된 저장 버전·제출본 ${resumeVersions.filter((version) => version.resumeId === deleting.id).length}개가 함께 삭제됩니다. 지원 기록에 이미 보관한 제출 증빙과 원본 경력·프로젝트는 유지됩니다. 필요한 경우 먼저 백업하세요.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await resumeRepository.delete(deleting.id);
            notice('이력서와 보관 버전을 삭제했습니다.');
          }}
        />
      )}
    </>
  );
}

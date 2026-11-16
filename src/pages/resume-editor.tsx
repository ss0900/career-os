import { ArrowLeft, Copy, FileCheck2, History, Printer, Save } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/dialog';
import { EditorFields } from '../components/resume/editor-fields';
import { ResumeInput } from '../components/resume/inputs';
import { ResumePreview } from '../components/resume/preview';
import {
  checkResume,
  compareDocuments,
  createDocument,
  latestSourceDocument,
} from '../data/resume';
import { resumeRepository } from '../data/resume-repository';
import type { Resume, ResumeVersion } from '../data/resume-schema';
import { useAppData, useNotice } from '../hooks/app-context';
import { useResumeDraft } from '../hooks/use-resume-draft';
import { dateLabel, errorMessage } from '../lib/utils';

function ResumeEditor({ initial }: { initial: Resume }) {
  const sources = useAppData();
  const notice = useNotice();
  const navigate = useNavigate();
  const draft = useResumeDraft(initial);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [zoom, setZoom] = useState(() =>
    window.matchMedia('(max-width: 700px)').matches ? 0.4 : 0.65,
  );
  const [readyKey, setReadyKey] = useState('');
  const onLayout = useCallback((key: string) => setReadyKey(key), []);
  const [selectedId, setSelectedId] = useState('');
  const [compareTo, setCompareTo] = useState('draft');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'submit' | 'refresh' | null>(null);
  const versions = sources.resumeVersions
    .filter((version) => version.resumeId === initial.id)
    .sort((a, b) => b.number - a.number);
  const selected = versions.find((version) => version.id === selectedId);
  const document = selected?.content ?? draft.document;
  const issues = checkResume(document);
  const errors = issues.filter((item) => item.level === 'error');
  const comparison = selected
    ? compareTo === 'source'
      ? latestSourceDocument(selected.content, sources)
      : (versions.find((version) => version.id === compareTo)?.content ?? draft.document)
    : null;
  const differences = selected && comparison ? compareDocuments(selected.content, comparison) : [];
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function saveVersion(kind: ResumeVersion['kind']) {
    const current = await draft.flush();
    const version = await resumeRepository.saveVersion(initial.id, kind, label, current.revision);
    setSelectedId(version.id);
    setLabel('');
    notice(
      kind === 'submitted'
        ? '제출본을 변경 불가능한 스냅샷으로 보관했습니다.'
        : '현재 초안을 새 버전으로 보관했습니다.',
    );
  }
  async function print() {
    if (!selected) await draft.flush();
    await window.document.fonts.ready;
    if (readyKey !== JSON.stringify(document))
      throw new Error('페이지 계산이 끝난 뒤 다시 인쇄해 주세요.');
    const previous = window.document.title;
    window.document.title = document.title || '이력서';
    try {
      window.print();
    } finally {
      window.document.title = previous;
    }
  }
  return (
    <div className={`resume-studio mobile-${mobileView}`}>
      <div className="studio-heading">
        <div>
          <Link className="text-link" to="/resumes">
            <ArrowLeft size={14} />
            이력서 목록
          </Link>
          <h1>{draft.document.title || '제목 없는 이력서'}</h1>
          <p className="muted">원본과 분리된 나만의 제출 문서</p>
        </div>
        <span className={`save-status status-${draft.status}`} role="status">
          {
            {
              saved: '저장 완료',
              pending: '저장 대기 중…',
              saving: '저장 중…',
              error: '저장 실패 · 내용은 편집기에 유지됩니다',
            }[draft.status]
          }
        </span>
      </div>
      {(error || draft.error) && (
        <div className="alert error" role="alert">
          <p>{error || draft.error}</p>
          {draft.error && (
            <Button size="sm" variant="outline" onClick={() => void perform(draft.flush)}>
              저장 다시 시도
            </Button>
          )}
        </div>
      )}
      <div className="studio-toolbar">
        <div className="mobile-view-switch" aria-label="이력서 화면 전환">
          <Button
            variant={mobileView === 'edit' ? 'default' : 'outline'}
            aria-pressed={mobileView === 'edit'}
            onClick={() => setMobileView('edit')}
          >
            편집
          </Button>
          <Button
            variant={mobileView === 'preview' ? 'default' : 'outline'}
            aria-pressed={mobileView === 'preview'}
            onClick={() => setMobileView('preview')}
          >
            미리보기
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => void perform(draft.flush)}
          disabled={busy || !!selected}
        >
          <Save size={15} />
          지금 저장
        </Button>
        <Button
          onClick={() => void perform(print)}
          disabled={busy || readyKey !== JSON.stringify(document)}
        >
          <Printer size={15} />
          인쇄 / PDF 저장
        </Button>
      </div>
      <div className="resume-workspace">
        <aside className="resume-edit-panel">
          <section className="panel resume-version-panel">
            <div className="section-heading">
              <h2>
                <History size={16} />
                버전 및 제출본
              </h2>
              <span className="badge">{versions.length}개</span>
            </div>
            <div className="version-controls">
              <ResumeInput label="버전 메모" value={label} onChange={setLabel} maxLength={300} />
              <div className="version-actions">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !!selected}
                  onClick={() => void perform(() => saveVersion('saved'))}
                >
                  버전 저장
                </Button>
                <Button
                  size="sm"
                  disabled={
                    busy ||
                    !!selected ||
                    checkResume(draft.document).some((issue) => issue.level === 'error')
                  }
                  onClick={() => setConfirm('submit')}
                >
                  <FileCheck2 size={14} />
                  제출본 확정
                </Button>
              </div>
              <p className="field-hint">
                오류를 해결하면 제출본을 확정할 수 있습니다. 저장 버전과 제출본은 이후 수정되지
                않습니다.
              </p>
              <label className="field">
                보기
                <select
                  aria-label="이력서 버전 보기"
                  className="input"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="">현재 초안 · 편집 가능</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      V{version.number} · {version.kind === 'submitted' ? '제출본' : '저장 버전'} ·{' '}
                      {version.label || dateLabel(version.createdAt)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          {selected ? (
            <section className="panel resume-comparison">
              <div className="section-heading">
                <h2>V{selected.number} · 읽기 전용</h2>
              </div>
              <div className="comparison-content">
                <p className="muted">
                  보관일 · {new Date(selected.createdAt).toLocaleString('ko-KR')}
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await draft.flush();
                      const next = await resumeRepository.create({
                        ...structuredClone(selected.content),
                        title: `${selected.content.title} · V${selected.number} 복사`.slice(0, 300),
                      });
                      navigate(`/resumes/${next.id}`);
                    })
                  }
                >
                  <Copy size={15} />이 버전으로 새 초안
                </Button>
                <label className="field">
                  비교 대상
                  <select
                    aria-label="비교 대상"
                    className="input"
                    value={compareTo}
                    onChange={(event) => setCompareTo(event.target.value)}
                  >
                    <option value="draft">현재 초안</option>
                    <option value="source">최신 원본 데이터</option>
                    {versions
                      .filter((version) => version.id !== selected.id)
                      .map((version) => (
                        <option key={version.id} value={version.id}>
                          V{version.number} ·{' '}
                          {version.kind === 'submitted' ? '제출본' : '저장 버전'}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="field-hint">
                  최신 원본 비교는 프로필과 가져온 경력·프로젝트만 비교합니다. 맞춤 문구와 원본의
                  차이도 표시되며 어느 데이터도 변경하지 않습니다.
                </p>
                <p className="muted">{differences.length}개 항목 차이</p>
                {differences.map((item) => (
                  <details className="comparison-row" key={item.path}>
                    <summary>{item.path}</summary>
                    <dl>
                      <dt>V{selected.number}</dt>
                      <dd>{item.before || '(없음)'}</dd>
                      <dt>비교 대상</dt>
                      <dd>{item.after || '(없음)'}</dd>
                    </dl>
                  </details>
                ))}
                <Button onClick={() => setSelectedId('')}>초안으로 돌아가기</Button>
              </div>
            </section>
          ) : (
            <EditorFields
              document={draft.document}
              change={draft.change}
              sources={sources}
              refresh={() => setConfirm('refresh')}
            />
          )}
          <section className="panel quality-panel">
            <div className="section-heading">
              <h2>작성 점검</h2>
              <span className="badge">
                오류 {errors.length} · 권장 {issues.length - errors.length}
              </span>
            </div>
            <p className="field-hint">
              입력 및 표시된 항목을 규칙으로 점검합니다. 사실이나 역량을 검증하는 점수가 아닙니다.
            </p>
            {issues.length ? (
              <ul>
                {issues.map((issue, index) => (
                  <li className={`quality-${issue.level}`} key={index}>
                    <strong>{issue.level === 'error' ? '오류' : '권장'}</strong> {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                입력 형식 점검을 통과했습니다. 제출 전 사실과 공개 범위를 직접 확인해 주세요.
              </p>
            )}
          </section>
        </aside>
        <section className="resume-preview-panel">
          <div className="preview-toolbar">
            <div>
              <strong>
                {selected
                  ? `V${selected.number} ${selected.kind === 'submitted' ? '제출본' : '저장 버전'}`
                  : '실시간 A4 미리보기'}
              </strong>
              <p>{selected ? '보관된 내용 그대로 표시합니다.' : '편집 내용이 즉시 반영됩니다.'}</p>
            </div>
            <label>
              확대
              <select
                aria-label="미리보기 확대"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              >
                <option value={0.4}>40%</option>
                <option value={0.5}>50%</option>
                <option value={0.65}>65%</option>
                <option value={0.8}>80%</option>
                <option value={1}>100%</option>
              </select>
            </label>
          </div>
          <div
            className="preview-scroll"
            tabIndex={0}
            role="region"
            aria-label="A4 이력서 미리보기"
          >
            <ResumePreview document={document} zoom={zoom} onLayout={onLayout} />
          </div>
          <p className="print-help">
            인쇄 설정: A4 · 배율 100% · 여백 없음 · 머리글/바닥글 끄기. PDF 저장은 인쇄 창에서
            선택하세요.
          </p>
        </section>
      </div>
      {confirm === 'submit' && (
        <ConfirmDialog
          title="현재 초안을 제출본으로 확정할까요?"
          description="현재 내용을 변경할 수 없는 스냅샷으로 보관합니다. 이 버튼은 기업에 전송하지 않습니다. 수정이 필요하면 새 버전 또는 새 초안을 만드세요."
          confirmLabel="제출본으로 보관"
          onClose={() => setConfirm(null)}
          onConfirm={() => saveVersion('submitted')}
        />
      )}
      {confirm === 'refresh' && (
        <ConfirmDialog
          title="맞춤 문구를 원본으로 교체할까요?"
          description="초안의 프로필·경력·프로젝트 문구와 선택·순서를 최신 원본 전체로 교체합니다. 먼저 버전을 저장하면 이전 문구를 보관할 수 있습니다. 학력·자격증·외국어와 기존 버전은 유지됩니다."
          confirmLabel="원본으로 교체"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const current = createDocument(sources);
            draft.change({
              ...draft.document,
              profile: current.profile,
              careers: current.careers,
              projects: current.projects,
            });
            await draft.flush();
          }}
        />
      )}
      {draft.blocker.state === 'blocked' && (
        <ConfirmDialog
          title="저장한 뒤 이동할까요?"
          description="아직 저장되지 않은 변경사항이 있습니다. 저장에 실패하면 현재 화면과 입력 내용을 유지합니다."
          confirmLabel="저장 후 이동"
          onClose={() => draft.blocker.reset?.()}
          onConfirm={async () => {
            await draft.flush();
            draft.blocker.proceed?.();
          }}
        />
      )}
    </div>
  );
}

export function ResumeEditorPage() {
  const { id } = useParams();
  const { resumes } = useAppData();
  const resume = resumes.find((item) => item.id === id);
  if (!resume)
    return (
      <section className="panel error-state">
        <h1>이력서를 찾을 수 없어요</h1>
        <p>삭제되었거나 다른 백업으로 교체되었을 수 있습니다.</p>
        <Button asChild>
          <Link to="/resumes">이력서 목록으로</Link>
        </Button>
      </section>
    );
  return <ResumeEditor key={resume.id} initial={resume} />;
}

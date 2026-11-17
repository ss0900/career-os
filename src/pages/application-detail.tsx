import { useJobAction } from '../hooks/use-job-action';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../hooks/app-context';
import { PageHeading, ExternalLinkButton } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/dialog';
import { Choice, DataDialog } from '../components/jobs/shared';
import { Events } from '../components/jobs/events';
import { ResumeInput } from '../components/resume/inputs';
import { stages, type Stage } from '../data/jobs-schema';
import { jobsRepository } from '../data/jobs-repository';
import { deadlineLabel } from '../data/jobs';

export function ApplicationDetailPage() {
  const { id } = useParams();
  const data = useAppData();
  const app = data.applications.find((a) => a.id === id);
  const navigate = useNavigate();
  const action = useJobAction();
  const [dialog, setDialog] = useState<'edit' | 'resume' | 'submit' | 'stage' | 'delete' | null>(
    null,
  );
  if (!app)
    return (
      <section className="panel jobs-section">
        <h1>지원 기록을 찾을 수 없어요</h1>
        <Link to="/applications">지원 현황으로</Link>
      </section>
    );
  const linked = data.resumes.find((r) => r.id === app.resumeId);
  return (
    <div className="jobs-page">
      <Link className="text-link" to="/applications">
        ← 지원 현황
      </Link>
      <PageHeading
        eyebrow={app.stage}
        title={app.job.company}
        description={`${app.job.role} · ${app.job.title}`}
        action={<Button onClick={() => setDialog('stage')}>지원 단계 변경</Button>}
      />
      {action.error && (
        <p role="alert" className="alert error">
          {action.error}
        </p>
      )}
      <section className="jobs-section">
        <div className="jobs-actions">
          <Link className="text-link" to={`/interviews?application=${app.id}`}>
            제출본으로 면접 준비
          </Link>
          {app.jobId && (
            <Link className="text-link" to={`/jobs/${app.jobId}`}>
              공고와 요구사항 검토
            </Link>
          )}
          <ExternalLinkButton href={app.job.url}>원본 공고</ExternalLinkButton>
          <Button variant="outline" onClick={() => setDialog('edit')}>
            지원 정보 수정
          </Button>
          <Button variant="ghost" onClick={() => setDialog('delete')}>
            지원 기록 삭제
          </Button>
        </div>
        <p className="field-hint">
          공고 정보는 지원 기록 생성 당시 보관한 내용입니다.{' '}
          {app.jobId ? '' : '원본 공고가 삭제되어도 지원 내역은 유지됩니다.'}
        </p>
        <dl className="job-facts">
          <div>
            <dt>지원일</dt>
            <dd>{app.appliedOn || '미기재'}</dd>
          </div>
          <div>
            <dt>지원 방식</dt>
            <dd>{app.method || '미기재'}</dd>
          </div>
          <div>
            <dt>마감일</dt>
            <dd>
              {app.job.deadline || '미기재'} · {deadlineLabel(app.job.deadline)}
            </dd>
          </div>
        </dl>
        <h3>다음 액션</h3>
        <p className="jobs-prose">{app.nextAction || '아직 입력하지 않았습니다.'}</p>
        <h3>지원 메모</h3>
        <p className="jobs-prose">{app.memo || '아직 입력하지 않았습니다.'}</p>
      </section>
      <section className="jobs-section">
        <div className="section-heading">
          <h2>맞춤 이력서 및 제출 증빙</h2>
        </div>
        <div className="jobs-actions">
          <Button
            variant="outline"
            disabled={!data.resumes.length}
            onClick={() => setDialog('resume')}
          >
            이력서 선택 / 복제
          </Button>
          {linked && (
            <Link className="text-link" to={`/resumes/${linked.id}`}>
              연결 초안 편집 · {linked.content.title}
            </Link>
          )}
          <Button onClick={() => setDialog('submit')}>제출 내역 보관</Button>
        </div>
        <p className="field-hint">
          초안을 편집한 뒤 ‘제출본 확정’을 누르세요. 실제 제출한 버전만 선택하고 날짜와 제출 방식을
          기록합니다. 외부 사이트에 문서를 전송하지 않습니다.
        </p>
        {!data.resumes.length && (
          <Link className="text-link" to="/resumes">
            이력서 만들러 가기
          </Link>
        )}
        {!app.submissions.length && <p className="jobs-empty">아직 보관한 제출 내역이 없습니다.</p>}
        {app.submissions.map((s) => (
          <article className="evidence-card" key={s.id}>
            <strong>
              {s.date} · {s.method}
            </strong>
            <p>
              {s.version
                ? `${s.version.content.title} · V${s.version.number} · ${s.version.content.company || '기업 미입력'}`
                : '외부 제출 / 문서 미등록'}
            </p>
            {s.version && (
              <Link className="text-link" to={`/applications/${app.id}/submissions/${s.id}`}>
                보관된 제출본 확인 / PDF
              </Link>
            )}
          </article>
        ))}
      </section>
      <Events applicationId={app.id} />
      <section className="jobs-section">
        <h2>지원 단계 변경 이력</h2>
        <ol className="stage-history">
          {[...app.history].reverse().map((h) => (
            <li key={h.id}>
              <strong>
                {h.from || '시작'} → {h.to}
              </strong>
              <time>{new Date(h.at).toLocaleString('ko-KR')}</time>
              <p className="jobs-prose">{h.note}</p>
            </li>
          ))}
        </ol>
      </section>
      {dialog === 'edit' && (
        <DataDialog
          title="지원 정보 수정"
          initial={{
            appliedOn: app.appliedOn,
            method: app.method,
            memo: app.memo,
            nextAction: app.nextAction,
          }}
          onClose={() => setDialog(null)}
          onSave={(value) => jobsRepository.saveApplication(app.id, app.revision, value)}
        >
          {(v, change) => (
            <>
              <ResumeInput
                label="지원일"
                type="date"
                value={v.appliedOn}
                onChange={(appliedOn) => change({ ...v, appliedOn })}
              />
              <ResumeInput
                label="지원 방식"
                maxLength={300}
                value={v.method}
                onChange={(method) => change({ ...v, method })}
              />
              <ResumeInput
                label="다음 액션"
                multiline
                value={v.nextAction}
                onChange={(nextAction) => change({ ...v, nextAction })}
              />
              <ResumeInput
                label="지원 메모"
                multiline
                value={v.memo}
                onChange={(memo) => change({ ...v, memo })}
              />
            </>
          )}
        </DataDialog>
      )}
      {dialog === 'stage' && (
        <DataDialog
          title="지원 단계 변경"
          initial={{ stage: app.stage, note: '' }}
          onClose={() => setDialog(null)}
          onSave={(v) => jobsRepository.changeStage(app.id, app.revision, v.stage, v.note)}
        >
          {(v, change) => (
            <>
              <Choice
                label="변경할 단계"
                required
                value={v.stage}
                onChange={(stage) => change({ ...v, stage: stage as Stage })}
              >
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Choice>
              <ResumeInput
                label="변경 사유 / 메모"
                multiline
                value={v.note}
                onChange={(note) => change({ ...v, note })}
              />
            </>
          )}
        </DataDialog>
      )}
      {dialog === 'resume' && (
        <DataDialog
          title="맞춤 이력서 연결"
          initial={{ resumeId: linked?.id ?? '', mode: 'copy' }}
          onClose={() => setDialog(null)}
          onSave={(v) =>
            jobsRepository.connectResume(app.id, app.revision, v.resumeId, v.mode === 'copy')
          }
        >
          {(v, change) => (
            <>
              <Choice
                label="기존 이력서"
                required
                value={v.resumeId}
                onChange={(resumeId) => change({ ...v, resumeId })}
              >
                <option value="">이력서 선택</option>
                {data.resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.content.title} · {r.content.company || '기업 미입력'}
                  </option>
                ))}
              </Choice>
              <Choice
                label="연결 방법"
                required
                value={v.mode}
                onChange={(mode) => change({ ...v, mode })}
              >
                <option value="copy">기업·직무에 맞춰 복제하여 연결</option>
                <option value="existing">선택한 초안 그대로 연결</option>
              </Choice>
            </>
          )}
        </DataDialog>
      )}
      {dialog === 'submit' && (
        <DataDialog
          title="제출 내역 보관"
          description="제출 증빙은 원본 이력서 삭제 후에도 유지됩니다. 관심 기업·지원 준비 단계에서는 지원 완료로 변경합니다."
          initial={{ mode: 'registered', versionId: '', date: '', method: app.method }}
          onClose={() => setDialog(null)}
          onSave={async (v) => {
            const version = data.resumeVersions.find((r) => r.id === v.versionId);
            if (v.mode === 'registered' && !version) throw new Error('제출본을 선택해 주세요.');
            if (
              v.mode === 'registered' &&
              version &&
              (version.content.company !== app.job.company ||
                version.content.role !== app.job.role) &&
              !window.confirm(
                '제출본의 기업명 또는 직무가 이 지원 기록과 다릅니다. 실제 제출 문서가 맞습니까?',
              )
            )
              throw new Error('문서를 다시 확인해 주세요.');
            await jobsRepository.submit(
              app.id,
              app.revision,
              v.date,
              v.method,
              v.mode === 'external' ? null : v.versionId,
            );
          }}
        >
          {(v, change) => (
            <>
              <Choice
                label="제출 문서 구분"
                required
                value={v.mode}
                onChange={(mode) => change({ ...v, mode })}
              >
                <option value="registered">등록한 이력서 제출본</option>
                <option value="external">외부 제출 / 문서 미등록</option>
              </Choice>
              {v.mode === 'registered' && (
                <Choice
                  label="실제 제출본 버전"
                  required
                  value={v.versionId}
                  onChange={(versionId) => change({ ...v, versionId })}
                >
                  <option value="">제출본 선택</option>
                  {data.resumeVersions
                    .filter((r) => r.kind === 'submitted')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.content.company || '기업 미입력'} · {r.content.role} · {r.content.title}{' '}
                        · V{r.number} · {r.createdAt.slice(0, 10)}
                      </option>
                    ))}
                </Choice>
              )}
              {data.resumeVersions
                .filter((r) => r.id === v.versionId && v.mode === 'registered')
                .map((r) => (
                  <p key={r.id} className="inline-note">
                    확인: {r.content.profile.name} / {r.content.company || '기업 미입력'} /{' '}
                    {r.content.role} / V{r.number}
                  </p>
                ))}
              <ResumeInput
                label="제출일"
                type="date"
                required
                value={v.date}
                onChange={(date) => change({ ...v, date })}
              />
              <ResumeInput
                label="제출 방식"
                required
                maxLength={300}
                value={v.method}
                onChange={(method) => change({ ...v, method })}
              />
            </>
          )}
        </DataDialog>
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title="지원 기록을 삭제할까요?"
          description="이 지원의 단계 이력·일정·제출 증빙도 함께 삭제됩니다. 필요한 내역은 먼저 JSON으로 백업하세요."
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await jobsRepository.deleteApplication(app.id);
            navigate('/applications');
          }}
        />
      )}
    </div>
  );
}

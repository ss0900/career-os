import { useJobAction } from '../../hooks/use-job-action';
import { useState } from 'react';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/dialog';
import { ResumeInput, ResumeCheck } from '../resume/inputs';
import { Choice, DataDialog } from './shared';
import { useAppData } from '../../hooks/app-context';
import { requirementKinds, type Job, type Requirement } from '../../data/jobs-schema';
import { jobsRepository } from '../../data/jobs-repository';
import { matchRequirement, parseJD } from '../../data/jobs';

export function Requirements({ job }: { job: Job }) {
  const { projects, profile } = useAppData();
  const action = useJobAction();
  const [editing, setEditing] = useState<Requirement | null>(null);
  const [linking, setLinking] = useState<Requirement | null>(null);
  const [deleting, setDeleting] = useState<Requirement | null>(null);
  const matches = job.requirements.map((req) => ({
    req,
    match: matchRequirement(req, projects, profile),
  }));
  return (
    <section className="jobs-section">
      <div className="section-heading">
        <div>
          <h2>요구사항과 경험 근거</h2>
          <p>키워드는 후보만 찾습니다. 실제 기여를 확인해야 ‘확인됨’으로 보관됩니다.</p>
        </div>
      </div>
      {action.error && (
        <p role="alert" className="alert error">
          {action.error}
        </p>
      )}
      <div className="jobs-actions">
        <Button
          disabled={action.busy}
          onClick={() =>
            void action.run(
              () => jobsRepository.addRequirements(job.id, job.revision, parseJD(job)),
              '원문을 보존하며 분류 결과를 추가했습니다. 불확실한 항목을 검토해 주세요.',
            )
          }
        >
          JD 규칙 분석
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const now = new Date().toISOString();
            setEditing({
              id: crypto.randomUUID(),
              createdAt: now,
              updatedAt: now,
              kind: '기타',
              text: '',
              original: '',
              uncertain: true,
              note: '',
              evidence: [],
            });
          }}
        >
          요구사항 추가
        </Button>
      </div>
      <div className="jobs-summary">
        {['확인됨', '확인 필요', '미등록'].map((status) => (
          <span className="badge" key={status}>
            {status} {matches.filter((m) => m.match.status === status).length}
          </span>
        ))}
      </div>
      <p className="field-hint">
        확인됨은 강점 후보, 확인 필요는 수행 범위 추가 검토 대상입니다. 미등록은 현재 기록에서
        근거를 찾지 못했다는 뜻입니다.
      </p>
      {!matches.length && (
        <p className="jobs-empty">JD 규칙 분석을 실행하거나 요구사항을 직접 추가하세요.</p>
      )}
      {matches.map(({ req, match }) => (
        <article className="requirement-card" key={req.id}>
          <div className="jobs-actions">
            <span className="badge">{req.kind}</span>
            <span className="badge">{match.status}</span>
            {req.uncertain && <span className="badge">사용자 확인 필요</span>}
          </div>
          <h3>{req.text}</h3>
          <p className="muted">
            JD 기술 키워드: {match.wanted.join(', ') || '기술명 직접 확인 필요'}
          </p>
          <p className="muted">
            관련 기술: {match.skills.join(', ') || '현재 등록 기록에서 찾지 못함'}
          </p>
          <p className="muted">
            프로젝트 후보:{' '}
            {match.related.map((p) => p.name).join(', ') || '직접 연결할 수 있습니다.'}
          </p>
          {req.note && <p className="jobs-prose">검토 메모: {req.note}</p>}
          <details>
            <summary>원본 문장</summary>
            <p className="jobs-prose">{req.original || '직접 추가한 항목'}</p>
          </details>
          {req.evidence.map((e) => (
            <div className="evidence-card" key={e.id}>
              <strong>
                {e.name} · {e.confirmed ? '확인됨 · 이력서 강조 후보' : '확인 필요'}
              </strong>
              <p>{e.skills.join(', ')}</p>
              <p className="jobs-prose">
                기여: {e.contribution || '미등록'}
                <br />
                구현: {e.implementation || '미등록'}
                <br />
                성과: {e.outcome || '미등록'}
                <br />
                검토 메모: {e.note || '없음'}
              </p>
              <small>
                {projects.some((p) => p.id === e.projectId)
                  ? '연결 당시 프로젝트 기록 보관'
                  : '원본 삭제됨 · 보관 근거 유지'}{' '}
                · {e.createdAt.slice(0, 10)}
              </small>
              <div className="jobs-actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(() =>
                      jobsRepository.changeEvidence(
                        job.id,
                        job.revision,
                        req.id,
                        e.id,
                        !e.confirmed,
                      ),
                    )
                  }
                >
                  {e.confirmed ? '확인 필요로 변경' : '근거 검토 완료'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('이 연결 근거를 삭제할까요?'))
                      void action.run(() =>
                        jobsRepository.changeEvidence(job.id, job.revision, req.id, e.id, null),
                      );
                  }}
                >
                  근거 삭제
                </Button>
              </div>
            </div>
          ))}
          <div className="jobs-actions">
            <Button variant="outline" size="sm" onClick={() => setLinking(req)}>
              프로젝트 근거 연결
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(req)}>
              요구사항 수정
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(req)}>
              요구사항 삭제
            </Button>
          </div>
        </article>
      ))}
      {editing && (
        <DataDialog
          title="요구사항 편집"
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(value) =>
            job.requirements.some((r) => r.id === value.id)
              ? jobsRepository.saveRequirement(job.id, job.revision, value)
              : jobsRepository.addRequirements(job.id, job.revision, [
                  { ...value, original: value.text },
                ])
          }
        >
          {(value, change) => (
            <>
              <Choice
                label="요구사항 구분"
                required
                value={value.kind}
                onChange={(kind) => change({ ...value, kind: kind as typeof value.kind })}
              >
                {requirementKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Choice>
              <ResumeInput
                label="요구사항 문장"
                required
                value={value.text}
                multiline
                maxLength={30000}
                onChange={(text) => change({ ...value, text })}
              />
              <ResumeInput
                label="검토 메모"
                value={value.note}
                multiline
                onChange={(note) => change({ ...value, note })}
              />
              <ResumeCheck
                checked={value.uncertain}
                onChange={(uncertain) => change({ ...value, uncertain })}
              >
                분류에 사용자 확인 필요
              </ResumeCheck>
              <p className="field-hint">문장이나 구분을 바꾸면 연결 근거는 다시 확인해야 합니다.</p>
            </>
          )}
        </DataDialog>
      )}
      {linking && (
        <DataDialog
          title="프로젝트 근거 연결"
          initial={{ projectId: '', note: '', confirmed: false }}
          onClose={() => setLinking(null)}
          onSave={(value) =>
            jobsRepository.linkEvidence(
              job.id,
              job.revision,
              linking.id,
              value.projectId,
              value.note,
              value.confirmed,
            )
          }
        >
          {(value, change) => (
            <>
              <Choice
                label="근거 프로젝트"
                required
                value={value.projectId}
                onChange={(projectId) => change({ ...value, projectId, confirmed: false })}
              >
                <option value="">프로젝트 선택</option>
                {projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </Choice>
              {projects
                .filter((p) => p.id === value.projectId)
                .map((p) => (
                  <p className="jobs-prose" key={p.id}>
                    기여: {p.contribution || '미등록'}
                    <br />
                    구현: {p.implementation || '미등록'}
                    <br />
                    성과: {p.outcome || '미등록'}
                  </p>
                ))}
              <ResumeInput
                label="근거 검토 메모"
                value={value.note}
                multiline
                onChange={(note) => change({ ...value, note })}
              />
              <ResumeCheck
                checked={value.confirmed}
                onChange={(confirmed) => change({ ...value, confirmed })}
              >
                이 요구사항에 대한 실제 경험과 근거를 확인했습니다.
              </ResumeCheck>
            </>
          )}
        </DataDialog>
      )}
      {deleting && (
        <ConfirmDialog
          title="요구사항을 삭제할까요?"
          description="이 요구사항의 연결 근거도 함께 삭제됩니다. 원본 프로젝트는 유지됩니다."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await jobsRepository.deleteRequirement(job.id, job.revision, deleting.id);
          }}
        />
      )}
    </section>
  );
}

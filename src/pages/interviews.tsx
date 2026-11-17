import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppData } from '../hooks/app-context';
import { PageHeading } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/dialog';
import { DataDialog, Choice } from '../components/jobs/shared';
import { ResumeCheck, ResumeInput } from '../components/resume/inputs';
import {
  questionKinds,
  difficulties,
  sessionTypes,
  type Question,
  type SessionContent,
} from '../data/interview-schema';
import { interviewRepository } from '../data/interview-repository';
import { newQuestion, answerText } from '../data/interview';
import { InterviewPrompts } from '../components/interview/prompts';
import '../components/interview/interview.css';

export function InterviewsPage() {
  const data = useAppData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [preparing, setPreparing] = useState(!!params.get('application') || !!params.get('job'));
  const [preparationId, setPreparationId] = useState('');
  const preparation = data.preparations.find((p) => p.id === preparationId);
  const [editing, setEditing] = useState<{ value: Question; fresh: boolean } | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [session, setSession] = useState(false);
  const [query, setQuery] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [kind, setKind] = useState('');
  const [role, setRole] = useState('');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('questions');
  const weakCount = (id: string) =>
    data.sessions.reduce(
      (n, s) =>
        n +
        s.content.items.filter(
          (i) =>
            i.questionId === id &&
            (i.feedback.review || i.feedback.ratings.some((r) => r !== null && r <= 2)),
        ).length,
      0,
    );
  const rows = data.questions.filter(
    (q) =>
      (!preparationId || q.preparationId === preparationId) &&
      (!kind || kind === q.kind) &&
      (!role || role === q.role) &&
      q.company.toLowerCase().includes(query.toLowerCase()) &&
      q.projectName.toLowerCase().includes(projectQuery.toLowerCase()) &&
      (filter === 'unanswered'
        ? !answerText(q.draft).trim()
        : filter === 'review'
          ? q.review
          : filter === 'weak'
            ? weakCount(q.id) >= 2
            : filter === 'favorite'
              ? q.favorite
              : true),
  );
  return (
    <div className="jobs-page">
      <PageHeading
        eyebrow="INTERVIEW PRACTICE"
        title="면접 준비"
        description="경험을 근거로 답변을 다듬고, 질문 하나씩 연습하세요."
        action={<Button onClick={() => setPreparing(true)}>기업별 면접 준비</Button>}
      />
      <Choice label="면접 준비 자료" value={preparationId} onChange={setPreparationId}>
        <option value="">전체 질문 / 일반 연습</option>
        {data.preparations.map((p) => (
          <option key={p.id} value={p.id}>
            {p.company} · {p.role} · {p.createdAt.slice(0, 10)} · {p.id.slice(0, 6)}
          </option>
        ))}
      </Choice>
      {preparation && (
        <details className="jobs-section">
          <summary>준비 당시 JD·근거·제출본·일정</summary>
          <p className="field-hint">원본 삭제 후에도 유지되는 준비 당시의 복사본입니다.</p>
          <p>준비 당시 지원 단계: {preparation.stage || '지원 기록 없이 준비'}</p>
          <h3>
            {preparation.company} · {preparation.role}
          </h3>
          <p className="jobs-prose">{preparation.job?.raw || 'JD 원문 미등록'}</p>
          {preparation.job?.requirements.map((r) => (
            <p key={r.id}>
              {r.kind}: {r.text}
              {r.evidence
                .filter((e) => e.confirmed)
                .map((e) => (
                  <span key={e.id}>
                    {' '}
                    · 확인 근거: {e.name} / {e.contribution}
                  </span>
                ))}
            </p>
          ))}
          {preparation.projects.map((p) => (
            <p key={p.id}>
              {p.name} · {p.contribution}
            </p>
          ))}
          {preparation.careers.map((c) => (
            <p key={c.id}>
              {c.company} · {c.responsibilities}
            </p>
          ))}
          {preparation.submissions.length ? (
            preparation.submissions.map((s) => (
              <details key={s.id}>
                <summary>
                  제출본 V{s.number} · {s.content.title}
                </summary>
                <pre className="phase4-json" tabIndex={0}>
                  {JSON.stringify(s.content, null, 2)}
                </pre>
              </details>
            ))
          ) : (
            <p>제출본 없이 준비 중입니다.</p>
          )}
          {preparation.events.map((e) => (
            <p key={e.id}>
              {e.date} {e.time || '시간 미정'} · {e.title}
            </p>
          ))}
        </details>
      )}
      <div className="jobs-actions">
        {[
          ['questions', '질문 은행'],
          ['sessions', '면접 기록'],
          ['prompts', 'ChatGPT 프롬프트'],
        ].map(([v, label]) => (
          <Button
            key={v}
            variant={tab === v ? 'default' : 'outline'}
            onClick={() => setTab(v)}
            aria-pressed={tab === v}
          >
            {label}
          </Button>
        ))}
        <Button
          variant="outline"
          onClick={() => setSession(true)}
          disabled={!data.questions.length}
        >
          모의 면접 시작
        </Button>
      </div>
      {tab === 'prompts' ? (
        <InterviewPrompts preparation={preparation} />
      ) : tab === 'sessions' ? (
        <section className="jobs-section">
          <h2>면접 기록 · 이어하기</h2>
          {!data.sessions.length && <p>저장된 면접 기록이 없습니다.</p>}
          {data.sessions
            .filter((s) => !preparationId || s.content.preparationId === preparationId)
            .map((s) => (
              <article key={s.id} className="phase4-row">
                <div>
                  <strong>{s.content.title}</strong>
                  <p>
                    {s.content.mode} · {s.content.status} ·{' '}
                    {s.content.items.filter((i) => i.completed).length}/{s.content.count}개 답변 ·{' '}
                    {s.content.date || '날짜 미정'}
                  </p>
                </div>
                <Link className="text-link" to={`/interviews/sessions/${s.id}`}>
                  결과 확인 / 이어하기
                </Link>
              </article>
            ))}
        </section>
      ) : (
        <>
          <section className="jobs-section">
            <div className="jobs-filters">
              <ResumeInput label="질문 기업 검색" value={query} onChange={setQuery} />
              <ResumeInput
                label="질문 프로젝트 검색"
                value={projectQuery}
                onChange={setProjectQuery}
              />
              <Choice label="질문 유형 필터" value={kind} onChange={setKind}>
                <option value="">전체 유형</option>
                {questionKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Choice>
              <Choice label="질문 직무 필터" value={role} onChange={setRole}>
                <option value="">전체 직무</option>
                {[...new Set(data.questions.map((q) => q.role).filter(Boolean))].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Choice>
              <Choice label="질문 상태 필터" value={filter} onChange={setFilter}>
                <option value="all">전체 상태</option>
                <option value="unanswered">미답변</option>
                <option value="review">복습 필요</option>
                <option value="weak">반복 취약 · 2회 이상</option>
                <option value="favorite">즐겨찾기</option>
              </Choice>
            </div>
            <Button onClick={() => setEditing({ value: newQuestion(preparation), fresh: true })}>
              질문 등록
            </Button>
            <p className="field-hint">
              규칙 기반 질문은 AI 추론이 아닙니다. 반복 취약은 자체 평가 2점 이하 또는 복습 표시가
              2회 이상인 질문입니다.
            </p>
          </section>
          {!rows.length && (
            <p className="jobs-empty">
              표시할 질문이 없습니다. 기업별 준비를 시작하거나 직접 질문을 등록하세요.
            </p>
          )}
          {rows.map((q) => (
            <article className="jobs-section" key={q.id}>
              <div className="jobs-actions">
                <span className="badge">{q.kind}</span>
                <span>
                  {q.difficulty} · {q.source}
                </span>
                {q.favorite && <span>★ 즐겨찾기</span>}
                {q.review && <span className="badge">복습 필요</span>}
              </div>
              <h2>{q.text}</h2>
              <p>
                {q.company || '일반 질문'} · {q.role} · {q.projectName || '프로젝트 미연결'}
              </p>
              <p className="muted">
                {answerText(q.draft).trim() ? '답변 작성됨' : '미답변'} · 버전 {q.versions.length}개
                · 취약 기록 {weakCount(q.id)}회
              </p>
              <div className="jobs-actions">
                <Link className="text-link" to={`/interviews/questions/${q.id}`}>
                  STAR 답변 작성 →
                </Link>
                <Button variant="outline" onClick={() => setEditing({ value: q, fresh: false })}>
                  질문 수정
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(q)}>
                  질문 삭제
                </Button>
              </div>
            </article>
          ))}
        </>
      )}
      {preparing && (
        <DataDialog
          title="기업별 면접 준비"
          description="선택한 JD·프로젝트와 지원 당시 제출본·일정을 복사해 질문을 생성합니다."
          initial={{
            source: params.get('application')
              ? `app:${params.get('application')}`
              : params.get('job')
                ? `job:${params.get('job')}`
                : '',
            projects: [] as string[],
          }}
          onClose={() => setPreparing(false)}
          onSave={async (v) => {
            const [type, id] = v.source.split(':');
            if (
              data.preparations.some((p) =>
                type === 'app' ? p.applicationId === id : p.jobId === id,
              ) &&
              !window.confirm(
                '같은 지원 또는 공고로 만든 준비 자료가 있습니다. 새 시점의 자료와 질문을 별도로 만들까요?',
              )
            )
              throw new Error('준비 자료 생성을 취소했습니다.');
            const prep = await interviewRepository.prepare(
              type === 'job' ? id : '',
              type === 'app' ? id : '',
              v.projects,
            );
            setPreparationId(prep.id);
            setTab('questions');
          }}
        >
          {(v, change) => (
            <>
              <Choice
                label="기업 / 공고 선택"
                required
                value={v.source}
                onChange={(source) => change({ ...v, source })}
              >
                <option value="">선택</option>
                {data.applications.map((a) => (
                  <option key={a.id} value={`app:${a.id}`}>
                    지원 · {a.job.company} · {a.job.role} · {a.stage}
                  </option>
                ))}
                {data.jobs.map((j) => (
                  <option key={j.id} value={`job:${j.id}`}>
                    공고 · {j.company} · {j.role}
                  </option>
                ))}
              </Choice>
              <h3>함께 검토할 프로젝트</h3>
              {data.projects.map((p) => (
                <ResumeCheck
                  key={p.id}
                  checked={v.projects.includes(p.id)}
                  onChange={(yes) =>
                    change({
                      ...v,
                      projects: yes
                        ? [...v.projects, p.id]
                        : v.projects.filter((id) => id !== p.id),
                    })
                  }
                >
                  {p.name}
                </ResumeCheck>
              ))}
            </>
          )}
        </DataDialog>
      )}
      {editing && (
        <DataDialog
          title={editing.fresh ? '질문 등록' : '질문 수정'}
          initial={editing.value}
          onClose={() => setEditing(null)}
          onSave={async (q) => {
            if (
              data.questions.some(
                (other) =>
                  other.id !== q.id &&
                  other.company === q.company &&
                  other.text.trim() === q.text.trim(),
              ) &&
              !window.confirm('동일 기업의 같은 질문이 있습니다. 별도로 저장할까요?')
            )
              throw new Error('중복 확인을 취소했습니다.');
            await interviewRepository.saveQuestion(
              q,
              editing.fresh ? undefined : editing.value.revision,
            );
          }}
        >
          {(q, change) => (
            <>
              <Choice
                label="질문의 면접 준비 자료"
                value={q.preparationId}
                onChange={(preparationId) => {
                  const selected = data.preparations.find((p) => p.id === preparationId);
                  change({
                    ...q,
                    preparationId,
                    company: selected?.company ?? q.company,
                    role: selected?.role ?? q.role,
                    requirementId: '',
                    requirementText: '',
                  });
                }}
              >
                <option value="">일반 질문</option>
                {data.preparations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company} · {p.role} · {p.id.slice(0, 6)}
                  </option>
                ))}
              </Choice>
              <Choice
                label="연결 JD 요구사항"
                value={q.requirementId}
                onChange={(requirementId) =>
                  change({
                    ...q,
                    requirementId,
                    requirementText:
                      data.preparations
                        .find((p) => p.id === q.preparationId)
                        ?.job?.requirements.find((r) => r.id === requirementId)?.text ?? '',
                  })
                }
              >
                <option value="">연결 없음</option>
                {data.preparations
                  .find((p) => p.id === q.preparationId)
                  ?.job?.requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.kind} · {r.text}
                    </option>
                  ))}
              </Choice>
              <ResumeInput
                label="질문 내용"
                required
                multiline
                value={q.text}
                onChange={(text) => change({ ...q, text })}
              />
              <div className="form-grid">
                <Choice
                  label="질문 유형"
                  required
                  value={q.kind}
                  onChange={(kind) => change({ ...q, kind: kind as Question['kind'] })}
                >
                  {questionKinds.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </Choice>
                <Choice
                  label="질문 난이도"
                  required
                  value={q.difficulty}
                  onChange={(difficulty) =>
                    change({ ...q, difficulty: difficulty as Question['difficulty'] })
                  }
                >
                  {difficulties.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Choice>
                <ResumeInput
                  label="관련 기업"
                  value={q.company}
                  onChange={(company) => change({ ...q, company })}
                />
                <ResumeInput
                  label="관련 직무"
                  value={q.role}
                  onChange={(role) => change({ ...q, role })}
                />
              </div>
              <Choice
                label="관련 프로젝트"
                value={q.projectId}
                onChange={(projectId) =>
                  change({
                    ...q,
                    projectId,
                    projectName: data.projects.find((p) => p.id === projectId)?.name ?? '',
                  })
                }
              >
                <option value="">연결 없음</option>
                {q.projectId && !data.projects.some((p) => p.id === q.projectId) && (
                  <option value={q.projectId}>{q.projectName} · 원본 삭제됨</option>
                )}
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Choice>
              <ResumeCheck checked={q.favorite} onChange={(favorite) => change({ ...q, favorite })}>
                즐겨찾기
              </ResumeCheck>
              <ResumeCheck checked={q.review} onChange={(review) => change({ ...q, review })}>
                복습 필요
              </ResumeCheck>
            </>
          )}
        </DataDialog>
      )}
      {deleting && (
        <ConfirmDialog
          title="질문을 삭제할까요?"
          description="질문과 답변 버전이 삭제됩니다. 기존 면접 세션에 보관한 질문·답변은 유지됩니다."
          onClose={() => setDeleting(null)}
          onConfirm={() => interviewRepository.deleteQuestion(deleting.id)}
        />
      )}
      {session && (
        <DataDialog
          title="면접 세션 만들기"
          initial={{
            title: `${preparation?.company ?? '일반'} 면접 연습`,
            preparationId,
            company: preparation?.company ?? '',
            role: preparation?.role ?? '',
            mode: '모의 면접' as SessionContent['mode'],
            type: '종합 면접' as SessionContent['type'],
            difficulty: '보통' as SessionContent['difficulty'],
            count: 4,
            technicalPercent: 50,
            includeJD: true,
            projectIds: [] as string[],
            date: '',
          }}
          onClose={() => setSession(false)}
          onSave={async (v) => {
            const saved = await interviewRepository.createSession(v);
            navigate(`/interviews/sessions/${saved.id}`);
          }}
        >
          {(v, change) => (
            <>
              <ResumeInput
                label="세션 제목"
                required
                value={v.title}
                onChange={(title) => change({ ...v, title })}
              />
              <Choice
                label="세션 기업 / 준비 자료"
                value={v.preparationId}
                onChange={(preparationId) => {
                  const selected = data.preparations.find((p) => p.id === preparationId);
                  change({
                    ...v,
                    preparationId,
                    company: selected?.company ?? '',
                    role: selected?.role ?? '',
                    projectIds: [],
                  });
                }}
              >
                <option value="">전체 질문 / 일반 연습</option>
                {data.preparations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company} · {p.role} · {p.id.slice(0, 6)}
                  </option>
                ))}
              </Choice>
              <ResumeInput
                label="세션 기업명"
                value={v.company}
                onChange={(company) => change({ ...v, company })}
              />
              <ResumeInput
                label="세션 지원 직무"
                value={v.role}
                onChange={(role) => change({ ...v, role })}
              />
              <Choice
                label="기록 구분"
                required
                value={v.mode}
                onChange={(mode) => change({ ...v, mode: mode as SessionContent['mode'] })}
              >
                <option>모의 면접</option>
                <option>실제 면접 회고</option>
              </Choice>
              <ResumeInput
                label="면접 날짜"
                type="date"
                value={v.date}
                onChange={(date) => change({ ...v, date })}
              />
              <Choice
                label="면접 유형"
                required
                value={v.type}
                onChange={(type) =>
                  change({
                    ...v,
                    type: type as SessionContent['type'],
                    technicalPercent:
                      type === '인성 면접'
                        ? 0
                        : ['기술 면접', '프로젝트 심층 면접'].includes(type)
                          ? 100
                          : 50,
                  })
                }
              >
                {sessionTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Choice>
              <Choice
                label="면접 난이도"
                required
                value={v.difficulty}
                onChange={(difficulty) =>
                  change({ ...v, difficulty: difficulty as SessionContent['difficulty'] })
                }
              >
                {difficulties.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Choice>
              <ResumeInput
                label="질문 개수 · 1~30"
                required
                type="number"
                value={String(v.count)}
                onChange={(n) => change({ ...v, count: Number(n) })}
              />
              <Choice
                label="기술 질문 비율"
                required
                disabled={['기술 면접', '프로젝트 심층 면접', '인성 면접'].includes(v.type)}
                value={String(v.technicalPercent)}
                onChange={(n) => change({ ...v, technicalPercent: Number(n) })}
              >
                {[0, 25, 50, 75, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}% 기술 / {100 - n}% 기타
                  </option>
                ))}
              </Choice>
              <ResumeCheck
                checked={v.includeJD}
                onChange={(includeJD) => change({ ...v, includeJD })}
              >
                JD 기반 질문 포함
              </ResumeCheck>
              <h3>프로젝트 범위 · 미선택 시 전체</h3>
              {(
                data.preparations.find((p) => p.id === v.preparationId)?.projects ?? data.projects
              ).map((p) => (
                <ResumeCheck
                  key={p.id}
                  checked={v.projectIds.includes(p.id)}
                  onChange={(yes) =>
                    change({
                      ...v,
                      projectIds: yes
                        ? [...v.projectIds, p.id]
                        : v.projectIds.filter((id) => id !== p.id),
                    })
                  }
                >
                  {p.name}
                </ResumeCheck>
              ))}
            </>
          )}
        </DataDialog>
      )}
    </div>
  );
}

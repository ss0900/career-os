import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/common';
import { Button } from '../components/ui/button';
import { ResumeInput } from '../components/resume/inputs';
import { Choice, DataDialog } from '../components/jobs/shared';
import { Events } from '../components/jobs/events';
import { useAppData } from '../hooks/app-context';
import { stages, type Application, type Stage } from '../data/jobs-schema';
import { deadlineLabel, localDay } from '../data/jobs';
import { jobsRepository } from '../data/jobs-repository';

export function ApplicationsPage() {
  const { applications, events, jobs } = useAppData();
  const navigate = useNavigate();
  const [view, setView] = useState('kanban');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [role, setRole] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('updated');
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<{ app: Application; stage: Stage } | null>(null);
  const rows = applications
    .filter(
      (a) =>
        a.job.company.toLowerCase().includes(query.toLowerCase()) &&
        (!stage || a.stage === stage) &&
        (!role || a.job.role === role) &&
        (!from || a.appliedOn >= from) &&
        (!to || (!!a.appliedOn && a.appliedOn <= to)),
    )
    .sort((a, b) =>
      sort === 'deadline'
        ? (a.job.deadline || '9999').localeCompare(b.job.deadline || '9999')
        : sort === 'applied'
          ? b.appliedOn.localeCompare(a.appliedOn)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const nextEvent = (a: Application) =>
    events
      .filter((e) => e.applicationId === a.id && !e.done)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const nextLabel = (a: Application) => {
    const e = nextEvent(a);
    return e
      ? `${e.date} ${e.time || ''} · ${e.title}${e.date < localDay() ? ' · 지연' : ''}`
      : '일정 없음';
  };
  return (
    <div className="jobs-page">
      <PageHeading
        eyebrow="APPLICATION TRACKER"
        title="지원 현황"
        description="제출 문서와 전형 이력을 함께 보관하세요."
        action={
          <Button disabled={!jobs.length} onClick={() => setCreating(true)}>
            지원 기록 추가
          </Button>
        }
      />
      <div className="jobs-actions">
        {[
          ['kanban', '칸반'],
          ['table', '테이블'],
          ['events', '일정'],
        ].map(([key, label]) => (
          <Button
            key={key}
            aria-pressed={view === key}
            variant={view === key ? 'default' : 'outline'}
            onClick={() => setView(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {view === 'events' ? (
        <Events />
      ) : (
        <>
          <div className="jobs-filters">
            <ResumeInput label="지원 기업 검색" value={query} onChange={setQuery} />
            <Choice label="지원 단계 필터" value={stage} onChange={setStage}>
              <option value="">전체 단계</option>
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Choice>
            <Choice label="지원 직무 필터" value={role} onChange={setRole}>
              <option value="">전체 직무</option>
              {[...new Set(applications.map((a) => a.job.role))].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Choice>
            <ResumeInput label="지원일 시작" type="date" value={from} onChange={setFrom} />
            <ResumeInput label="지원일 종료" type="date" value={to} onChange={setTo} />
            <Choice label="지원 정렬" value={sort} onChange={setSort}>
              <option value="updated">최근 수정</option>
              <option value="applied">지원일순</option>
              <option value="deadline">마감일순</option>
            </Choice>
          </div>
          {!rows.length && (
            <p className="jobs-empty">
              지원 기록이 없습니다. 채용공고에서 지원 기록을 만들어 보세요.
            </p>
          )}
          {view === 'kanban' ? (
            <div
              className="kanban"
              tabIndex={0}
              role="region"
              aria-label="지원 단계 칸반"
              onDragOver={(event) => {
                const board = event.currentTarget;
                const bounds = board.getBoundingClientRect();
                if (event.clientX > bounds.right - 60) board.scrollLeft += 35;
                else if (event.clientX < bounds.left + 60) board.scrollLeft -= 35;
              }}
            >
              <p className="sr-only">카드를 끌거나 카드의 단계 변경 선택창으로 이동하세요.</p>
              {stages.map((s) => (
                <section
                  className="kanban-column"
                  key={s}
                  aria-label={s}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const app = applications.find(
                      (a) => a.id === e.dataTransfer.getData('text/career-application'),
                    );
                    if (app && app.stage !== s) setMoving({ app, stage: s });
                  }}
                >
                  <h2>
                    {s} <span>{rows.filter((a) => a.stage === s).length}</span>
                  </h2>
                  {rows
                    .filter((a) => a.stage === s)
                    .map((a) => (
                      <article
                        className="kanban-card"
                        key={a.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/career-application', a.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                      >
                        <h3>
                          <Link to={`/applications/${a.id}`}>{a.job.company}</Link>
                        </h3>
                        <p>{a.job.role}</p>
                        <p className="muted">{deadlineLabel(a.job.deadline)}</p>
                        <p>{nextLabel(a)}</p>
                        <p className="jobs-prose">{a.nextAction || '다음 액션 미입력'}</p>
                        <p className="muted">{a.memo.slice(0, 150)}</p>
                        <Choice
                          label={`${a.job.company} 단계 변경`}
                          value={a.stage}
                          onChange={(stage) => setMoving({ app: a, stage: stage as Stage })}
                        >
                          {stages.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </Choice>
                      </article>
                    ))}
                </section>
              ))}
            </div>
          ) : (
            <div className="jobs-table-scroll" tabIndex={0} role="region" aria-label="지원 기록 표">
              <table className="jobs-table">
                <thead>
                  <tr>
                    {[
                      '기업 / 직무',
                      '지원일',
                      '지원 단계',
                      '마감일',
                      '다음 일정',
                      '제출 이력서',
                      '최근 수정',
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/applications/${a.id}`}>
                          {a.job.company} · {a.job.role}
                        </Link>
                      </td>
                      <td>{a.appliedOn || '미기재'}</td>
                      <td>{a.stage}</td>
                      <td>{a.job.deadline || '미기재'}</td>
                      <td>{nextLabel(a)}</td>
                      <td>
                        {a.submissions.length
                          ? a.submissions.map((s) => (
                              <div key={s.id}>
                                {s.version ? (
                                  <Link to={`/applications/${a.id}/submissions/${s.id}`}>
                                    {s.version.content.title} · V{s.version.number}
                                  </Link>
                                ) : (
                                  '외부 제출 / 문서 미등록'
                                )}
                              </div>
                            ))
                          : '제출 기록 없음'}
                      </td>
                      <td>{a.updatedAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {creating && (
        <DataDialog
          title="지원 기록 추가"
          initial=""
          onClose={() => setCreating(false)}
          onSave={async (id) => {
            const app = await jobsRepository.createApplication(id);
            navigate(`/applications/${app.id}`);
          }}
        >
          {(value, change) => (
            <Choice label="지원할 채용공고" required value={value} onChange={change}>
              <option value="">공고 선택</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company} · {j.title}
                </option>
              ))}
            </Choice>
          )}
        </DataDialog>
      )}
      {moving && (
        <DataDialog
          title="지원 단계 변경"
          initial=""
          description={`${moving.app.job.company}: ${moving.app.stage} → ${moving.stage}`}
          onClose={() => setMoving(null)}
          onSave={(note) =>
            jobsRepository.changeStage(moving.app.id, moving.app.revision, moving.stage, note)
          }
        >
          {(value, change) => (
            <ResumeInput label="변경 사유 / 메모" value={value} onChange={change} multiline />
          )}
        </DataDialog>
      )}
    </div>
  );
}

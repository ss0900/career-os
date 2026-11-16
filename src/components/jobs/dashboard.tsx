import { Link } from 'react-router-dom';
import { useAppData } from '../../hooks/app-context';
import { applicationStats, dayDistance, deadlineLabel, localDay } from '../../data/jobs';
import './jobs.css';

export function JobsDashboard() {
  const { jobs, applications, events } = useAppData();
  const stats = applicationStats(applications);
  const upcoming = events
    .filter((e) => !e.done)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const deadlines = jobs
    .filter((j) => j.deadline && dayDistance(j.deadline) >= 0 && dayDistance(j.deadline) <= 14)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  return (
    <section className="jobs-section jobs-dashboard">
      <div className="section-heading">
        <h2>지원 활동</h2>
        <Link className="text-link" to="/applications">
          지원 현황 →
        </Link>
      </div>
      <div className="jobs-metrics">
        {[
          ['관심 채용공고', jobs.filter((j) => j.favorite).length],
          ['지원 준비', applications.filter((a) => a.stage === '지원 준비').length],
          ['현재 지원 완료', applications.filter((a) => a.stage === '지원 완료').length],
          ['서류 합격 누적', stats.paper],
          ['현재 면접 진행', applications.filter((a) => a.stage === '면접 진행').length],
          ['최종 결과', stats.won + stats.lost],
          ['총 지원', stats.applied],
          ['면접 진입 누적', stats.interview],
          ['최종 합격', stats.won],
          ['불합격', stats.lost],
        ].map(([label, n]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <p className="jobs-prose">
        지원 → 서류 합격: {stats.paperRate}
        <br />
        서류 합격 → 면접 진입: {stats.interviewRate}
        <br />
        면접 진입 → 최종 합격: {stats.offerRate}
      </p>
      <details>
        <summary>통계 계산 기준</summary>
        <p className="field-hint">
          지원 취소는 집계에서 제외합니다. 지원일·제출 내역 또는 지원 완료 이후 단계 이력이 있는
          기록을 지원으로 계산하며, 같은 지원 ID는 한 번만 셉니다. 재지원은 별도 지원 건입니다. 면접
          진입은 서류 통과, 최종 합격은 면접 진입도 포함합니다. 진행 중·결과 미확정 건도 분모에
          포함하므로 전환율은 현재까지의 관측치이며 합격 가능성이 아닙니다. 현재 불합격만 불합격
          건수로 계산합니다.
        </p>
      </details>
      <div className="jobs-dashboard-grid">
        <div>
          <h3>14일 이내 마감</h3>
          {deadlines.length ? (
            deadlines.slice(0, 8).map((j) => (
              <p key={j.id}>
                <Link to={`/jobs/${j.id}`}>
                  {j.company} · {j.title}
                </Link>{' '}
                · {deadlineLabel(j.deadline)}
              </p>
            ))
          ) : (
            <p className="muted">임박한 마감이 없습니다.</p>
          )}
          <h3>최근 채용공고</h3>
          {[...jobs]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map((j) => (
              <p key={j.id}>
                <Link to={`/jobs/${j.id}`}>
                  {j.company} · {j.title}
                </Link>
              </p>
            ))}
        </div>
        <div>
          <h3>미완료 일정 · 면접 · 과제</h3>
          {upcoming.length ? (
            upcoming.slice(0, 8).map((e) => (
              <p key={e.id}>
                <Link to={`/applications/${e.applicationId}`}>
                  {e.date} {e.time} · {e.title}
                </Link>
                {e.date < localDay() ? ' · 지연' : ''}
              </p>
            ))
          ) : (
            <p className="muted">예정된 일정이 없습니다.</p>
          )}
          <h3>다음 액션</h3>
          {applications
            .filter((a) => a.nextAction && !['최종 합격', '불합격', '지원 취소'].includes(a.stage))
            .slice(0, 5)
            .map((a) => (
              <p key={a.id}>
                <Link to={`/applications/${a.id}`}>{a.job.company}</Link> · {a.nextAction}
              </p>
            ))}
        </div>
      </div>
    </section>
  );
}

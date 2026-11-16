import { useJobAction } from '../hooks/use-job-action';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../hooks/app-context';
import { PageHeading, ExternalLinkButton } from '../components/common';
import { Button } from '../components/ui/button';
import { JobForm } from '../components/jobs/job-form';
import { Requirements } from '../components/jobs/requirements';
import { PromptPanel } from '../components/jobs/prompt-panel';

import { jobsRepository } from '../data/jobs-repository';
import { deadlineLabel } from '../data/jobs';

export function JobDetailPage() {
  const { id } = useParams();
  const { jobs, applications } = useAppData();
  const job = jobs.find((j) => j.id === id);
  const navigate = useNavigate();
  const action = useJobAction();
  const [editing, setEditing] = useState(false);
  if (!job)
    return (
      <section className="panel jobs-section">
        <h1>공고를 찾을 수 없어요</h1>
        <Link to="/jobs">채용공고 목록</Link>
      </section>
    );
  return (
    <div className="jobs-page">
      <Link className="text-link" to="/jobs">
        ← 채용공고 목록
      </Link>
      <PageHeading
        eyebrow={job.company}
        title={job.title}
        description={`${job.role} · ${deadlineLabel(job.deadline)}`}
        action={
          <Button variant="outline" onClick={() => setEditing(true)}>
            공고 수정
          </Button>
        }
      />
      {action.error && (
        <p className="alert error" role="alert">
          {action.error}
        </p>
      )}
      <section className="jobs-section">
        <div className="jobs-actions">
          <ExternalLinkButton href={job.url}>원본 공고 열기</ExternalLinkButton>
          <Button
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const app = await jobsRepository.createApplication(job.id);
                navigate(`/applications/${app.id}`);
              }, '지원 기록을 만들었습니다.')
            }
          >
            지원 기록 생성
          </Button>
        </div>
        <p className="field-hint">같은 공고에 재지원할 때도 별도의 지원 기록을 만들 수 있습니다.</p>
        <div className="jobs-summary">
          {applications
            .filter((a) => a.jobId === job.id)
            .map((a, i) => (
              <Link key={a.id} className="badge" to={`/applications/${a.id}`}>
                지원 {i + 1} · {a.stage}
              </Link>
            ))}
        </div>
        <dl className="job-facts">
          {[
            ['근무지역', job.location],
            ['근무형태', job.workMode],
            ['고용형태', job.employment],
            ['경력 조건', job.experience],
            ['연봉 / 처우', job.compensation],
            ['게시일', job.postedOn],
            ['마감일', job.deadline],
            ['확인일', job.checkedOn],
            ['관심도', job.interest],
            ['기술스택', job.skills.join(', ')],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || '미기재'}</dd>
            </div>
          ))}
        </dl>
        {[
          ['지원하고 싶은 이유', job.motivation],
          ['지원 전 확인할 사항', job.questions],
          ['기업 / 직무 메모', job.memo],
        ].map(([label, value]) => (
          <div key={label}>
            <h3>{label}</h3>
            <p className="jobs-prose">{value || '아직 기록하지 않았습니다.'}</p>
          </div>
        ))}
        <details>
          <summary>JD 원문 및 직접 입력 정보</summary>
          {[
            ['원문', job.raw],
            ['주요 업무', job.duties],
            ['필수 자격요건', job.essential],
            ['우대사항', job.preferred],
          ].map(([label, value]) => (
            <div key={label}>
              <h3>{label}</h3>
              <p className="jobs-prose">{value || '미기재'}</p>
            </div>
          ))}
        </details>
      </section>
      <Requirements job={job} />
      <PromptPanel key={job.id} job={job} />
      {editing && <JobForm job={job} onClose={() => setEditing(false)} />}
    </div>
  );
}

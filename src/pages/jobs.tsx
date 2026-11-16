import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading, EmptyState } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/dialog';
import { JobForm } from '../components/jobs/job-form';
import { Choice } from '../components/jobs/shared';
import { ResumeInput, ResumeCheck } from '../components/resume/inputs';
import { useAppData } from '../hooks/app-context';
import { jobsRepository } from '../data/jobs-repository';
import { deadlineLabel, normalizeSkill, extractSkills } from '../data/jobs';
import type { Job } from '../data/jobs-schema';

export function JobsPage() {
  const { jobs } = useAppData();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [skill, setSkill] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [view, setView] = useState('cards');
  const [sort, setSort] = useState('updated');
  const [editing, setEditing] = useState<Job | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Job | null>(null);
  const filtered = jobs
    .filter(
      (j) =>
        `${j.company} ${j.title}`.toLowerCase().includes(query.toLowerCase()) &&
        (!role || j.role === role) &&
        (!skill ||
          [...j.skills, ...j.requirements.flatMap((r) => extractSkills(r.text))].some(
            (s) => normalizeSkill(s) === normalizeSkill(skill),
          )) &&
        (!favorite || j.favorite),
    )
    .sort((a, b) =>
      sort === 'deadline'
        ? (a.deadline || '9999').localeCompare(b.deadline || '9999')
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <div className="jobs-page">
      <PageHeading
        eyebrow="OPPORTUNITIES"
        title="채용공고"
        description="공고를 검토하고, 나의 경험과 연결해 지원을 준비하세요."
        action={<Button onClick={() => setEditing('new')}>채용공고 등록</Button>}
      />
      <div className="jobs-filters">
        <ResumeInput label="기업명 / 공고 검색" value={query} onChange={setQuery} />
        <Choice label="직무 필터" value={role} onChange={setRole}>
          <option value="">전체 직무</option>
          {[...new Set(jobs.map((j) => j.role))].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Choice>
        <ResumeInput label="기술스택 필터" value={skill} onChange={setSkill} />
        <Choice label="공고 정렬" value={sort} onChange={setSort}>
          <option value="updated">최근 수정</option>
          <option value="deadline">마감일순</option>
        </Choice>
        <ResumeCheck checked={favorite} onChange={setFavorite}>
          즐겨찾기만
        </ResumeCheck>
      </div>
      <div className="jobs-actions">
        <Button
          variant={view === 'cards' ? 'default' : 'outline'}
          aria-pressed={view === 'cards'}
          onClick={() => setView('cards')}
        >
          카드 보기
        </Button>
        <Button
          variant={view === 'table' ? 'default' : 'outline'}
          aria-pressed={view === 'table'}
          onClick={() => setView('table')}
        >
          테이블 보기
        </Button>
        <span className="muted">{filtered.length}개 공고</span>
      </div>
      {!filtered.length ? (
        <section className="panel">
          <EmptyState
            title="표시할 채용공고가 없어요"
            description="새 공고를 등록하거나 검색 조건을 바꿔 보세요."
          />
        </section>
      ) : view === 'cards' ? (
        <div className="project-grid">
          {filtered.map((j) => (
            <article className="panel project-card" key={j.id}>
              <div className="project-card-top">
                <span className="badge">{j.favorite ? '★ 즐겨찾기' : `관심도 ${j.interest}`}</span>
                <span className="muted">{deadlineLabel(j.deadline)}</span>
              </div>
              <p className="project-company">{j.company}</p>
              <h2>
                <Link to={`/jobs/${j.id}`}>{j.title}</Link>
              </h2>
              <p>
                {j.role} · {j.location || '지역 미기재'}
              </p>
              <p className="muted">
                {j.workMode} · {j.skills.join(', ') || '기술 미기재'}
              </p>
              <div className="project-card-footer">
                <Link className="text-link" to={`/jobs/${j.id}`}>
                  요구사항 검토 →
                </Link>
                <div className="row-actions">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(j)}>
                    수정
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(j)}>
                    삭제
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="jobs-table-scroll" tabIndex={0} role="region" aria-label="채용공고 표">
          <table className="jobs-table">
            <thead>
              <tr>
                {['기업 / 공고', '직무', '기술스택', '마감일', '관심도', '관리'].map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link to={`/jobs/${j.id}`}>
                      {j.company} · {j.title}
                    </Link>
                  </td>
                  <td>{j.role}</td>
                  <td>{j.skills.join(', ') || '미기재'}</td>
                  <td>
                    {j.deadline || '미기재'} · {deadlineLabel(j.deadline)}
                  </td>
                  <td>
                    {j.favorite ? '★ ' : ''}
                    {j.interest}
                  </td>
                  <td>
                    <Button variant="ghost" onClick={() => setEditing(j)}>
                      수정
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleting(j)}>
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <JobForm job={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <ConfirmDialog
          title="채용공고를 삭제할까요?"
          description="공고와 요구사항·분석이 삭제됩니다. 기존 지원 기록과 제출 증빙은 보존됩니다."
          onClose={() => setDeleting(null)}
          onConfirm={() => jobsRepository.deleteJob(deleting.id)}
        />
      )}
    </div>
  );
}

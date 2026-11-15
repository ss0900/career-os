import {
  ArrowUpRight,
  CalendarDays,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ExternalLinkButton, PageHeading, Tags } from '../components/common';
import { ProjectForm } from '../components/record-forms';
import { Button } from '../components/ui/button';
import { ConfirmDialog, Dialog } from '../components/ui/dialog';
import { repository } from '../data/repository';
import type { Project } from '../data/schema';
import { useAppData, useNotice } from '../hooks/app-context';
import { dateLabel, period } from '../lib/utils';

export function ProjectsPage() {
  const { projects, careers } = useAppData();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const notice = useNotice();
  const selected = projects.find((project) => project.id === params.get('view'));
  const companyName = (project: Project) =>
    careers.find((career) => career.id === project.careerId)?.company ?? '개인 / 기타';
  const filtered = projects.filter(
    (project) =>
      `${project.name} ${project.summary} ${project.role} ${project.skills.join(' ')} ${companyName(project)}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) &&
      (filter === 'all' || (filter === 'active' ? project.current : !project.current)),
  );
  return (
    <>
      <PageHeading
        eyebrow="PROJECT LIBRARY"
        title="프로젝트"
        description="무엇을 만들었는지보다, 어떻게 기여했는지 기록해 보세요."
        action={
          <Button onClick={() => setParams({ new: '1' })}>
            <Plus size={17} />
            프로젝트 추가
          </Button>
        }
      />
      <div className="project-toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="프로젝트 검색"
            placeholder="프로젝트명, 회사, 기술 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          aria-label="프로젝트 상태 필터"
          className="input filter-select"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">전체 상태</option>
          <option value="active">진행 중</option>
          <option value="done">완료</option>
        </select>
        <span className="result-count">총 {filtered.length}개</span>
      </div>
      {filtered.length ? (
        <div className="project-grid">
          {filtered.map((project) => (
            <article className="panel project-card" key={project.id}>
              <div className="project-card-top">
                <span className="project-symbol">
                  <FolderKanban size={23} />
                </span>
                <span className={`badge ${project.current ? 'green' : ''}`}>
                  {project.current ? '진행 중' : '완료'}
                </span>
              </div>
              <p className="project-company">{companyName(project)}</p>
              <h2>
                <button onClick={() => setParams({ view: project.id })}>{project.name}</button>
              </h2>
              <p className="project-summary">
                {project.summary || '프로젝트 개요를 추가해 보세요.'}
              </p>
              <div className="project-meta">
                <span>
                  <CalendarDays size={14} />
                  {period(project.startDate, project.endDate, project.current)}
                </span>
                <span>
                  <Users size={14} />
                  {project.role || '역할 미입력'}
                  {project.teamSize ? ` · ${project.teamSize}명` : ''}
                </span>
              </div>
              <Tags items={project.skills} />
              <div className="project-card-footer">
                <button className="text-link" onClick={() => setParams({ view: project.id })}>
                  기록 보기
                  <ArrowUpRight size={15} />
                </button>
                <div className="row-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${project.name} 수정`}
                    onClick={() => setEditing(project)}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${project.name} 삭제`}
                    onClick={() => setDeleting(project)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title={projects.length ? '검색 결과가 없어요' : '첫 프로젝트가 다음 기회의 시작이에요'}
            description={
              projects.length
                ? '다른 검색어를 입력하거나 필터를 바꿔 보세요.'
                : '문제 해결 과정, 나의 역할, 성과를 하나씩 모아 보세요.'
            }
            action={
              projects.length ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                >
                  검색 초기화
                </Button>
              ) : (
                <Button onClick={() => setParams({ new: '1' })}>
                  <Plus size={16} />
                  프로젝트 추가
                </Button>
              )
            }
          />
        </section>
      )}
      {selected && (
        <Dialog
          wide
          title={selected.name}
          description={`${companyName(selected)} · ${period(selected.startDate, selected.endDate, selected.current)}`}
          onClose={() => setParams({})}
        >
          <div className="project-detail">
            <p className="detail-lead">{selected.summary || '개요 미입력'}</p>
            <p className="muted">
              {selected.role || '역할 미입력'}
              {selected.teamSize ? ` · ${selected.teamSize}명 참여` : ''}
            </p>
            <Tags items={selected.skills} />
            {(
              [
                ['problem', '문제'],
                ['goal', '목표'],
                ['contribution', '본인 역할과 기여'],
                ['techReason', '기술 선택'],
                ['implementation', '설계 및 구현'],
                ['troubleshooting', '문제 해결 과정'],
                ['outcome', '결과 및 성과'],
                ['reflection', '회고'],
              ] as const
            ).map(([key, title]) =>
              selected[key] ? (
                <section className="record-section" key={key}>
                  <h3>{title}</h3>
                  <p>{selected[key]}</p>
                </section>
              ) : null,
            )}
            {!selected.contribution && (
              <p className="inline-note">
                본인의 담당 범위와 기여를 추가하면 경험을 더 구체적으로 설명할 수 있어요.
              </p>
            )}
            <div className="contact-row">
              <ExternalLinkButton href={selected.githubUrl}>GitHub</ExternalLinkButton>
              <ExternalLinkButton href={selected.demoUrl}>데모</ExternalLinkButton>
              <ExternalLinkButton href={selected.resourceUrl}>참고자료</ExternalLinkButton>
            </div>
            <p className="muted">최근 수정 · {dateLabel(selected.updatedAt)}</p>
          </div>
          <div className="dialog-footer">
            <Button variant="outline" onClick={() => setParams({})}>
              닫기
            </Button>
            <Button
              onClick={() => {
                setParams({});
                setEditing(selected);
              }}
            >
              <Pencil size={15} />
              프로젝트 수정
            </Button>
          </div>
        </Dialog>
      )}
      {(editing || params.get('new') === '1') && (
        <ProjectForm
          project={editing ?? undefined}
          careers={careers}
          onClose={() => {
            setEditing(null);
            setParams({});
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="프로젝트를 삭제할까요?"
          description={`‘${deleting.name}’의 모든 기록이 삭제됩니다. 되돌리려면 JSON 백업이 필요합니다.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await repository.deleteProject(deleting.id);
            notice('프로젝트를 삭제했습니다.');
          }}
        />
      )}
    </>
  );
}

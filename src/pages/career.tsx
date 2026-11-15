import { BriefcaseBusiness, Building2, Mail, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ExternalLinkButton, PageHeading, Tags } from '../components/common';
import { CareerForm, ProfileForm } from '../components/record-forms';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/dialog';
import { repository } from '../data/repository';
import type { Career } from '../data/schema';
import { useAppData, useNotice } from '../hooks/app-context';
import { period } from '../lib/utils';

export function CareerPage() {
  const { profile, careers, projects } = useAppData();
  const notice = useNotice();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Career | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Career | 'profile' | null>(null);
  return (
    <>
      <PageHeading
        eyebrow="MY CAREER"
        title="내 경력"
        description="나를 소개하는 정보와 지나온 경험을 한곳에 정리하세요."
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus size={17} />
            경력 추가
          </Button>
        }
      />
      <section className="panel profile-panel">
        <div className="section-heading">
          <h2>기본 프로필</h2>
          {profile && (
            <div className="row-actions">
              <Button variant="ghost" size="sm" onClick={() => setParams({ edit: 'profile' })}>
                <Pencil size={14} />
                수정
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="프로필 삭제"
                onClick={() => setDeleting('profile')}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )}
        </div>
        {profile ? (
          <div className="profile-body">
            <div className="profile-identity">
              <span className="profile-avatar">{profile.name.slice(0, 1)}</span>
              <div>
                <span className="eyebrow">{profile.targetRole || '희망 직무를 추가해 보세요'}</span>
                <h2>{profile.name}</h2>
                <p>{profile.headline || '나를 소개하는 한 문장을 적어 보세요.'}</p>
                <div className="contact-row">
                  {profile.email && (
                    <span>
                      <Mail size={14} />
                      {profile.email}
                    </span>
                  )}
                  {profile.phone && <span>{profile.phone}</span>}
                </div>
                <div className="contact-row">
                  <ExternalLinkButton href={profile.githubUrl}>GitHub</ExternalLinkButton>
                  <ExternalLinkButton href={profile.portfolioUrl}>포트폴리오</ExternalLinkButton>
                </div>
              </div>
            </div>
            <div className="profile-details">
              <div>
                <h3>핵심역량</h3>
                {profile.competencies.length ? (
                  <ul className="competency-list">
                    {profile.competencies.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">아직 입력하지 않았어요.</p>
                )}
              </div>
              <div>
                <h3>기술스택</h3>
                {profile.skills.length ? (
                  <Tags items={profile.skills} />
                ) : (
                  <p className="muted">아직 입력하지 않았어요.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={UserRound}
            title="나의 이야기를 시작해 볼까요?"
            description="이름, 직무, 핵심역량을 정리해 두면 다음 준비가 한결 편해집니다."
            action={
              <Button onClick={() => setParams({ edit: 'profile' })}>
                <Plus size={16} />
                프로필 만들기
              </Button>
            }
          />
        )}
      </section>
      <div className="list-heading">
        <h2>
          경력 타임라인 <span>{careers.length}</span>
        </h2>
        <p>회사별 역할과 프로젝트를 함께 관리하세요.</p>
      </div>
      {careers.length ? (
        <div className="career-list">
          {[...careers]
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
            .map((career) => (
              <article className="panel career-card" key={career.id}>
                <div className="career-card-heading">
                  <span className="company-symbol">
                    <Building2 size={23} />
                  </span>
                  <div>
                    <div className="title-with-badge">
                      <h3>{career.company}</h3>
                      {career.current && <span className="badge green">재직 중</span>}
                    </div>
                    <p>
                      {career.position}
                      {career.department && ` · ${career.department}`}
                    </p>
                    <small>{period(career.startDate, career.endDate, career.current)}</small>
                  </div>
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${career.company} 수정`}
                      onClick={() => setEditing(career)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${career.company} 삭제`}
                      onClick={() => setDeleting(career)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                {career.responsibilities && (
                  <div className="record-section">
                    <h4>담당업무</h4>
                    <p>{career.responsibilities}</p>
                  </div>
                )}
                {career.achievements && (
                  <div className="record-section">
                    <h4>성과 및 주요 기여</h4>
                    <p>{career.achievements}</p>
                  </div>
                )}
                <div className="linked-projects">
                  <span>연결된 프로젝트</span>
                  {projects.filter((project) => project.careerId === career.id).length ? (
                    projects
                      .filter((project) => project.careerId === career.id)
                      .map((project) => (
                        <Link key={project.id} to={`/projects?view=${project.id}`}>
                          {project.name}
                        </Link>
                      ))
                  ) : (
                    <span className="muted">아직 연결된 프로젝트가 없어요.</span>
                  )}
                </div>
              </article>
            ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            icon={BriefcaseBusiness}
            title="첫 경력을 기록해 보세요"
            description="담당업무와 기여를 기록하고, 관련 프로젝트를 연결할 수 있어요."
            action={
              <Button variant="outline" onClick={() => setEditing('new')}>
                <Plus size={16} />
                경력 추가
              </Button>
            }
          />
        </section>
      )}
      {params.get('edit') === 'profile' && (
        <ProfileForm profile={profile} onClose={() => setParams({})} />
      )}
      {editing && (
        <CareerForm
          career={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={
            deleting === 'profile'
              ? '프로필을 삭제할까요?'
              : `${deleting.company} 경력을 삭제할까요?`
          }
          description={
            deleting === 'profile'
              ? '프로필 정보만 삭제됩니다. 경력과 프로젝트는 유지됩니다. 이 작업은 되돌릴 수 없으니 필요한 경우 먼저 백업해 주세요.'
              : '경력 정보가 삭제됩니다. 연결된 프로젝트는 보존되며 개인 / 기타 프로젝트로 변경됩니다. 필요한 경우 먼저 백업해 주세요.'
          }
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (deleting === 'profile') await repository.deleteProfile();
            else await repository.deleteCareer(deleting.id);
            notice('삭제했습니다.');
          }}
        />
      )}
    </>
  );
}

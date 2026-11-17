import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Circle,
  Code2,
  FolderKanban,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { downloadBackup } from '../data/backup';
import { summarize } from '../data/summary';
import { useAppData, useNotice } from '../hooks/app-context';
import { dateLabel, errorMessage } from '../lib/utils';
import { EmptyState, PageHeading, Tags } from '../components/common';
import { Button } from '../components/ui/button';
import { JobsDashboard } from '../components/jobs/dashboard';
import { PracticeDashboard } from '../components/interview/dashboard';

export function Dashboard() {
  const { profile, careers, projects, settings } = useAppData();
  const summary = summarize(profile, careers, projects);
  const notice = useNotice();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const steps = [
    {
      title: '나를 소개하기',
      detail: '프로필과 핵심역량을 정리하세요.',
      done: !!profile,
      href: '/career?edit=profile',
    },
    {
      title: '경험을 기록하기',
      detail: '첫 프로젝트로 나의 기여를 남기세요.',
      done: projects.length > 0,
      href: '/projects?new=1',
    },
    {
      title: '기록을 안전하게 보관하기',
      detail: 'JSON 백업으로 소중한 기록을 지키세요.',
      done: !!settings?.lastBackupAt,
      href: '/settings',
    },
  ];
  const stats = [
    {
      label: '등록한 경력',
      number: summary.careerCount,
      unit: '개',
      icon: BriefcaseBusiness,
      detail: '나의 커리어 타임라인',
      tone: 'blue',
    },
    {
      label: '프로젝트',
      number: summary.projectCount,
      unit: '개',
      icon: FolderKanban,
      detail: `현재 진행 중 ${summary.activeProjectCount}개`,
      tone: 'purple',
    },
    {
      label: '기술스택',
      number: summary.skills.length,
      unit: '개',
      icon: Code2,
      detail: '프로필 · 프로젝트에서 모은 기술',
      tone: 'green',
    },
    {
      label: '프로필 작성',
      number: summary.completedProfileFields,
      unit: `/ ${summary.totalProfileFields}`,
      icon: Layers3,
      detail: '이름 · 직무 · 소개 · 이메일 · 역량 · 기술',
      tone: 'orange',
    },
  ];
  async function backup() {
    setExporting(true);
    setError('');
    try {
      await downloadBackup();
      notice('백업 다운로드를 요청했습니다. 다운로드 폴더를 확인해 주세요.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MY WORKSPACE"
        title="나의 다음 챕터를 준비하세요"
        description="흩어져 있던 경험을 모아, 다음 기회의 시작으로."
        action={
          <Button asChild>
            <Link to="/projects?new=1">
              <span aria-hidden="true">＋</span> 프로젝트 추가
            </Link>
          </Button>
        }
      />
      <JobsDashboard />
      <PracticeDashboard />
      <section className="welcome-banner">
        <div>
          <span className="banner-label">
            <span className="status-dot" /> YOUR CAREER, YOUR PACE
          </span>
          <h2>
            {profile
              ? `${profile.name}님, 오늘의 경험도 기록해 보세요.`
              : '좋은 커리어는 작은 기록에서 시작됩니다.'}
          </h2>
          <p>
            {profile?.headline ||
              '무엇을 만들었고, 어떤 문제를 해결했나요? 나만의 커리어 자산을 쌓아 보세요.'}
          </p>
          <Link to={profile ? '/career' : '/career?edit=profile'}>
            {profile ? '내 경력 살펴보기' : '내 프로필부터 시작하기'}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-card art-back">
            <span />
            <span />
            <span />
          </div>
          <div className="art-card art-front">
            <div className="art-avatar">
              <Sparkles size={22} />
            </div>
            <span />
            <span />
            <div className="art-tags">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="art-check">
            <Check size={21} />
          </div>
        </div>
      </section>
      <div className="stats-grid">
        {stats.map(({ label, number, unit, icon: Icon, detail, tone }) => (
          <section className="stat-card" key={label}>
            <div className="stat-label">
              {label}
              <span className={`stat-icon ${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <p className="stat-number">
              {number}
              <span>{unit}</span>
            </p>
            <p className="stat-detail">{detail}</p>
          </section>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>내 커리어 시작하기</h2>
                <p>하나씩 채우면 준비가 더 쉬워져요.</p>
              </div>
              <span className="badge">{steps.filter((step) => step.done).length} / 3 완료</span>
            </div>
            <div className="steps">
              {steps.map((step, index) => (
                <Link to={step.href} className="step-row" key={step.title}>
                  <span className={`step-number ${step.done ? 'done' : ''}`}>
                    {step.done ? <Check size={17} /> : `0${index + 1}`}
                  </span>
                  <span>
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                  </span>
                  <ChevronRight size={17} />
                </Link>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>최근 프로젝트</h2>
                <p>다음 이력서의 근거가 되는 경험들</p>
              </div>
              <Link className="text-link" to="/projects">
                전체 보기
                <ArrowUpRight size={15} />
              </Link>
            </div>
            {projects.length ? (
              <div className="recent-list">
                {projects.slice(0, 3).map((project) => (
                  <Link key={project.id} to={`/projects?view=${project.id}`} className="recent-row">
                    <span className="project-symbol">
                      <FolderKanban size={21} />
                    </span>
                    <span>
                      <strong>{project.name}</strong>
                      <small>
                        {project.role || '역할 미입력'} · {dateLabel(project.updatedAt)}
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="아직 기록된 프로젝트가 없어요"
                description="업무, 사이드 프로젝트, 작은 실험까지. 첫 경험을 남겨 보세요."
                action={
                  <Button variant="outline" asChild>
                    <Link to="/projects?new=1">
                      첫 프로젝트 기록하기
                      <ArrowRight size={15} />
                    </Link>
                  </Button>
                }
              />
            )}
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="panel">
            <div className="section-heading">
              <h2>기록 점검</h2>
              <span className="small-icon">
                <Circle size={17} />
              </span>
            </div>
            <div className="review-content">
              {summary.projectsNeedingEvidence.length ? (
                <>
                  <p className="review-number">
                    {summary.projectsNeedingEvidence.length}
                    <span>개 프로젝트</span>
                  </p>
                  <p>본인 기여 또는 결과를 더 기록할 수 있어요.</p>
                  <Link
                    className="text-link"
                    to={`/projects?view=${summary.projectsNeedingEvidence[0].id}`}
                  >
                    기록 이어가기
                    <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <>
                  <p className="review-title">
                    {projects.length
                      ? '기여와 성과가 기록되어 있어요'
                      : '경험을 쌓을 준비가 되었어요'}
                  </p>
                  <p>프로젝트의 본인 기여와 결과 입력 여부를 여기서 확인할 수 있어요.</p>
                </>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>나의 기술스택</h2>
              <Code2 size={18} />
            </div>
            <div className="stack-content">
              {summary.skills.length ? (
                <Tags items={summary.skills} />
              ) : (
                <p className="muted">
                  프로필이나 프로젝트에 기술을 추가하면 이곳에 모아 볼 수 있어요.
                </p>
              )}
            </div>
          </section>
          <section className="backup-card">
            <ShieldCheck size={25} />
            <h2>나의 기록, 안전하게</h2>
            <p>
              기록은 이 브라우저에 저장돼요.
              <br />
              브라우저 데이터를 지우기 전에
              <br />꼭 백업해 주세요.
            </p>
            <div className="backup-date">
              최근 백업 요청 · {dateLabel(settings?.lastBackupAt ?? undefined)}
            </div>
            <Button variant="outline" onClick={() => void backup()} disabled={exporting}>
              <ArrowDownToLine size={15} />
              {exporting ? '준비 중…' : 'JSON 백업하기'}
            </Button>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
          </section>
        </aside>
      </div>
      <p className="workspace-footnote">
        <ShieldCheck size={13} />
        나의 데이터는 이 브라우저에만 저장되며, 자동으로 공개되지 않습니다.
      </p>
    </>
  );
}

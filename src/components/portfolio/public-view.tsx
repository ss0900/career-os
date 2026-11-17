import { useState } from 'react';
import type { PublicPortfolio } from '../../data/public-portfolio-schema';
import './public.css';

const detailLabels = {
  background: '목적과 배경',
  problem: '해결하려던 문제',
  role: '역할과 담당 범위',
  techReason: '기술 선택 이유',
  architecture: '시스템 아키텍처',
  features: '주요 기능',
  implementation: '구현 과정',
  troubleshooting: '기술적 문제 해결',
  outcome: '결과와 성과',
  reflection: '한계와 개선 방향',
} as const;
function PublicLink({ href, children }: { href: string; children: string }) {
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  ) : null;
}
export function PublicPortfolioView({
  data,
  imageUrls,
  assetBase = './portfolio/',
}: {
  data: PublicPortfolio;
  imageUrls?: Record<string, string>;
  assetBase?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const project = selected === null ? undefined : data.projects[selected];
  return (
    <div className="public-portfolio">
      <header className="pf-nav">
        <strong>{data.title}</strong>
        <span>DEVELOPER PORTFOLIO</span>
      </header>
      {project ? (
        <article className="pf-detail">
          <button className="pf-back" onClick={() => setSelected(null)}>
            ← 프로젝트 목록
          </button>
          <p className="pf-eyebrow">PROJECT / {String((selected ?? 0) + 1).padStart(2, '0')}</p>
          <h1>{project.name}</h1>
          <p className="pf-lead">{project.summary}</p>
          <div className="pf-tags">
            {project.skills.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
          {Object.entries(detailLabels).map(([key, label]) =>
            project[key as keyof typeof detailLabels] ? (
              <section key={key}>
                <h2>{label}</h2>
                <p>{project[key as keyof typeof detailLabels]}</p>
              </section>
            ) : null,
          )}
          {project.images.map((i) => (
            <figure key={i.path}>
              {imageUrls && !imageUrls[i.path] ? (
                <p>이미지 파일을 다시 연결해 주세요.</p>
              ) : (
                <img
                  src={imageUrls ? imageUrls[i.path] : assetBase + i.path}
                  alt={i.alt}
                  loading="lazy"
                />
              )}
              <figcaption>{i.caption}</figcaption>
            </figure>
          ))}
          <div className="pf-links">
            <PublicLink href={project.githubUrl}>GitHub</PublicLink>
            <PublicLink href={project.demoUrl}>Demo</PublicLink>
          </div>
        </article>
      ) : (
        <>
          <section className="pf-hero">
            <p className="pf-eyebrow">{data.role || 'SELECTED WORK'}</p>
            <h1>{data.headline || data.title}</h1>
            {data.about && <p className="pf-lead">{data.about}</p>}
            <div className="pf-links">
              <PublicLink href={data.githubUrl}>GitHub</PublicLink>
              <PublicLink href={data.demoUrl}>Demo</PublicLink>
              {data.contact && <a href={`mailto:${data.contact}`}>연락하기 ↗</a>}
            </div>
          </section>
          {!!data.competencies.length && (
            <section className="pf-section">
              <p className="pf-eyebrow">01 / APPROACH</p>
              <h2>핵심역량</h2>
              <ul>
                {data.competencies.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}
          {!!data.skills.length && (
            <section className="pf-section">
              <p className="pf-eyebrow">02 / TOOLKIT</p>
              <h2>기술스택</h2>
              <div className="pf-tags">
                {data.skills.map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
            </section>
          )}
          {!!data.careers.length && (
            <section className="pf-section">
              <p className="pf-eyebrow">03 / EXPERIENCE</p>
              <h2>경력</h2>
              {data.careers.map((c, i) => (
                <article className="pf-career" key={i}>
                  <span>{c.period}</span>
                  <div>
                    <h3>{c.company}</h3>
                    <strong>{c.position}</strong>
                    <p>{c.description}</p>
                  </div>
                </article>
              ))}
            </section>
          )}
          {!!data.projects.length && (
            <section className="pf-section">
              <p className="pf-eyebrow">04 / SELECTED PROJECTS</p>
              <h2>주요 프로젝트</h2>
              {data.projects.map((p, i) => (
                <article className="pf-project" key={i}>
                  <span className="pf-number">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{p.name}</h3>
                    <p>{p.summary}</p>
                    <div className="pf-tags">
                      {p.skills.map((s, n) => (
                        <span key={n}>{s}</span>
                      ))}
                    </div>
                    <button onClick={() => setSelected(i)} aria-label={`${p.name} 프로젝트 상세`}>
                      문제 해결 과정 살펴보기 →
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
          {data.qualifications && (
            <section className="pf-section">
              <p className="pf-eyebrow">05 / CREDENTIALS</p>
              <h2>수상 및 자격증</h2>
              <p>{data.qualifications}</p>
            </section>
          )}
          {data.contact && (
            <section className="pf-contact">
              <p className="pf-eyebrow">LET’S TALK</p>
              <h2>함께 만들 기회를 기다립니다.</h2>
              <a href={`mailto:${data.contact}`}>{data.contact}</a>
            </section>
          )}
        </>
      )}
      <footer className="pf-footer">{data.title} · Selected work & experience</footer>
    </div>
  );
}

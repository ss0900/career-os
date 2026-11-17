import type { Career, Profile, Project } from './schema';
import type { ResumeDocument } from './resume-schema';
import type { PortfolioContent, PortfolioProject } from './portfolio-schema';
import { publicPortfolioSchema, type PublicPortfolio } from './public-portfolio-schema';

export function portfolioProject(p: Project): PortfolioProject {
  return {
    id: crypto.randomUUID(),
    sourceId: p.id,
    included: false,
    name: p.name,
    summary: p.summary,
    background: p.goal,
    problem: p.problem,
    role: p.role + (p.contribution ? '\n' + p.contribution : ''),
    skills: [...p.skills],
    techReason: p.techReason,
    architecture: '',
    features: '',
    implementation: p.implementation,
    troubleshooting: p.troubleshooting,
    outcome: p.outcome,
    reflection: p.reflection,
    githubUrl: p.githubUrl,
    demoUrl: p.demoUrl,
    images: [],
  };
}
export function createPortfolio(
  profile?: Profile,
  careers: Career[] = [],
  projects: Project[] = [],
  resume?: ResumeDocument,
): PortfolioContent {
  const p = resume?.profile ?? profile;
  const content: PortfolioContent = {
    title: '새 포트폴리오',
    headline: p?.headline ?? '',
    role: resume?.role ?? p?.targetRole ?? '',
    about: '',
    competencies: [...(p?.competencies ?? [])],
    skills: [...(p?.skills ?? [])],
    careers: careers.map((c) => ({
      id: crypto.randomUUID(),
      sourceId: c.id,
      included: false,
      company: c.company,
      position: c.position,
      period: `${c.startDate} ~ ${c.current ? '현재' : c.endDate}`,
      description: c.responsibilities,
    })),
    projects: projects.map(portfolioProject),
    qualifications:
      resume?.qualifications.map((q) => `${q.name} · ${q.issuer} · ${q.date}`).join('\n') ?? '',
    githubUrl: p?.githubUrl ?? '',
    demoUrl: '',
    contact: '',
    sections: [],
    status: '작성 중',
  };
  if (resume) {
    content.careers = resume.careers.map((c) => ({
      id: crypto.randomUUID(),
      sourceId: c.sourceId,
      included: false,
      company: c.company,
      position: c.position,
      period: `${c.startDate} ~ ${c.current ? '현재' : c.endDate}`,
      description: c.responsibilities,
    }));
    content.projects = resume.projects.map((p) => ({
      id: crypto.randomUUID(),
      sourceId: p.sourceId,
      included: false,
      name: p.name,
      summary: p.summary,
      background: '',
      problem: '',
      role: p.role + '\n' + p.contribution,
      skills: [...p.skills],
      techReason: '',
      architecture: '',
      features: '',
      implementation: p.implementation,
      troubleshooting: '',
      outcome: p.achievements
        .filter((a) => a.included)
        .map((a) => a.text)
        .join('\n'),
      reflection: '',
      githubUrl: p.githubUrl,
      demoUrl: p.demoUrl,
      images: [],
    }));
  }
  return content;
}
export const imageExtension = (mime: string) =>
  mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';
export function publicData(content: PortfolioContent): PublicPortfolio {
  const has = (s: PortfolioContent['sections'][number]) => content.sections.includes(s);
  // Explicit allowlist: never serialize/spread private source objects into public data.
  return publicPortfolioSchema.parse({
    format: 'career-os-public-portfolio',
    version: 1,
    title: content.title,
    headline: has('소개') ? content.headline : '',
    role: has('소개') ? content.role : '',
    about: has('소개') ? content.about : '',
    competencies: has('핵심역량') ? [...content.competencies] : [],
    skills: has('기술스택') ? [...content.skills] : [],
    careers: has('경력')
      ? content.careers
          .filter((c) => c.included)
          .map((c) => ({
            company: c.company,
            position: c.position,
            period: c.period,
            description: c.description,
          }))
      : [],
    projects: has('프로젝트')
      ? content.projects
          .filter((p) => p.included)
          .map((p) => ({
            name: p.name,
            summary: p.summary,
            background: p.background,
            problem: p.problem,
            role: p.role,
            skills: [...p.skills],
            techReason: p.techReason,
            architecture: p.architecture,
            features: p.features,
            implementation: p.implementation,
            troubleshooting: p.troubleshooting,
            outcome: p.outcome,
            reflection: p.reflection,
            githubUrl: p.githubUrl,
            demoUrl: p.demoUrl,
            images: p.images
              .filter((i) => i.approved)
              .map((i) => ({
                path: `images/${i.id}.${imageExtension(i.mime)}`,
                alt: i.alt,
                caption: i.caption,
              })),
          }))
      : [],
    qualifications: has('수상 및 자격증') ? content.qualifications : '',
    githubUrl: has('링크') ? content.githubUrl : '',
    demoUrl: has('링크') ? content.demoUrl : '',
    contact: has('연락처') ? content.contact : '',
  });
}
export function publicationWarnings(content: PortfolioContent) {
  return [
    !content.title.trim() && '공개 제목을 입력해 주세요.',
    !content.sections.length && '공개할 섹션을 선택해 주세요.',
    ...content.projects
      .filter((p) => p.included && content.sections.includes('프로젝트'))
      .flatMap((p) => [
        !p.name.trim() && '공개 프로젝트명을 입력해 주세요.',
        ...p.images
          .filter((i) => i.approved)
          .map((i) => !i.alt.trim() && '공개 이미지에 대체 텍스트가 필요합니다.'),
      ]),
  ].filter(Boolean) as string[];
}

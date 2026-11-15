import { emptyProfile, type Career, type Profile, type Project } from './schema';
import { sectionKeys, type ResumeCareer, type ResumeDocument, type ResumeProject, type SectionKey } from './resume-schema';

export type ResumeSources = { profile?: Profile; careers: Career[]; projects: Project[] };
export const makeAchievements = (text: string) => text.split('\n').filter((line) => line.trim()).map((line) => ({ id: crypto.randomUUID(), text: line, evidence: '', included: true }));
export function copyCareer(item: Career): ResumeCareer {
  return { sourceId: item.id, sourceUpdatedAt: item.updatedAt, included: true, company: item.company, department: item.department, position: item.position, startDate: item.startDate, endDate: item.endDate, current: item.current, responsibilities: item.responsibilities, achievements: makeAchievements(item.achievements) };
}
export function copyProject(item: Project): ResumeProject {
  return { sourceId: item.id, sourceUpdatedAt: item.updatedAt, included: true, careerId: item.careerId, name: item.name, summary: item.summary, role: item.role, startDate: item.startDate, endDate: item.endDate, current: item.current, contribution: item.contribution, implementation: item.implementation, skills: [...item.skills], showSkills: true, achievements: makeAchievements(item.outcome), githubUrl: item.githubUrl, demoUrl: item.demoUrl };
}
export function copyProfile(profile?: Profile): ResumeDocument['profile'] {
  const result = structuredClone(emptyProfile);
  if (profile) for (const key of Object.keys(result) as (keyof typeof result)[]) Object.assign(result, { [key]: structuredClone(profile[key]) });
  return result;
}
export function createDocument(sources: ResumeSources): ResumeDocument {
  return { title: '새 이력서', company: '', role: sources.profile?.targetRole ?? '', format: 'resume', note: '', profile: copyProfile(sources.profile), sections: sectionKeys.map((key) => ({ key, visible: true })), careers: sources.careers.map(copyCareer), projects: sources.projects.map(copyProject), education: [], qualifications: [], languages: [] };
}
export function moveItem<T>(items: T[], index: number, direction: number): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export const sectionVisible = (document: ResumeDocument, key: SectionKey) => document.sections.some((section) => section.key === key && section.visible);
export function isSafeLink(value: string): boolean {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}
export function validResumePeriod(item: { startDate: string; endDate: string; current: boolean }): boolean {
  const month = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
  return month.test(item.startDate) && (item.current || (month.test(item.endDate) && item.endDate >= item.startDate));
}
export type QualityIssue = { level: 'error' | 'warning'; message: string };
export function checkResume(document: ResumeDocument): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const add = (level: QualityIssue['level'], message: string) => issues.push({ level, message });
  if (!document.profile.name.trim() || !sectionVisible(document, 'profile')) add('error', '이름과 연락처 섹션을 표시하고 이름을 입력해 주세요.');
  if (!document.profile.email.trim() && !document.profile.phone.trim()) add('error', '이메일 또는 연락처를 입력해 주세요.');
  if (document.profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.profile.email)) add('error', '이메일 형식을 확인해 주세요.');
  if (!document.role.trim()) add('error', '지원 직무를 입력해 주세요.');
  if (!document.title.trim()) add('warning', '목록에서 구분할 수 있도록 이력서 제목을 입력해 주세요.');
  if (!document.profile.headline.trim()) add('warning', '지원 직무를 설명하는 한 줄 소개를 작성해 주세요.');
  const projects = sectionVisible(document, 'projects') ? document.projects.filter((item) => item.included) : [];
  const careers = sectionVisible(document, 'careers') ? document.careers.filter((item) => item.included) : [];
  for (const item of [...careers, ...projects]) {
    const name = 'company' in item ? item.company : item.name;
    if (!validResumePeriod(item)) add('error', `${name}: 기간을 확인해 주세요.`);
    for (const achievement of item.achievements.filter((entry) => entry.included)) if (!achievement.evidence.trim()) add('warning', `${name}: 성과 ‘${achievement.text.slice(0, 35)}’의 근거를 추가해 주세요.`);
  }
  for (const project of projects) {
    if (!project.role.trim()) add('error', `${project.name}: 담당 역할을 입력해 주세요.`);
    if (!project.skills.length) add('warning', `${project.name}: 사용 기술을 입력해 주세요.`);
    if (!project.achievements.some((item) => item.included && item.text.trim())) add('warning', `${project.name}: 확인 가능한 성과를 기록해 주세요.`);
    if ([project.summary, project.contribution, project.implementation].some((value) => value.length > 1500)) add('warning', `${project.name}: 1,500자 이상의 설명을 간결하게 정리해 보세요.`);
  }
  const links = sectionVisible(document, 'links') ? [document.profile.githubUrl, document.profile.portfolioUrl, ...projects.flatMap((item) => [item.githubUrl, item.demoUrl])] : [];
  if (links.some((value) => value.trim() && !isSafeLink(value.trim()))) add('error', '잘못된 링크가 있습니다. http/https 주소를 확인해 주세요.');
  if (!document.profile.skills.length && !projects.some((project) => project.skills.length)) add('warning', '사용 기술을 입력해 주세요.');
  if (sectionVisible(document, 'education')) for (const item of document.education) if (!item.school.trim() || (item.startDate && item.endDate && item.startDate > item.endDate)) add('error', '학력의 학교명과 기간을 확인해 주세요.');
  if (sectionVisible(document, 'qualifications') && document.qualifications.some((item) => !item.name.trim())) add('error', '자격증 및 수상 이름을 입력해 주세요.');
  if (sectionVisible(document, 'languages') && document.languages.some((item) => !item.name.trim())) add('error', '외국어 이름을 입력해 주세요.');
  return issues;
}

// Reconstruct for comparison only. This never writes to a draft or original record.
export function latestSourceDocument(document: ResumeDocument, sources: ResumeSources): ResumeDocument {
  const careers = document.careers.flatMap((item) => { const source = sources.careers.find((entry) => entry.id === item.sourceId); return source ? [{ ...copyCareer(source), included: item.included }] : []; });
  const projects = document.projects.flatMap((item) => { const source = sources.projects.find((entry) => entry.id === item.sourceId); return source ? [{ ...copyProject(source), included: item.included, careerId: careers.some((career) => career.sourceId === source.careerId) ? source.careerId : '' }] : []; });
  return { ...structuredClone(document), profile: copyProfile(sources.profile), careers, projects };
}
const fieldLabels: Record<string, string> = { title: '제목', company: '기업', role: '직무 / 역할', format: '문서 종류', note: '추가 소개', profile: '프로필', name: '이름', email: '이메일', phone: '연락처', targetRole: '희망 직무', headline: '한 줄 소개', competencies: '핵심역량', skills: '기술', githubUrl: 'GitHub', portfolioUrl: '포트폴리오', sections: '섹션', key: '종류', visible: '표시', careers: '경력', projects: '프로젝트', included: '포함', department: '부서', position: '직책', startDate: '시작일', endDate: '종료일', current: '진행 중', responsibilities: '담당업무', achievements: '성과', text: '문구', evidence: '근거', summary: '개요', contribution: '기여', implementation: '설계 및 구현', showSkills: '기술 표시', demoUrl: '데모', education: '학력', school: '학교', degree: '학위', major: '전공', detail: '설명', qualifications: '자격증 / 수상', category: '분류', issuer: '기관', date: '날짜', languages: '외국어', level: '수준', test: '시험 / 점수', careerId: '연결 경력' };
export function compareDocuments(before: ResumeDocument, after: ResumeDocument) {
  function flatten(value: unknown, path = '', result: Record<string, string> = {}) {
    if (Array.isArray(value)) {
      if (value.every((item) => typeof item === 'string')) result[path] = value.join(', ');
      else value.forEach((item, index) => flatten(item, `${path} ${index + 1}`, result));
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) if (!['id', 'sourceId', 'sourceUpdatedAt'].includes(key)) flatten(child, `${path}${path ? ' · ' : ''}${fieldLabels[key] ?? key}`, result);
    } else result[path] = typeof value === 'boolean' ? (value ? '예' : '아니오') : String(value ?? '');
    return result;
  }
  const left = flatten(before); const right = flatten(after);
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => (left[key] ?? '') !== (right[key] ?? '')).map((path) => ({ path, before: left[path] ?? '', after: right[path] ?? '' }));
}

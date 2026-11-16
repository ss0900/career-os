import { isSafeLink, sectionVisible } from './resume';
import { sectionLabels, type ResumeDocument } from './resume-schema';

export type ResumeBlock = {
  id: string;
  kind: 'name' | 'role' | 'section' | 'entry' | 'text' | 'meta' | 'link';
  text: string;
  href?: string;
  keepWithNext?: boolean;
};
export function splitParagraph(text: string, limit = 240): string[] {
  const result: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf(' ', limit);
    if (cut < limit / 2) cut = limit;
    // Do not cut a UTF-16 surrogate pair.
    if (/[\uD800-\uDBFF]/.test(remaining[cut - 1])) cut -= 1;
    result.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) result.push(remaining);
  return result;
}
export function buildResumeBlocks(document: ResumeDocument): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];
  const add = (kind: ResumeBlock['kind'], text: string, keepWithNext = false, href?: string) =>
    blocks.push({ id: `block-${blocks.length}`, kind, text, keepWithNext, href });
  const paragraphs = (text: string, kind: ResumeBlock['kind'] = 'text') => {
    for (const paragraph of text.split('\n'))
      for (const part of splitParagraph(paragraph)) if (part.trim()) add(kind, part);
  };
  const period = (item: { startDate: string; endDate: string; current: boolean }) =>
    `${item.startDate} — ${item.current ? '현재' : item.endDate}`;
  const careers = document.careers.filter((item) => item.included);
  const projects = document.projects.filter((item) => item.included);
  const projectBlocks = (project: (typeof projects)[number]) => {
    add('entry', project.name, true);
    add('meta', [period(project), project.role].filter(Boolean).join(' · '), true);
    paragraphs(project.summary);
    paragraphs(project.contribution);
    if (document.format === 'career-description') paragraphs(project.implementation);
    for (const item of project.achievements.filter((entry) => entry.included)) {
      paragraphs(`• ${item.text}`);
      if (item.evidence.trim()) paragraphs(`근거: ${item.evidence}`, 'meta');
    }
    if (project.showSkills && project.skills.length)
      paragraphs(`사용 기술: ${project.skills.join(' · ')}`, 'meta');
    if (sectionVisible(document, 'links'))
      for (const [label, href] of [
        ['GitHub', project.githubUrl],
        ['Demo', project.demoUrl],
      ])
        if (isSafeLink(href)) add('link', `${label} · ${href}`, false, href);
  };
  for (const section of document.sections.filter((item) => item.visible)) {
    const start = blocks.length;
    if (section.key !== 'profile') add('section', sectionLabels[section.key], true);
    switch (section.key) {
      case 'profile':
        add('name', document.profile.name, true);
        if (document.role) add('role', document.role, true);
        paragraphs(
          [document.profile.email, document.profile.phone].filter(Boolean).join(' · '),
          'meta',
        );
        paragraphs(document.profile.headline);
        paragraphs(document.note);
        break;
      case 'competencies':
        document.profile.competencies.forEach((item) => paragraphs(`• ${item}`));
        break;
      case 'skills':
        paragraphs(document.profile.skills.join(' · '));
        break;
      case 'careers':
        for (const career of careers) {
          add('entry', career.company, true);
          add(
            'meta',
            [period(career), career.department, career.position].filter(Boolean).join(' · '),
            true,
          );
          paragraphs(career.responsibilities);
          career.achievements
            .filter((item) => item.included)
            .forEach((item) => {
              paragraphs(`• ${item.text}`);
              if (item.evidence) paragraphs(`근거: ${item.evidence}`, 'meta');
            });
          if (sectionVisible(document, 'projects'))
            projects.filter((item) => item.careerId === career.sourceId).forEach(projectBlocks);
        }
        break;
      case 'projects':
        projects
          .filter(
            (item) =>
              !sectionVisible(document, 'careers') ||
              !careers.some((career) => career.sourceId === item.careerId),
          )
          .forEach(projectBlocks);
        break;
      case 'education':
        document.education.forEach((item) => {
          add('entry', item.school, true);
          paragraphs(
            [item.startDate, item.endDate, item.degree, item.major].filter(Boolean).join(' · '),
            'meta',
          );
          paragraphs(item.detail);
        });
        break;
      case 'qualifications':
        document.qualifications.forEach((item) => {
          add('entry', `${item.category} · ${item.name}`, true);
          paragraphs([item.issuer, item.date].filter(Boolean).join(' · '), 'meta');
          paragraphs(item.detail);
        });
        break;
      case 'languages':
        document.languages.forEach((item) => {
          add('entry', item.name, true);
          paragraphs([item.level, item.test, item.date].filter(Boolean).join(' · '));
        });
        break;
      case 'links':
        for (const [label, href] of [
          ['GitHub', document.profile.githubUrl],
          ['Portfolio', document.profile.portfolioUrl],
        ])
          if (isSafeLink(href)) add('link', `${label} · ${href}`, false, href);
        break;
    }
    if (blocks.length === start + 1 && blocks[start].kind === 'section') blocks.pop();
  }
  // A heading without any following body is not attached to the next section.
  blocks.forEach((block, index) => {
    if (!blocks[index + 1] || blocks[index + 1].kind === 'section') block.keepWithNext = false;
  });
  return blocks;
}

export function paginateBlocks(
  blocks: ResumeBlock[],
  heights: number[],
  capacity: number,
): ResumeBlock[][] {
  const pages: ResumeBlock[][] = [[]];
  let used = 0;
  for (let index = 0; index < blocks.length; index++) {
    let groupHeight = heights[index] ?? 0;
    for (let next = index; blocks[next]?.keepWithNext && next + 1 < blocks.length; next++)
      groupHeight += heights[next + 1] ?? 0;
    const needed = groupHeight <= capacity ? groupHeight : heights[index];
    if (used + needed > capacity && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(blocks[index]);
    used += heights[index] ?? 0;
  }
  return pages;
}

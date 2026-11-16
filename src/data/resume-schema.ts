import { z } from 'zod';

// Drafts deliberately accept incomplete dates/links. Quality checks gate submission,
// while autosave must retain unfinished typing. Original Phase 1 schemas stay unchanged.
const text = z.string().max(12000);
const short = z.string().max(300);
const list = z.array(z.string().max(200)).max(100);
const id = z.string().uuid();
const date = z.string().datetime();
const source = { sourceId: id, sourceUpdatedAt: date, included: z.boolean() };
const period = { startDate: z.string().max(20), endDate: z.string().max(20), current: z.boolean() };

export const sectionLabels = {
  profile: '이름 및 연락처',
  competencies: '핵심역량',
  careers: '경력',
  projects: '프로젝트',
  skills: '기술스택',
  education: '학력',
  qualifications: '자격증 및 수상',
  languages: '외국어',
  links: '링크',
} as const;
export type SectionKey = keyof typeof sectionLabels;
export const sectionKeys = Object.keys(sectionLabels) as SectionKey[];

const achievementSchema = z.object({ id, text, evidence: text, included: z.boolean() }).strict();
export const resumeProfileSchema = z
  .object({
    name: short,
    email: short,
    phone: short,
    targetRole: short,
    headline: text,
    competencies: list,
    skills: list,
    githubUrl: z.string().max(2000),
    portfolioUrl: z.string().max(2000),
  })
  .strict();
export const resumeCareerSchema = z
  .object({
    ...source,
    ...period,
    company: short,
    department: short,
    position: short,
    responsibilities: text,
    achievements: z.array(achievementSchema).max(100),
  })
  .strict();
export const resumeProjectSchema = z
  .object({
    ...source,
    ...period,
    careerId: z.union([z.literal(''), id]),
    name: short,
    summary: text,
    role: short,
    contribution: text,
    implementation: text,
    skills: list,
    showSkills: z.boolean(),
    achievements: z.array(achievementSchema).max(100),
    githubUrl: z.string().max(2000),
    demoUrl: z.string().max(2000),
  })
  .strict();
const educationSchema = z
  .object({
    id,
    school: short,
    degree: short,
    major: short,
    startDate: short,
    endDate: short,
    detail: text,
  })
  .strict();
const qualificationSchema = z
  .object({
    id,
    category: z.enum(['자격증', '수상']),
    name: short,
    issuer: short,
    date: short,
    detail: text,
  })
  .strict();
const languageSchema = z
  .object({ id, name: short, level: short, test: short, date: short })
  .strict();

export const resumeDocumentSchema = z
  .object({
    title: short,
    company: short,
    role: short,
    format: z.enum(['resume', 'career-description']),
    note: text,
    profile: resumeProfileSchema,
    sections: z
      .array(
        z
          .object({
            key: z.enum(sectionKeys as [SectionKey, ...SectionKey[]]),
            visible: z.boolean(),
          })
          .strict(),
      )
      .length(sectionKeys.length),
    careers: z.array(resumeCareerSchema).max(200),
    projects: z.array(resumeProjectSchema).max(500),
    education: z.array(educationSchema).max(100),
    qualifications: z.array(qualificationSchema).max(100),
    languages: z.array(languageSchema).max(100),
  })
  .strict()
  .superRefine((document, context) => {
    if (new Set(document.sections.map((section) => section.key)).size !== sectionKeys.length)
      context.addIssue({ code: 'custom', message: '중복된 섹션입니다.' });
    for (const key of [
      'careers',
      'projects',
      'education',
      'qualifications',
      'languages',
    ] as const) {
      const values = document[key].map((item) => ('sourceId' in item ? item.sourceId : item.id));
      if (new Set(values).size !== values.length)
        context.addIssue({ code: 'custom', message: '중복된 이력서 항목입니다.', path: [key] });
    }
    const careers = new Set(document.careers.map((career) => career.sourceId));
    if (document.projects.some((project) => project.careerId && !careers.has(project.careerId)))
      context.addIssue({ code: 'custom', message: '이력서 안에 연결된 경력이 없습니다.' });
    for (const item of [...document.careers, ...document.projects]) {
      if (
        new Set(item.achievements.map((achievement) => achievement.id)).size !==
        item.achievements.length
      )
        context.addIssue({ code: 'custom', message: '중복된 성과입니다.' });
    }
  });
export const resumeSchema = z
  .object({
    id,
    createdAt: date,
    updatedAt: date,
    revision: z.number().int().min(1),
    content: resumeDocumentSchema,
  })
  .strict();
export const resumeVersionSchema = z
  .object({
    id,
    resumeId: id,
    number: z.number().int().min(1),
    kind: z.enum(['saved', 'submitted']),
    label: short,
    createdAt: date,
    content: resumeDocumentSchema,
  })
  .strict();
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;
export type Resume = z.infer<typeof resumeSchema>;
export type ResumeVersion = z.infer<typeof resumeVersionSchema>;
export type ResumeCareer = z.infer<typeof resumeCareerSchema>;
export type ResumeProject = z.infer<typeof resumeProjectSchema>;
export type ResumeAchievement = z.infer<typeof achievementSchema>;

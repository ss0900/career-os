import { z } from 'zod';
import { uid, short, prose, meta, optionalId } from './interview-schema';
import { publicPortfolioSchema } from './public-portfolio-schema';

export const portfolioSections = [
  '소개',
  '핵심역량',
  '기술스택',
  '경력',
  '프로젝트',
  '수상 및 자격증',
  '링크',
  '연락처',
] as const;
export const imageSchema = z
  .object({
    id: uid,
    name: short,
    mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    bytes: z
      .number()
      .int()
      .positive()
      .max(3 * 1024 * 1024),
    alt: short,
    caption: prose,
    approved: z.boolean(),
  })
  .strict();
export const portfolioProjectSchema = z
  .object({
    id: uid,
    sourceId: optionalId,
    included: z.boolean(),
    name: short,
    summary: prose,
    background: prose,
    problem: prose,
    role: prose,
    skills: z.array(short).max(100),
    techReason: prose,
    architecture: prose,
    features: prose,
    implementation: prose,
    troubleshooting: prose,
    outcome: prose,
    reflection: prose,
    githubUrl: z.string().max(2000),
    demoUrl: z.string().max(2000),
    images: z.array(imageSchema).max(30),
  })
  .strict();
export const portfolioContentSchema = z
  .object({
    title: short,
    headline: prose,
    role: short,
    about: prose,
    competencies: z.array(short).max(100),
    skills: z.array(short).max(100),
    careers: z
      .array(
        z
          .object({
            id: uid,
            sourceId: optionalId,
            included: z.boolean(),
            company: short,
            position: short,
            period: short,
            description: prose,
          })
          .strict(),
      )
      .max(200),
    projects: z.array(portfolioProjectSchema).max(500),
    qualifications: prose,
    githubUrl: z.string().max(2000),
    demoUrl: z.string().max(2000),
    contact: short,
    sections: z.array(z.enum(portfolioSections)).max(8),
    status: z.enum(['작성 중', '공개 검토 중', '공개 준비 완료']),
  })
  .strict()
  .superRefine((p, ctx) => {
    for (const rows of [p.careers, p.projects, p.projects.flatMap((v) => v.images)])
      if (new Set(rows.map((v) => v.id)).size !== rows.length)
        ctx.addIssue({ code: 'custom', message: '포트폴리오 항목 ID가 중복됩니다.' });
    if (new Set(p.sections).size !== p.sections.length)
      ctx.addIssue({ code: 'custom', message: '공개 섹션이 중복됩니다.' });
  });
export const publicationSchema = z
  .object({
    id: uid,
    createdAt: z.iso.datetime(),
    revision: z.number().int().positive(),
    data: publicPortfolioSchema,
  })
  .strict();
export const portfolioSchema = z
  .object({
    ...meta,
    revision: z.number().int().positive(),
    content: portfolioContentSchema,
    publications: z.array(publicationSchema).max(100),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (new Set(p.publications.map((v) => v.id)).size !== p.publications.length)
      ctx.addIssue({ code: 'custom', message: '공개 이력이 중복됩니다.' });
  });
export type Portfolio = z.infer<typeof portfolioSchema>;
export type PortfolioContent = z.infer<typeof portfolioContentSchema>;
export type PortfolioProject = z.infer<typeof portfolioProjectSchema>;
export type PortfolioAsset = { id: string; portfolioId: string; blob: Blob };

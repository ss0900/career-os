import { z } from 'zod';

const text = z.string().max(30000);
const short = z.string().max(300);
export const publicUrl = z.union([
  z.literal(''),
  z
    .string()
    .max(2000)
    .url()
    .refine((v) => /^https?:\/\//i.test(v), 'http/https 링크를 입력해 주세요.'),
]);
export const projectFields = {
  name: short,
  summary: text,
  background: text,
  problem: text,
  role: text,
  skills: z.array(short).max(100),
  techReason: text,
  architecture: text,
  features: text,
  implementation: text,
  troubleshooting: text,
  outcome: text,
  reflection: text,
  githubUrl: publicUrl,
  demoUrl: publicUrl,
};
export const publicProjectSchema = z
  .object({
    ...projectFields,
    images: z
      .array(
        z
          .object({
            path: z.string().regex(/^images\/[a-f0-9-]{36}\.(png|jpg|webp)$/),
            alt: short.min(1),
            caption: text,
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
// This module never imports IndexedDB, the private schema or repositories.
export const publicPortfolioSchema = z
  .object({
    format: z.literal('career-os-public-portfolio'),
    version: z.literal(1),
    title: short.min(1),
    headline: text,
    role: short,
    about: text,
    competencies: z.array(short).max(100),
    skills: z.array(short).max(100),
    careers: z
      .array(
        z.object({ company: short, position: short, period: short, description: text }).strict(),
      )
      .max(200),
    projects: z.array(publicProjectSchema).max(500),
    qualifications: text,
    githubUrl: publicUrl,
    demoUrl: publicUrl,
    contact: z.union([z.literal(''), z.string().max(254).email()]),
  })
  .strict();
export type PublicPortfolio = z.infer<typeof publicPortfolioSchema>;

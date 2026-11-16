import { z } from 'zod';
import { resumeSchema, resumeVersionSchema } from './resume-schema';

const shortText = z.string().trim().max(200, '200자 이내로 입력해 주세요.');
const longText = z.string().trim().max(12000, '12,000자 이내로 입력해 주세요.');
const requiredText = shortText.min(1, '필수 항목을 입력해 주세요.');
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '올바른 연월을 입력해 주세요.');
const tags = z
  .array(z.string().trim().min(1).max(80))
  .max(100, '항목은 100개까지 저장할 수 있습니다.');
const safeUrl = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .max(2000)
    .url('올바른 URL을 입력해 주세요.')
    .refine((value) => /^https?:\/\//i.test(value), 'http 또는 https 링크만 사용할 수 있습니다.'),
]);
const metadata = {
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
const datedFields = {
  startDate: month,
  endDate: z.union([z.literal(''), month]),
  current: z.boolean(),
};
const validPeriod = (value: { startDate: string; endDate: string; current: boolean }) =>
  value.current ? value.endDate === '' : !!value.endDate && value.startDate <= value.endDate;
const periodMessage = {
  message: '종료일은 시작일 이후여야 합니다. 진행 중이면 체크해 주세요.',
  path: ['endDate'],
};

export const profileInputSchema = z
  .object({
    name: requiredText,
    email: z.union([
      z.literal(''),
      z.string().trim().max(254).email('이메일 형식을 확인해 주세요.'),
    ]),
    phone: z.string().trim().max(50),
    targetRole: shortText,
    headline: z.string().trim().max(300),
    competencies: tags,
    skills: tags,
    githubUrl: safeUrl,
    portfolioUrl: safeUrl,
  })
  .strict();
export const profileSchema = profileInputSchema.extend({ ...metadata, id: z.literal('profile') });

const careerFields = {
  company: requiredText,
  department: shortText,
  position: requiredText,
  ...datedFields,
  responsibilities: longText,
  achievements: longText,
};
export const careerInputSchema = z.object(careerFields).strict().refine(validPeriod, periodMessage);
export const careerSchema = z
  .object({ ...careerFields, ...metadata })
  .strict()
  .refine(validPeriod, periodMessage);

const projectFields = {
  name: requiredText,
  summary: z.string().trim().max(500),
  careerId: z.union([z.literal(''), z.string().uuid()]),
  ...datedFields,
  role: shortText,
  teamSize: z.number().int().min(1).max(100000).nullable(),
  skills: tags,
  problem: longText,
  goal: longText,
  contribution: longText,
  implementation: longText,
  techReason: longText,
  troubleshooting: longText,
  outcome: longText,
  reflection: longText,
  githubUrl: safeUrl,
  demoUrl: safeUrl,
  resourceUrl: safeUrl,
};
export const projectInputSchema = z
  .object(projectFields)
  .strict()
  .refine(validPeriod, periodMessage);
export const projectSchema = z
  .object({ ...projectFields, ...metadata })
  .strict()
  .refine(validPeriod, periodMessage);
export const settingsSchema = z
  .object({ id: z.literal('settings'), lastBackupAt: z.string().datetime().nullable() })
  .strict();

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type CareerInput = z.infer<typeof careerInputSchema>;
export type Career = z.infer<typeof careerSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type Project = z.infer<typeof projectSchema>;
export type AppSettings = z.infer<typeof settingsSchema>;

export const emptyProfile: ProfileInput = {
  name: '',
  email: '',
  phone: '',
  targetRole: '',
  headline: '',
  competencies: [],
  skills: [],
  githubUrl: '',
  portfolioUrl: '',
};
export const emptyCareer: CareerInput = {
  company: '',
  department: '',
  position: '',
  startDate: '',
  endDate: '',
  current: false,
  responsibilities: '',
  achievements: '',
};
export const emptyProject: ProjectInput = {
  name: '',
  summary: '',
  careerId: '',
  startDate: '',
  endDate: '',
  current: false,
  role: '',
  teamSize: null,
  skills: [],
  problem: '',
  goal: '',
  contribution: '',
  implementation: '',
  techReason: '',
  troubleshooting: '',
  outcome: '',
  reflection: '',
  githubUrl: '',
  demoUrl: '',
  resourceUrl: '',
};

export const backupV1Schema = z
  .object({
    app: z.literal('career-os'),
    schemaVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    data: z
      .object({
        profiles: z.array(profileSchema).max(1),
        careers: z.array(careerSchema).max(10000),
        projects: z.array(projectSchema).max(10000),
      })
      .strict(),
  })
  .strict()
  .superRefine((backup, context) => {
    for (const key of ['careers', 'projects'] as const) {
      const ids = backup.data[key].map((record) => record.id);
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: 'custom',
          message: '중복된 ID가 포함되어 있습니다.',
          path: ['data', key],
        });
    }
    const careers = new Set(backup.data.careers.map((record) => record.id));
    if (backup.data.projects.some((record) => record.careerId && !careers.has(record.careerId))) {
      context.addIssue({
        code: 'custom',
        message: '프로젝트에 연결된 경력이 없습니다.',
        path: ['data', 'projects'],
      });
    }
  });
export const backupV2Schema = z
  .object({
    app: z.literal('career-os'),
    schemaVersion: z.literal(2),
    exportedAt: z.string().datetime(),
    data: z
      .object({
        profiles: z.array(profileSchema).max(1),
        careers: z.array(careerSchema).max(10000),
        projects: z.array(projectSchema).max(10000),
        resumes: z.array(resumeSchema).max(10000),
        resumeVersions: z.array(resumeVersionSchema).max(10000),
      })
      .strict(),
  })
  .strict()
  .superRefine((backup, context) => {
    const original = backupV1Schema.safeParse({
      app: backup.app,
      schemaVersion: 1,
      exportedAt: backup.exportedAt,
      data: {
        profiles: backup.data.profiles,
        careers: backup.data.careers,
        projects: backup.data.projects,
      },
    });
    if (!original.success)
      context.addIssue({ code: 'custom', message: '기존 경력 데이터가 올바르지 않습니다.' });
    for (const key of ['resumes', 'resumeVersions'] as const) {
      if (new Set(backup.data[key].map((item) => item.id)).size !== backup.data[key].length)
        context.addIssue({ code: 'custom', message: '중복된 이력서 ID입니다.' });
    }
    const ids = new Set(backup.data.resumes.map((item) => item.id));
    const numbers = new Set<string>();
    for (const version of backup.data.resumeVersions) {
      const key = `${version.resumeId}:${version.number}`;
      if (!ids.has(version.resumeId) || numbers.has(key))
        context.addIssue({
          code: 'custom',
          message: '이력서 버전의 관계 또는 번호가 잘못되었습니다.',
        });
      numbers.add(key);
    }
    // Source IDs belong to independent copies, so deleted originals remain valid.
  });
export const backupSchema = z.union([backupV1Schema, backupV2Schema]);
export type Backup = z.infer<typeof backupSchema>;
export type CurrentBackup = z.infer<typeof backupV2Schema>;
export function normalizeBackup(backup: Backup): CurrentBackup {
  return backup.schemaVersion === 2
    ? backup
    : { ...backup, schemaVersion: 2, data: { ...backup.data, resumes: [], resumeVersions: [] } };
}

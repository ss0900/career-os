import { z } from 'zod';
import { resumeVersionSchema } from './resume-schema';

const id = z.string().uuid();
const short = z.string().trim().max(300);
const text = z.string().max(30000);
const required = short.min(1, '필수 항목을 입력해 주세요.');
export const daySchema = z.union([z.literal(''), z.iso.date()]);
const meta = { id, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() };
const url = z.union([
  z.literal(''),
  z
    .url()
    .max(2000)
    .refine((v) => /^https?:\/\//i.test(v), 'http/https 주소를 입력해 주세요.'),
]);
export const requirementKinds = [
  '주요 업무',
  '필수',
  '우대',
  '기술스택',
  '경력 조건',
  '기타',
] as const;
export const stages = [
  '관심 기업',
  '지원 준비',
  '지원 완료',
  '서류 검토',
  '서류 합격',
  '면접 진행',
  '최종 합격',
  '불합격',
  '지원 취소',
] as const;
export type Stage = (typeof stages)[number];
export const eventKinds = [
  '지원 예정',
  '서류 결과 확인',
  '코딩테스트',
  '과제 제출',
  '1차 면접',
  '2차 면접',
  '최종 면접',
  '결과 발표',
  '후속 연락',
  '기타',
] as const;
export const evidenceSchema = z
  .object({
    ...meta,
    projectId: id,
    projectUpdatedAt: z.iso.datetime(),
    name: short,
    skills: z.array(short).max(100),
    contribution: text,
    implementation: text,
    outcome: text,
    note: text,
    confirmed: z.boolean(),
    requirementText: text,
  })
  .strict()
  .refine(
    (e) => !e.confirmed || !!(e.contribution.trim() || e.implementation.trim() || e.outcome.trim()),
    '확인됨으로 보관하려면 실제 기여 또는 성과 기록이 필요합니다.',
  );
export const requirementSchema = z
  .object({
    ...meta,
    kind: z.enum(requirementKinds),
    text: text.refine((value) => !!value.trim(), '요구사항을 입력해 주세요.'),
    original: text,
    uncertain: z.boolean(),
    note: text,
    evidence: z.array(evidenceSchema).max(100),
  })
  .strict();
export const analysisSchema = z
  .object({
    ...meta,
    kind: short,
    prompt: z.string().max(200000),
    result: z
      .string()
      .max(50000)
      .refine((value) => !!value.trim(), '분석 결과를 입력해 주세요.'),
  })
  .strict();
export const jobInputSchema = z
  .object({
    company: required,
    title: required,
    role: required,
    url,
    location: short,
    workMode: z.enum(['미기재', '출근', '재택', '하이브리드']),
    employment: short,
    experience: short,
    compensation: short,
    postedOn: daySchema,
    deadline: daySchema,
    checkedOn: daySchema,
    duties: text,
    essential: text,
    preferred: text,
    skills: z.array(short).max(100),
    raw: z.string().max(100000),
    memo: text,
    motivation: text,
    questions: text,
    favorite: z.boolean(),
    interest: z.enum(['미정', '낮음', '보통', '높음']),
  })
  .strict()
  .refine(
    (v) => !v.postedOn || !v.deadline || v.postedOn <= v.deadline,
    '마감일은 게시일 이후여야 합니다.',
  );
export const jobSchema = jobInputSchema.safeExtend({
  ...meta,
  revision: z.number().int().positive(),
  requirements: z.array(requirementSchema).max(1000),
  analyses: z.array(analysisSchema).max(300),
});
const jobSnapshotSchema = z
  .object({ company: required, title: required, role: required, url, deadline: daySchema })
  .strict();
export const historySchema = z
  .object({
    id,
    from: z.union([z.literal(''), z.enum(stages)]),
    to: z.enum(stages),
    at: z.iso.datetime(),
    note: text,
  })
  .strict();
export const submissionSchema = z
  .object({
    id,
    createdAt: z.iso.datetime(),
    date: z.iso.date(),
    method: required,
    mode: z.enum(['registered', 'external']),
    version: resumeVersionSchema.nullable(),
  })
  .strict()
  .refine(
    (v) => (v.mode === 'external' ? v.version === null : v.version?.kind === 'submitted'),
    '제출본만 연결할 수 있습니다.',
  );
export const applicationSchema = z
  .object({
    ...meta,
    revision: z.number().int().positive(),
    jobId: z.union([z.literal(''), id]),
    job: jobSnapshotSchema,
    stage: z.enum(stages),
    appliedOn: daySchema,
    method: short,
    memo: text,
    nextAction: text,
    resumeId: z.union([z.literal(''), id]),
    history: z.array(historySchema).min(1).max(10000),
    submissions: z.array(submissionSchema).max(1000),
  })
  .strict()
  .superRefine((app, ctx) => {
    let previous = '';
    for (const h of app.history) {
      if (h.from !== previous)
        ctx.addIssue({ code: 'custom', message: '지원 단계 이력이 연결되지 않습니다.' });
      previous = h.to;
    }
    if (previous !== app.stage)
      ctx.addIssue({ code: 'custom', message: '현재 단계와 이력이 다릅니다.' });
  });
export const eventInputSchema = z
  .object({
    applicationId: id,
    title: required,
    kind: z.enum(eventKinds),
    date: z.iso.date(),
    time: z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
    memo: text,
    done: z.boolean(),
  })
  .strict();
export const eventSchema = eventInputSchema.extend(meta);
export type JobInput = z.infer<typeof jobInputSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ApplicationEvent = z.infer<typeof eventSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export const emptyJob: JobInput = {
  company: '',
  title: '',
  role: '',
  url: '',
  location: '',
  workMode: '미기재',
  employment: '',
  experience: '',
  compensation: '',
  postedOn: '',
  deadline: '',
  checkedOn: '',
  duties: '',
  essential: '',
  preferred: '',
  skills: [],
  raw: '',
  memo: '',
  motivation: '',
  questions: '',
  favorite: false,
  interest: '미정',
};

export function validateJobRelations(
  data: { jobs: Job[]; applications: Application[]; events: ApplicationEvent[] },
  ctx: z.RefinementCtx,
) {
  const unique = (items: { id: string }[]) => {
    if (new Set(items.map((v) => v.id)).size !== items.length)
      ctx.addIssue({ code: 'custom', message: '중복된 ID입니다.' });
  };
  unique(data.jobs);
  unique(data.applications);
  unique(data.events);
  const jobs = new Set(data.jobs.map((v) => v.id));
  const apps = new Set(data.applications.map((v) => v.id));
  for (const job of data.jobs) {
    unique(job.requirements);
    unique(job.analyses);
    for (const req of job.requirements) {
      unique(req.evidence);
      if (req.evidence.some((e) => e.confirmed && e.requirementText !== req.text))
        ctx.addIssue({ code: 'custom', message: '확인된 근거와 요구사항이 다릅니다.' });
    }
  }
  for (const app of data.applications) {
    unique(app.history);
    unique(app.submissions);
    if (app.jobId && !jobs.has(app.jobId))
      ctx.addIssue({ code: 'custom', message: '지원 기록에 연결된 공고가 없습니다.' });
  }
  if (data.events.some((e) => !apps.has(e.applicationId)))
    ctx.addIssue({ code: 'custom', message: '일정에 연결된 지원 기록이 없습니다.' });
  // Evidence and submission IDs refer to independent snapshots, not live source rows.
}

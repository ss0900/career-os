import { z } from 'zod';
import { jobSchema, eventSchema } from './jobs-schema';
import { resumeVersionSchema } from './resume-schema';

export const uid = z.string().uuid();
export const short = z.string().max(300);
export const prose = z.string().max(30000);
export const meta = { id: uid, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() };
export const optionalId = z.union([z.literal(''), uid]);
export const questionKinds = [
  '자기소개',
  '지원 동기',
  '직무 적합성',
  '기술 면접',
  '프로젝트 경험 검증',
  '문제 해결 과정',
  '시스템 설계 및 기술 선택',
  '협업 및 의사소통',
  '장애 대응',
  '인성 및 조직 적응',
  '이직 사유',
  '입사 후 기여 가능성',
] as const;
export const difficulties = ['기초', '보통', '심화'] as const;
export const sessionTypes = [
  '기술 면접',
  '프로젝트 심층 면접',
  '직무 역량 면접',
  '인성 면접',
  '종합 면접',
] as const;
export const starLabels = {
  situation: 'Situation · 상황',
  task: 'Task · 과제와 책임',
  action: 'Action · 실제 행동',
  result: 'Result · 결과와 근거',
  reflection: 'Reflection · 배운 점',
  free: '자유 형식 답변',
  summary: '핵심 요약 답변',
} as const;
export const checklistLabels = [
  '질문에 직접 답변했는가?',
  '본인의 담당 범위가 명확한가?',
  '문제 해결 과정이 구체적인가?',
  '기술적 판단과 선택 이유가 있는가?',
  '성과에 객관적 근거가 있는가?',
  '설명이 명확하고 적절한 길이인가?',
] as const;
export const answerSchema = z
  .object({
    situation: prose,
    task: prose,
    action: prose,
    result: prose,
    reflection: prose,
    free: prose,
    summary: prose,
    checks: z.array(z.boolean()).length(6),
  })
  .strict();
export type Answer = z.infer<typeof answerSchema>;
export const emptyAnswer: Answer = {
  situation: '',
  task: '',
  action: '',
  result: '',
  reflection: '',
  free: '',
  summary: '',
  checks: Array(6).fill(false),
};
export const answerVersionSchema = z
  .object({
    id: uid,
    createdAt: z.iso.datetime(),
    number: z.number().int().positive(),
    label: short,
    content: answerSchema,
  })
  .strict();
export const questionSchema = z
  .object({
    ...meta,
    revision: z.number().int().positive(),
    preparationId: optionalId,
    text: prose.refine((v) => !!v.trim(), '질문을 입력해 주세요.'),
    kind: z.enum(questionKinds),
    difficulty: z.enum(difficulties),
    company: short,
    role: short,
    projectId: optionalId,
    projectName: short,
    requirementId: optionalId,
    requirementText: prose,
    source: z.enum(['직접 작성', '규칙 기반 생성']),
    favorite: z.boolean(),
    review: z.boolean(),
    draft: answerSchema,
    versions: z.array(answerVersionSchema).max(500),
    activeVersionId: optionalId,
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.activeVersionId && !q.versions.some((v) => v.id === q.activeVersionId))
      ctx.addIssue({ code: 'custom', message: '최신 답변 버전이 없습니다.' });
    if (
      new Set(q.versions.map((v) => v.id)).size !== q.versions.length ||
      new Set(q.versions.map((v) => v.number)).size !== q.versions.length
    )
      ctx.addIssue({ code: 'custom', message: '답변 버전이 중복됩니다.' });
  });
export const preparationBase = z
  .object({
    ...meta,
    company: short,
    role: short,
    stage: short,
    applicationId: optionalId,
    jobId: optionalId,
    job: jobSchema.nullable(),
    submissions: z.array(resumeVersionSchema).max(1000),
    events: z.array(eventSchema).max(1000),
  })
  .strict();
// Source project/career snapshots are validated in schema.ts to avoid circular imports.
export const feedbackLabels = [
  '질문 이해도',
  '답변 관련성',
  '개인 기여도 설명',
  '기술적 판단',
  '문제 해결 과정',
  '성과의 검증 가능성',
  '설명의 명확성',
] as const;
export const feedbackSchema = z
  .object({
    ratings: z.array(z.number().int().min(1).max(5).nullable()).length(7),
    strengths: prose,
    weaknesses: prose,
    improvements: prose,
    review: z.boolean(),
  })
  .strict();
export const emptyFeedback = {
  ratings: Array(7).fill(null) as (number | null)[],
  strengths: '',
  weaknesses: '',
  improvements: '',
  review: false,
};
export const sessionItemSchema = z
  .object({
    id: uid,
    questionId: uid,
    text: prose,
    kind: z.enum(questionKinds),
    answer: prose,
    usedVersionId: optionalId,
    elapsed: z.number().min(0).max(10000000),
    completed: z.boolean(),
    feedback: feedbackSchema,
    followUps: z.array(z.object({ id: uid, text: prose, answer: prose }).strict()).max(30),
  })
  .strict();
export const sessionContentSchema = z
  .object({
    title: short.refine((value) => !!value.trim(), '세션 제목을 입력해 주세요.'),
    company: short,
    role: short,
    preparationId: optionalId,
    mode: z.enum(['모의 면접', '실제 면접 회고']),
    type: z.enum(sessionTypes),
    difficulty: z.enum(difficulties),
    count: z.number().int().min(1).max(30),
    technicalPercent: z.number().int().min(0).max(100),
    includeJD: z.boolean(),
    projectIds: z.array(uid).max(500),
    status: z.enum(['진행 중', '중단', '완료']),
    index: z.number().int().min(0),
    date: z.union([z.literal(''), z.iso.date()]),
    reflection: prose,
    items: z.array(sessionItemSchema).min(1).max(30),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (
      s.index >= s.items.length ||
      s.count !== s.items.length ||
      new Set(s.items.map((i) => i.id)).size !== s.items.length ||
      new Set(s.items.map((i) => i.questionId)).size !== s.items.length
    )
      ctx.addIssue({ code: 'custom', message: '면접 질문 순서 또는 개수가 올바르지 않습니다.' });
    for (const item of s.items)
      if (new Set(item.followUps.map((f) => f.id)).size !== item.followUps.length)
        ctx.addIssue({ code: 'custom', message: '꼬리질문 ID가 중복됩니다.' });
  });
export const sessionSchema = z
  .object({ ...meta, revision: z.number().int().positive(), content: sessionContentSchema })
  .strict();
export const interviewAnalysisSchema = z
  .object({
    ...meta,
    preparationId: optionalId,
    kind: short,
    prompt: z.string().max(500000),
    result: prose.refine((v) => !!v.trim(), '분석 결과를 입력해 주세요.'),
  })
  .strict();
export type Question = z.infer<typeof questionSchema>;
export type InterviewSession = z.infer<typeof sessionSchema>;
export type SessionContent = z.infer<typeof sessionContentSchema>;
export type InterviewAnalysis = z.infer<typeof interviewAnalysisSchema>;

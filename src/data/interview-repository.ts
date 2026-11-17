import { db, type CareerDatabase } from './db';
import { preparationSchema } from './schema';
import {
  questionSchema,
  sessionSchema,
  interviewAnalysisSchema,
  emptyFeedback,
  type Question,
  type SessionContent,
  type Answer,
} from './interview-schema';
import { recordMeta, generateQuestions, answerText, selectSessionQuestions } from './interview';
import { parseJD } from './jobs';

export function assertRevision(row: { revision: number } | undefined, revision: number) {
  if (!row || row.revision !== revision)
    throw new Error(
      '다른 화면에서 변경되었거나 삭제되었습니다. 현재 문구를 복사해 두고 다시 열어 주세요. 덮어쓰지 않았습니다.',
    );
}
export function createInterviewRepository(database: CareerDatabase) {
  const updateQuestion = async (id: string, revision: number, change: (q: Question) => Question) =>
    database.transaction('rw', database.questions, async () => {
      const row = await database.questions.get(id);
      assertRevision(row, revision);
      const next = questionSchema.parse({
        ...change(row!),
        revision: revision + 1,
        updatedAt: new Date().toISOString(),
      });
      await database.questions.put(next);
      return next;
    });
  return {
    async prepare(jobId: string, applicationId: string, projectIds: string[]) {
      return database.transaction(
        'rw',
        [
          database.preparations,
          database.questions,
          database.jobs,
          database.applications,
          database.projects,
          database.careers,
          database.events,
        ],
        async () => {
          const app = applicationId ? await database.applications.get(applicationId) : undefined;
          if (applicationId && !app) throw new Error('지원 기록을 찾을 수 없습니다.');
          const sourceJob = app?.jobId || jobId;
          const originalJob = sourceJob ? await database.jobs.get(sourceJob) : undefined;
          const job = originalJob
            ? {
                ...originalJob,
                requirements: originalJob.requirements.length
                  ? originalJob.requirements
                  : parseJD(originalJob),
              }
            : undefined;
          if (!job && !app) throw new Error('채용공고 또는 지원 기록을 선택해 주세요.');
          const projects = await database.projects.bulkGet(projectIds);
          if (projects.some((p) => !p)) throw new Error('선택한 프로젝트가 삭제되었습니다.');
          const careers = (await database.careers.toArray()).filter((c) =>
            projects.some((p) => p?.careerId === c.id),
          );
          const preparation = preparationSchema.parse({
            ...recordMeta(),
            company: app?.job.company ?? job!.company,
            role: app?.job.role ?? job!.role,
            stage: app?.stage ?? '',
            applicationId: app?.id ?? '',
            jobId: job?.id ?? '',
            job: job ?? null,
            projects,
            careers,
            submissions: app?.submissions.flatMap((s) => (s.version ? [s.version] : [])) ?? [],
            events: app
              ? await database.events.where('applicationId').equals(app.id).toArray()
              : [],
          });
          await database.preparations.add(preparation);
          await database.questions.bulkAdd(generateQuestions(preparation));
          return preparation;
        },
      );
    },
    async saveQuestion(input: Question, revision?: number) {
      const parsed = questionSchema.parse(input);
      return database.transaction('rw', database.questions, database.preparations, async () => {
        if (parsed.preparationId && !(await database.preparations.get(parsed.preparationId)))
          throw new Error('면접 준비 자료가 없습니다.');
        if (revision !== undefined)
          return updateQuestion(parsed.id, revision, (old) => ({
            ...parsed,
            draft: old.draft,
            versions: old.versions,
            activeVersionId: old.activeVersionId,
          }));
        await database.questions.add(parsed);
        return parsed;
      });
    },
    saveAnswer(id: string, revision: number, draft: Answer) {
      return updateQuestion(id, revision, (q) => ({ ...q, draft }));
    },
    version(id: string, revision: number, label: string) {
      return updateQuestion(id, revision, (q) => {
        const version = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          number: Math.max(0, ...q.versions.map((v) => v.number)) + 1,
          label,
          content: structuredClone(q.draft),
        };
        return { ...q, versions: [...q.versions, version], activeVersionId: version.id };
      });
    },
    useVersion(id: string, revision: number, versionId: string) {
      return updateQuestion(id, revision, (q) => {
        const version = q.versions.find((v) => v.id === versionId);
        if (!version) throw new Error('답변 버전이 없습니다.');
        return { ...q, activeVersionId: version.id, draft: structuredClone(version.content) };
      });
    },
    async deleteQuestion(id: string) {
      await database.questions.delete(id);
    },
    async createSession(config: Omit<SessionContent, 'items' | 'index' | 'status' | 'reflection'>) {
      return database.transaction(
        'rw',
        database.sessions,
        database.questions,
        database.preparations,
        async () => {
          if (config.preparationId && !(await database.preparations.get(config.preparationId)))
            throw new Error('면접 준비 자료가 없습니다.');
          const questions = selectSessionQuestions(await database.questions.toArray(), config);
          const session = sessionSchema.parse({
            ...recordMeta(),
            revision: 1,
            content: {
              ...config,
              status: '중단',
              index: 0,
              reflection: '',
              items: questions.map((q) => ({
                id: crypto.randomUUID(),
                questionId: q.id,
                text: q.text,
                kind: q.kind,
                answer: '',
                usedVersionId: '',
                elapsed: 0,
                completed: false,
                feedback: structuredClone(emptyFeedback),
                followUps: [],
              })),
            },
          });
          await database.sessions.add(session);
          return session;
        },
      );
    },
    async saveSession(id: string, content: SessionContent, revision: number) {
      return database.transaction('rw', database.sessions, database.questions, async () => {
        const previous = await database.sessions.get(id);
        assertRevision(previous, revision);
        const next = sessionSchema.parse({
          ...previous,
          content,
          revision: revision + 1,
          updatedAt: new Date().toISOString(),
        });
        // Reviews only add flags; saving another session never silently clears an existing flag.
        for (const item of content.items)
          if (item.feedback.review) {
            const q = await database.questions.get(item.questionId);
            if (q && !q.review)
              await database.questions.put({
                ...q,
                review: true,
                revision: q.revision + 1,
                updatedAt: next.updatedAt,
              });
          }
        await database.sessions.put(next);
        return next;
      });
    },
    async deleteSession(id: string) {
      await database.sessions.delete(id);
    },
    async saveAnalysis(preparationId: string, kind: string, prompt: string, result: string) {
      return database.transaction(
        'rw',
        database.interviewAnalyses,
        database.preparations,
        async () => {
          if (preparationId && !(await database.preparations.get(preparationId)))
            throw new Error('면접 준비 자료가 없습니다.');
          await database.interviewAnalyses.add(
            interviewAnalysisSchema.parse({ ...recordMeta(), preparationId, kind, prompt, result }),
          );
        },
      );
    },
    answerText,
  };
}
export const interviewRepository = createInterviewRepository(db);

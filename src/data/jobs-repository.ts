import { db, type CareerDatabase } from './db';
import {
  jobInputSchema,
  jobSchema,
  requirementSchema,
  applicationSchema,
  eventInputSchema,
  type JobInput,
  type Job,
  type Requirement,
  type Stage,
  type Application,
  type EventInput,
} from './jobs-schema';
import { createResumeRepository } from './resume-repository';

const stamp = () => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
};
function checkRevision(row: { revision: number } | undefined, expected: number) {
  if (!row) throw new Error('삭제된 기록입니다. 목록에서 다시 확인해 주세요.');
  if (row.revision !== expected)
    throw new Error(
      '다른 화면에서 변경된 기록입니다. 현재 입력을 복사해 두고 다시 열어 주세요. 덮어쓰지 않았습니다.',
    );
}
export function createJobsRepository(database: CareerDatabase) {
  async function updateJob(id: string, revision: number, change: (job: Job) => Job | Promise<Job>) {
    return database.transaction('rw', database.jobs, async () => {
      const previous = await database.jobs.get(id);
      checkRevision(previous, revision);
      const next = jobSchema.parse({
        ...(await change(previous!)),
        revision: revision + 1,
        updatedAt: new Date().toISOString(),
      });
      await database.jobs.put(next);
      return next;
    });
  }
  async function updateApplication(
    id: string,
    revision: number,
    change: (app: Application) => Application | Promise<Application>,
  ) {
    const previous = await database.applications.get(id);
    checkRevision(previous, revision);
    const next = applicationSchema.parse({
      ...(await change(previous!)),
      revision: revision + 1,
      updatedAt: new Date().toISOString(),
    });
    await database.applications.put(next);
    return next;
  }
  return {
    async saveJob(input: JobInput, id?: string, revision = 0) {
      const data = jobInputSchema.parse(input);
      if (id) return updateJob(id, revision, (previous) => ({ ...previous, ...data }));
      const job = jobSchema.parse({
        ...data,
        ...stamp(),
        revision: 1,
        requirements: [],
        analyses: [],
      });
      await database.jobs.add(job);
      return job;
    },
    async addRequirements(id: string, revision: number, incoming: Requirement[]) {
      return updateJob(id, revision, (job) => ({
        ...job,
        requirements: [
          ...job.requirements,
          ...incoming.filter(
            (r) => !job.requirements.some((old) => old.kind === r.kind && old.text === r.text),
          ),
        ],
      }));
    },
    async saveRequirement(id: string, revision: number, input: Requirement) {
      return updateJob(id, revision, (job) => {
        const previous = job.requirements.find((r) => r.id === input.id);
        if (!previous) throw new Error('요구사항을 찾을 수 없습니다.');
        const next = requirementSchema.parse({
          ...input,
          updatedAt: new Date().toISOString(),
          evidence:
            previous.text === input.text && previous.kind === input.kind
              ? previous.evidence
              : previous.evidence.map((e) => ({ ...e, confirmed: false })),
        });
        return { ...job, requirements: job.requirements.map((r) => (r.id === next.id ? next : r)) };
      });
    },
    async deleteRequirement(id: string, revision: number, requirementId: string) {
      return updateJob(id, revision, (job) => ({
        ...job,
        requirements: job.requirements.filter((r) => r.id !== requirementId),
      }));
    },
    async linkEvidence(
      id: string,
      revision: number,
      requirementId: string,
      projectId: string,
      note: string,
      confirmed: boolean,
    ) {
      return database.transaction('rw', database.jobs, database.projects, async () => {
        const project = await database.projects.get(projectId);
        if (!project) throw new Error('프로젝트가 삭제되었습니다. 다시 선택해 주세요.');
        return updateJob(id, revision, (job) => {
          const req = job.requirements.find((r) => r.id === requirementId);
          if (!req) throw new Error('요구사항이 삭제되었습니다.');
          const evidence = {
            ...stamp(),
            projectId,
            projectUpdatedAt: project.updatedAt,
            name: project.name,
            skills: project.skills,
            contribution: project.contribution,
            implementation: project.implementation,
            outcome: project.outcome,
            note,
            confirmed,
            requirementText: req.text,
          };
          const next = requirementSchema.parse({
            ...req,
            evidence: [...req.evidence, evidence],
            updatedAt: new Date().toISOString(),
          });
          return {
            ...job,
            requirements: job.requirements.map((r) => (r.id === req.id ? next : r)),
          };
        });
      });
    },
    async changeEvidence(
      id: string,
      revision: number,
      reqId: string,
      evidenceId: string,
      confirmed: boolean | null,
    ) {
      return updateJob(id, revision, (job) => ({
        ...job,
        requirements: job.requirements.map((r) =>
          r.id !== reqId
            ? r
            : requirementSchema.parse({
                ...r,
                evidence:
                  confirmed === null
                    ? r.evidence.filter((e) => e.id !== evidenceId)
                    : r.evidence.map((e) =>
                        e.id === evidenceId
                          ? {
                              ...e,
                              confirmed,
                              requirementText: r.text,
                              updatedAt: new Date().toISOString(),
                            }
                          : e,
                      ),
              }),
        ),
      }));
    },
    async saveAnalysis(id: string, revision: number, kind: string, prompt: string, result: string) {
      return updateJob(id, revision, (job) => ({
        ...job,
        analyses: [...job.analyses, { ...stamp(), kind, prompt, result }],
      }));
    },
    async deleteJob(id: string) {
      await database.transaction('rw', database.jobs, database.applications, async () => {
        await database.applications
          .where('jobId')
          .equals(id)
          .modify((app) => {
            app.jobId = '';
            app.revision++;
            app.updatedAt = new Date().toISOString();
          });
        await database.jobs.delete(id);
      });
    },
    async createApplication(jobId: string) {
      return database.transaction('rw', database.jobs, database.applications, async () => {
        const job = await database.jobs.get(jobId);
        if (!job) throw new Error('채용공고가 없습니다.');
        const { company, title, role, url, deadline } = job;
        const meta = stamp();
        const app = applicationSchema.parse({
          ...meta,
          revision: 1,
          jobId,
          job: { company, title, role, url, deadline },
          stage: '관심 기업',
          appliedOn: '',
          method: '',
          memo: '',
          nextAction: '',
          resumeId: '',
          submissions: [],
          history: [
            {
              id: crypto.randomUUID(),
              from: '',
              to: '관심 기업',
              at: meta.createdAt,
              note: '지원 기록 생성',
            },
          ],
        });
        await database.applications.add(app);
        return app;
      });
    },
    async saveApplication(
      id: string,
      revision: number,
      input: Pick<Application, 'appliedOn' | 'method' | 'memo' | 'nextAction'>,
    ) {
      return database.transaction('rw', database.applications, () =>
        updateApplication(id, revision, (a) => ({ ...a, ...input })),
      );
    },
    async changeStage(id: string, revision: number, stage: Stage, note: string) {
      return database.transaction('rw', database.applications, () =>
        updateApplication(id, revision, (a) =>
          a.stage === stage
            ? a
            : {
                ...a,
                stage,
                history: [
                  ...a.history,
                  {
                    id: crypto.randomUUID(),
                    from: a.stage,
                    to: stage,
                    at: new Date().toISOString(),
                    note,
                  },
                ],
              },
        ),
      );
    },
    async connectResume(id: string, revision: number, resumeId: string, duplicate: boolean) {
      return database.transaction(
        'rw',
        database.applications,
        database.resumes,
        database.profiles,
        database.careers,
        database.projects,
        async () => {
          const app = await database.applications.get(id);
          checkRevision(app, revision);
          const source = await database.resumes.get(resumeId);
          if (!source) throw new Error('이력서를 선택해 주세요.');
          const resume = duplicate
            ? await createResumeRepository(database).create({
                ...source.content,
                title: `${app!.job.company} 지원용 · ${source.content.title}`.slice(0, 300),
                company: app!.job.company,
                role: app!.job.role,
              })
            : source;
          return updateApplication(id, revision, (a) => ({ ...a, resumeId: resume.id }));
        },
      );
    },
    async submit(
      id: string,
      revision: number,
      date: string,
      method: string,
      versionId: string | null,
    ) {
      return database.transaction(
        'rw',
        database.applications,
        database.resumeVersions,
        async () => {
          const version = versionId ? await database.resumeVersions.get(versionId) : null;
          if (versionId && version?.kind !== 'submitted')
            throw new Error('실제 제출본 버전을 선택해 주세요.');
          return updateApplication(id, revision, (a) => ({
            ...a,
            appliedOn: a.appliedOn || date,
            method,
            stage: ['관심 기업', '지원 준비'].includes(a.stage) ? '지원 완료' : a.stage,
            submissions: [
              ...a.submissions,
              {
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                date,
                method,
                mode: version ? 'registered' : 'external',
                version: version ? structuredClone(version) : null,
              },
            ],
            history: !['관심 기업', '지원 준비'].includes(a.stage)
              ? a.history
              : [
                  ...a.history,
                  {
                    id: crypto.randomUUID(),
                    from: a.stage,
                    to: '지원 완료',
                    at: new Date().toISOString(),
                    note: '제출 내역 보관',
                  },
                ],
          }));
        },
      );
    },
    async saveEvent(input: EventInput, id?: string, expectedUpdatedAt?: string) {
      const data = eventInputSchema.parse(input);
      return database.transaction('rw', database.events, database.applications, async () => {
        if (!(await database.applications.get(data.applicationId)))
          throw new Error('지원 기록이 없습니다.');
        const previous = id ? await database.events.get(id) : undefined;
        if (id && (!previous || previous.updatedAt !== expectedUpdatedAt))
          throw new Error('일정이 변경되었거나 삭제되었습니다. 다시 열어 주세요.');
        const event = {
          ...(previous ?? stamp()),
          ...data,
          updatedAt: new Date().toISOString(),
        };
        await database.events.put(event);
        return event;
      });
    },
    async deleteEvent(id: string) {
      await database.events.delete(id);
    },
    async deleteApplication(id: string) {
      await database.transaction('rw', database.applications, database.events, async () => {
        await database.events.where('applicationId').equals(id).delete();
        await database.applications.delete(id);
      });
    },
  };
}
export const jobsRepository = createJobsRepository(db);

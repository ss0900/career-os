import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareerDatabase } from './db';
import { createJobsRepository } from './jobs-repository';
import { createRepository } from './repository';
import { createResumeRepository } from './resume-repository';
import { emptyJob } from './jobs-schema';
import { emptyProfile, emptyProject, backupV2Schema } from './schema';
import {
  parseJD,
  extractSkills,
  normalizeSkill,
  matchRequirement,
  applicationStats,
  duplicateJobs,
  buildJobPrompt,
  dayDistance,
} from './jobs';
import { createBackup, parseBackup, restoreBackup } from './backup';

let db: CareerDatabase;
let repo: ReturnType<typeof createJobsRepository>;
beforeEach(() => {
  db = new CareerDatabase(`jobs-test-${crypto.randomUUID()}`);
  repo = createJobsRepository(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
const input = {
  ...emptyJob,
  company: '가상 기업',
  title: '검증용 채용',
  role: '프론트엔드',
  raw: '회사 소개\n[자격요건]\n- React.js 사용 경험\n- React.js 사용 경험\n우대사항\nTypeScript 프로젝트 경험',
};
async function seeded() {
  const originals = createRepository(db);
  await originals.saveProfile({
    ...emptyProfile,
    name: '가상 지원자',
    email: 'test@example.invalid',
    targetRole: '프론트엔드',
    skills: ['React.js'],
  });
  const projectId = await originals.saveProject({
    ...emptyProject,
    name: '가상 프로젝트',
    startDate: '2024-01',
    current: true,
    role: '개발',
    skills: ['React'],
    contribution: '직접 구현한 화면',
    outcome: '테스트로 확인한 결과',
  });
  let job = await repo.saveJob(input);
  job = await repo.addRequirements(job.id, job.revision, parseJD(input));
  return { originals, projectId, job };
}
describe('jobs and evidence', () => {
  it('classifies explicit headings, keeps original sentences, flags uncertainty and deduplicates', () => {
    const rows = parseJD(input);
    expect(rows).toHaveLength(3);
    expect(rows[0].uncertain).toBe(true);
    expect(rows[1].kind).toBe('필수');
    expect(rows[1].original).toBe('- React.js 사용 경험');
    expect(rows[2].kind).toBe('우대');
    expect(normalizeSkill('React.js')).toBe('React');
    expect(extractSkills('JavaScript React Native React.js C++ C# .NET PostgreSQL')).toEqual(
      expect.arrayContaining([
        'JavaScript',
        'React Native',
        'React',
        'C++',
        'C#',
        '.NET',
        'PostgreSQL',
      ]),
    );
    expect(extractSkills('JavaScript React Native PostgreSQL')).not.toContain('Java');
    expect(extractSkills('JavaScript React Native PostgreSQL')).not.toContain('React');
    expect(extractSkills('JavaScript React Native PostgreSQL')).not.toContain('SQL');
  });
  it('creates, updates, warns about duplicates and rejects stale edits and invalid URLs/dates', async () => {
    const job = await repo.saveJob(input);
    expect(duplicateJobs(input, [job])).toHaveLength(1);
    expect(duplicateJobs(input, [job], job.id)).toHaveLength(0);
    await repo.saveJob({ ...input, title: '다른 제목' }, job.id, job.revision);
    await expect(repo.saveJob(input, job.id, job.revision)).rejects.toThrow('다른 화면');
    await expect(repo.saveJob({ ...input, url: 'javascript:alert(1)' })).rejects.toThrow();
    await expect(repo.saveJob({ ...input, deadline: '2026-02-30' })).rejects.toThrow();
    await expect(
      repo.saveJob({ ...input, postedOn: '2026-02-10', deadline: '2026-02-09' }),
    ).rejects.toThrow();
    await repo.deleteJob(job.id);
    expect(await db.jobs.count()).toBe(0);
  });
  it('requires manual evidence confirmation and preserves confirmed copies after source edits/deletion', async () => {
    const { job, projectId, originals } = await seeded();
    const req = job.requirements.find((r) => r.kind === '필수')!;
    const project = (await db.projects.get(projectId))!;
    expect(matchRequirement(req, [project]).status).toBe('확인 필요');
    const linked = await repo.linkEvidence(
      job.id,
      job.revision,
      req.id,
      projectId,
      '직접 검토',
      true,
    );
    const fixed = linked.requirements.find((r) => r.id === req.id)!;
    await db.projects.update(projectId, { contribution: '원본 변경' });
    await originals.deleteProject(projectId);
    expect((await db.jobs.get(job.id))!.requirements.find((r) => r.id === req.id)).toEqual(fixed);
    expect(matchRequirement(fixed, []).status).toBe('확인됨');
    const edited = await repo.saveRequirement(job.id, linked.revision, {
      ...fixed,
      text: '변경된 요구사항',
    });
    expect(edited.requirements.find((r) => r.id === req.id)!.evidence[0].confirmed).toBe(false);
  });
  it('stores analysis revisions and generates prompts only from selected source fields', async () => {
    const { job, projectId } = await seeded();
    const project = (await db.projects.get(projectId))!;
    const prompt = buildJobPrompt({ kind: '지원 여부 검토', projects: [project] });
    expect(prompt).toContain(project.contribution);
    expect(prompt).not.toContain(project.outcome);
    expect(prompt).not.toContain(input.company);
    expect(buildJobPrompt({ kind: '분석', projects: [project], outcomes: true })).toContain(
      project.outcome,
    );
    const first = await repo.saveAnalysis(job.id, job.revision, '분석', prompt, '첫 결과');
    const second = await repo.saveAnalysis(job.id, first.revision, '분석', prompt, '수정 결과');
    expect(second.analyses.map((a) => a.result)).toEqual(['첫 결과', '수정 결과']);
  });
});
describe('applications, submissions and events', () => {
  it('records stage transitions atomically, supports reapplication and preserves applications after deleting a job', async () => {
    const { job } = await seeded();
    const app = await repo.createApplication(job.id);
    await repo.createApplication(job.id);
    const moved = await repo.changeStage(app.id, app.revision, '서류 합격', '서류 결과 확인');
    expect(moved.history.at(-1)).toMatchObject({
      from: '관심 기업',
      to: '서류 합격',
      note: '서류 결과 확인',
    });
    vi.spyOn(db.applications, 'put').mockRejectedValueOnce(new Error('full'));
    await expect(repo.changeStage(app.id, moved.revision, '면접 진행', '')).rejects.toThrow('full');
    expect(await db.applications.get(app.id)).toEqual(moved);
    await repo.deleteJob(job.id);
    expect((await db.applications.get(app.id))!.jobId).toBe('');
    expect((await db.applications.get(app.id))!.job.company).toBe(input.company);
    expect(await db.applications.count()).toBe(2);
  });
  it('protects submitted documents after deleting the original resume and supports external submissions', async () => {
    const { job } = await seeded();
    let app = await repo.createApplication(job.id);
    const resumes = createResumeRepository(db);
    const resume = await resumes.create();
    const saved = await resumes.saveVersion(resume.id, 'saved', '', resume.revision);
    await expect(
      repo.submit(app.id, app.revision, '2026-11-16', '홈페이지', saved.id),
    ).rejects.toThrow('제출본');
    const version = await resumes.saveVersion(resume.id, 'submitted', '', resume.revision);
    app = await repo.submit(app.id, app.revision, '2026-11-16', '홈페이지', version.id);
    await resumes.delete(resume.id);
    expect((await db.applications.get(app.id))!.submissions[0].version).toEqual(version);
    app = await repo.submit(app.id, app.revision, '2026-11-17', '외부 사이트', null);
    expect(app.submissions[1].mode).toBe('external');
    expect(app.history.filter((h) => h.to === '지원 완료')).toHaveLength(1);
    app = await repo.changeStage(app.id, app.revision, '면접 진행', '면접 일정 확정');
    const history = structuredClone(app.history);
    app = await repo.submit(app.id, app.revision, '2026-11-16', '뒤늦게 보관한 제출 내역', null);
    expect(app.stage).toBe('면접 진행');
    expect(app.history).toEqual(history);
    expect(parseBackup(JSON.stringify(await createBackup(db))).schemaVersion).toBe(3);
  });
  it('copies tailored drafts and saves date-only events without inventing times', async () => {
    const { job } = await seeded();
    const app = await repo.createApplication(job.id);
    const resume = await createResumeRepository(db).create();
    const connected = await repo.connectResume(app.id, app.revision, resume.id, true);
    expect(connected.resumeId).not.toBe(resume.id);
    expect((await db.resumes.get(connected.resumeId))!.content.company).toBe(job.company);
    const event = await repo.saveEvent({
      applicationId: app.id,
      title: '가상 면접',
      kind: '1차 면접',
      date: '2026-11-20',
      time: '',
      memo: '',
      done: false,
    });
    expect(event.time).toBe('');
    await repo.saveEvent(
      {
        applicationId: app.id,
        title: '변경 면접',
        kind: event.kind,
        date: event.date,
        time: '10:30',
        memo: '준비',
        done: true,
      },
      event.id,
      event.updatedAt,
    );
    expect((await db.events.get(event.id))!.done).toBe(true);
    await repo.deleteApplication(app.id);
    expect(await db.events.count()).toBe(0);
  });
  it('calculates observed funnel counts once per application, excludes withdrawals and handles zero denominators', async () => {
    const { job } = await seeded();
    let a = await repo.createApplication(job.id);
    expect(applicationStats([a]).paperRate).toBe('데이터 부족');
    a = await repo.changeStage(a.id, a.revision, '면접 진행', '');
    a = await repo.changeStage(a.id, a.revision, '서류 합격', '');
    a = await repo.changeStage(a.id, a.revision, '면접 진행', '');
    expect(applicationStats([a])).toMatchObject({ applied: 1, paper: 1, interview: 1 });
    a = await repo.changeStage(a.id, a.revision, '지원 취소', '');
    expect(applicationStats([a]).applied).toBe(0);
    expect(dayDistance('2026-11-17', '2026-11-16')).toBe(1);
  });
});
describe('v3 database and backups', () => {
  it('upgrades v2 without changing profile, resume, version or settings rows', async () => {
    const { job } = await seeded();
    expect(job).toBeDefined();
    const resumes = createResumeRepository(db);
    const resume = await resumes.create();
    await resumes.saveVersion(resume.id, 'submitted', '', 1);
    const before = await createBackup(db);
    const name = `v2-upgrade-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(2).stores({
      profiles: 'id',
      careers: 'id, updatedAt, company',
      projects: 'id, careerId, updatedAt, *skills',
      settings: 'id',
      resumes: 'id, updatedAt',
      resumeVersions: 'id, resumeId, &[resumeId+number], createdAt',
    });
    await old.open();
    for (const key of ['profiles', 'careers', 'projects', 'resumes', 'resumeVersions'] as const)
      await old.table(key).bulkAdd(before.data[key]);
    await old.table('settings').put({ id: 'settings', lastBackupAt: '2026-11-16T00:00:00.000Z' });
    old.close();
    const next = new CareerDatabase(name);
    try {
      await next.open();
      expect(next.verno).toBe(3);
      for (const key of ['profiles', 'careers', 'projects', 'resumes', 'resumeVersions'] as const)
        expect(await next.table(key).toArray()).toEqual(before.data[key]);
      expect((await next.settings.get('settings'))!.lastBackupAt).toBe('2026-11-16T00:00:00.000Z');
      expect(await next.jobs.count()).toBe(0);
    } finally {
      await next.delete();
    }
  });
  it('round-trips v3 and restores a real v2 backup with empty phase 3 tables', async () => {
    const { job } = await seeded();
    const app = await repo.createApplication(job.id);
    await repo.submit(app.id, app.revision, '2026-11-16', '외부', null);
    const before = await createBackup(db);
    await repo.deleteJob(job.id);
    await restoreBackup(parseBackup(JSON.stringify(before)), db);
    expect((await createBackup(db)).data).toEqual(before.data);
    const { jobs, applications, events, ...oldData } = before.data;
    expect(jobs.length + applications.length + events.length).toBeGreaterThan(0);
    const v2 = backupV2Schema.parse({ ...before, schemaVersion: 2, data: oldData });
    await restoreBackup(parseBackup(JSON.stringify(v2)), db);
    expect(await db.jobs.count()).toBe(0);
    expect(await db.applications.count()).toBe(0);
    expect((await createBackup(db)).data.projects).toEqual(oldData.projects);
  });
  it('rejects broken relationships and rolls back every table when v3 restore fails', async () => {
    const { job } = await seeded();
    const app = await repo.createApplication(job.id);
    await repo.saveEvent({
      applicationId: app.id,
      title: '일정',
      kind: '기타',
      date: '2026-11-20',
      time: '',
      memo: '',
      done: false,
    });
    const before = await createBackup(db);
    const invalid = structuredClone(before);
    invalid.data.events[0].applicationId = crypto.randomUUID();
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
    const broken = structuredClone(before);
    broken.data.applications[0].stage = '최종 합격';
    expect(() => parseBackup(JSON.stringify(broken))).toThrow();
    const incoming = structuredClone(before);
    incoming.data.jobs[0].company = '교체 시도';
    vi.spyOn(db.events, 'bulkAdd').mockRejectedValueOnce(new Error('full'));
    await expect(restoreBackup(incoming, db)).rejects.toThrow('full');
    expect((await createBackup(db)).data).toEqual(before.data);
  });
});

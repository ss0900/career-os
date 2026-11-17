import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareerDatabase } from './db';
import { createRepository } from './repository';
import { createJobsRepository } from './jobs-repository';
import { createResumeRepository } from './resume-repository';
import { createInterviewRepository } from './interview-repository';
import { createPortfolioRepository, cleanImage } from './portfolio-repository';
import { emptyProfile, emptyProject, backupV3Schema } from './schema';
import { emptyJob } from './jobs-schema';
import { emptyAnswer, sessionContentSchema, type SessionContent } from './interview-schema';
import {
  generateQuestions,
  newQuestion,
  selectSessionQuestions,
  interviewPrompt,
  followUpQuestions,
} from './interview';
import { publicData } from './portfolio';
import { publicPortfolioSchema } from './public-portfolio-schema';
import { createBackup, parseBackup, restoreBackup } from './backup';

let db: CareerDatabase;
let interviews: ReturnType<typeof createInterviewRepository>;
let portfolios: ReturnType<typeof createPortfolioRepository>;
beforeEach(() => {
  db = new CareerDatabase(`phase4-test-${crypto.randomUUID()}`);
  interviews = createInterviewRepository(db);
  portfolios = createPortfolioRepository(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
async function seed() {
  const originals = createRepository(db);
  await originals.saveProfile({
    ...emptyProfile,
    name: '가상 사용자',
    email: 'private@example.invalid',
    targetRole: '프론트엔드',
    headline: '가상의 개발 기록',
    skills: ['React'],
  });
  const projectId = await originals.saveProject({
    ...emptyProject,
    name: '가상 프로젝트',
    role: '개발',
    startDate: '2024-01',
    current: true,
    skills: ['React'],
    contribution: '직접 구현한 화면',
    problem: '사용성 문제',
    outcome: '가상의 검증 결과',
  });
  const jobs = createJobsRepository(db);
  const job = await jobs.saveJob({
    ...emptyJob,
    company: '비공개 지원 기업',
    title: '검증용 공고',
    role: '프론트엔드',
    raw: '자격요건\nReact.js 경험',
  });
  const app = await jobs.createApplication(job.id);
  const resumes = createResumeRepository(db);
  const resume = await resumes.create();
  const version = await resumes.saveVersion(resume.id, 'submitted', '', resume.revision);
  await jobs.submit(app.id, app.revision, '2026-11-16', '가상 제출', version.id);
  const preparation = await interviews.prepare('', app.id, [projectId]);
  return { preparation, projectId, job, app, resume, originals, jobs, resumes };
}
function sessionConfig(
  preparationId: string,
): Omit<SessionContent, 'items' | 'index' | 'status' | 'reflection'> {
  return {
    title: '가상 연습',
    company: '가상 기업',
    role: '개발자',
    preparationId,
    mode: '모의 면접',
    type: '종합 면접',
    difficulty: '보통',
    count: 4,
    technicalPercent: 50,
    includeJD: true,
    projectIds: [],
    date: '',
  };
}

describe('interviews and source preservation', () => {
  it('generates source-based questions and retains JD, projects and submitted document after deleting sources', async () => {
    const { preparation, job, projectId, resume, jobs, originals, resumes } = await seed();
    const generated = generateQuestions(preparation);
    expect(generated.some((q) => q.text.includes('React.js 경험'))).toBe(true);
    expect(generated.some((q) => q.projectName === '가상 프로젝트')).toBe(true);
    expect(generated.every((q) => q.source === '규칙 기반 생성')).toBe(true);
    expect(generated.some((q) => q.text.includes('Kubernetes'))).toBe(false);
    await jobs.deleteJob(job.id);
    await originals.deleteProject(projectId);
    await resumes.delete(resume.id);
    expect(await db.preparations.get(preparation.id)).toEqual(preparation);
    expect(preparation.submissions[0].content.profile.name).toBe('가상 사용자');
    expect(preparation.stage).toBe((await db.applications.toArray())[0].stage);
    expect(parseBackup(JSON.stringify(await createBackup(db))).schemaVersion).toBe(4);
  });
  it('saves manual questions, STAR drafts, immutable versions and rejects stale editors', async () => {
    const { preparation } = await seed();
    let q = await interviews.saveQuestion({
      ...newQuestion(preparation),
      text: '개인 기여는 무엇인가요?',
    });
    q = await interviews.saveAnswer(q.id, q.revision, {
      ...emptyAnswer,
      action: '첫 답변',
      checks: [true, false, false, false, false, false],
    });
    const stale = structuredClone(q);
    q = await interviews.version(q.id, q.revision, '첫 버전');
    const version = structuredClone(q.versions[0]);
    q = await interviews.saveAnswer(q.id, q.revision, { ...q.draft, action: '개선 답변' });
    expect(q.versions[0]).toEqual(version);
    await expect(interviews.saveAnswer(stale.id, stale.revision, stale.draft)).rejects.toThrow(
      '다른 화면',
    );
    q = await interviews.useVersion(q.id, q.revision, version.id);
    expect(q.draft.action).toBe('첫 답변');
    expect(q.activeVersionId).toBe(version.id);
    await expect(interviews.saveQuestion({ ...newQuestion(), text: '   ' })).rejects.toThrow();
  });
  it('selects requested question mix, does not manufacture missing questions and supports follow-ups', async () => {
    const { preparation } = await seed();
    const questions = generateQuestions(preparation);
    const selected = selectSessionQuestions(questions, sessionConfig(preparation.id));
    expect(selected).toHaveLength(4);
    expect(new Set(selected.map((q) => q.id)).size).toBe(4);
    expect(() =>
      selectSessionQuestions(questions, { ...sessionConfig(preparation.id), count: 30 }),
    ).toThrow('질문이 부족');
    expect(() =>
      selectSessionQuestions(questions, { ...sessionConfig(preparation.id), difficulty: '심화' }),
    ).toThrow();
    expect(followUpQuestions('성능 20% 개선')[0]).toContain('검증');
  });
  it('persists sessions, feedback/review transactionally and preserves answers after deleting a question', async () => {
    const { preparation } = await seed();
    let session = await interviews.createSession(sessionConfig(preparation.id));
    const content = structuredClone(session.content);
    content.items[0].answer = '면접에서 사용한 답변';
    content.items[0].elapsed = 13.5;
    content.items[0].feedback.review = true;
    content.status = '중단';
    vi.spyOn(db.sessions, 'put').mockRejectedValueOnce(new Error('disk full'));
    await expect(interviews.saveSession(session.id, content, session.revision)).rejects.toThrow(
      'disk full',
    );
    expect((await db.questions.get(content.items[0].questionId))!.review).toBe(false);
    session = await interviews.saveSession(session.id, content, session.revision);
    expect((await db.questions.get(content.items[0].questionId))!.review).toBe(true);
    await interviews.deleteQuestion(content.items[0].questionId);
    expect((await db.sessions.get(session.id))!.content.items[0].answer).toBe(
      '면접에서 사용한 답변',
    );
    expect(sessionContentSchema.safeParse({ ...content, index: 100 }).success).toBe(false);
    await expect(interviews.saveSession(session.id, content, 1)).rejects.toThrow();
  });
  it('generates prompts from explicitly selected fields and stores manual analysis locally', async () => {
    const { preparation } = await seed();
    const prompt = interviewPrompt('기술 면접관', {
      project: { name: '가상 프로젝트', contribution: '직접 구현' },
    });
    expect(prompt).not.toContain('비공개 지원 기업');
    expect(prompt).not.toContain('private@example.invalid');
    await interviews.saveAnalysis(preparation.id, '기술 면접관', prompt, '수동 피드백');
    expect((await db.interviewAnalyses.toArray())[0].result).toBe('수동 피드백');
  });
});

describe('portfolio privacy boundary', () => {
  it('starts private, copies source documents and publishes only approved fields', async () => {
    const { projectId } = await seed();
    const p = await portfolios.create();
    const source = await db.projects.get(projectId);
    expect(p.content.sections).toEqual([]);
    expect(p.content.projects[0].included).toBe(false);
    expect(p.content.contact).toBe('');
    expect(publicData(p.content).projects).toEqual([]);
    expect(publicData(p.content).contact).toBe('');
    const changed = structuredClone(p.content);
    changed.projects[0].name = '공개용 프로젝트명';
    changed.projects[0].included = true;
    changed.sections = ['소개', '프로젝트'];
    const saved = await portfolios.save(p.id, changed, p.revision);
    const output = publicData(saved.content);
    expect(output.projects[0].name).toBe('공개용 프로젝트명');
    expect(await db.projects.get(projectId)).toEqual(source);
    const json = JSON.stringify(output);
    for (const privateField of [
      'sourceId',
      'preparationId',
      'publications',
      'private@example.invalid',
      '비공개 지원 기업',
    ])
      expect(json).not.toContain(privateField);
    expect(publicPortfolioSchema.safeParse({ ...output, interviewAnswers: [] }).success).toBe(
      false,
    );
  });
  it('validates public links, image paths and contact while retaining unfinished drafts', async () => {
    await seed();
    let p = await portfolios.create();
    p = await portfolios.save(
      p.id,
      {
        ...p.content,
        contact: 'unfinished',
        githubUrl: 'javascript:alert(1)',
        sections: ['연락처', '링크'],
      },
      p.revision,
    );
    expect(() => publicData(p.content)).toThrow();
    const output = publicData({ ...p.content, sections: [] });
    expect(output.githubUrl).toBe('');
    expect(output.contact).toBe('');
    const bad = {
      ...output,
      projects: [
        { ...p.content.projects[0], images: [{ path: '../private.png', alt: 'bad', caption: '' }] },
      ],
    };
    expect(publicPortfolioSchema.safeParse(bad).success).toBe(false);
    await expect(
      cleanImage(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })),
    ).rejects.toThrow('PNG');
  });
  it('requires an exact approval, exports separate images, records a fixed public snapshot and protects stale writes', async () => {
    await seed();
    let p = await portfolios.create();
    const content = structuredClone(p.content);
    content.sections = ['프로젝트'];
    content.projects[0].included = true;
    const image = {
      id: crypto.randomUUID(),
      name: 'private-name.png',
      mime: 'image/png' as const,
      bytes: 3,
      alt: '검증용 구성도',
      caption: '공개 이미지',
      approved: true,
    };
    content.projects[0].images = [image];
    p = await portfolios.save(p.id, content, p.revision);
    const json = JSON.stringify(publicData(p.content));
    await expect(portfolios.publish(p.id, p.revision, json + ' ')).rejects.toThrow('다시 확인');
    await expect(portfolios.publish(p.id, p.revision, json)).rejects.toThrow('파일이 없습니다');
    await db.portfolioAssets.add({
      id: image.id,
      portfolioId: p.id,
      blob: new Blob(['PNG'], { type: 'image/png' }),
    });
    const archive = await portfolios.publish(p.id, p.revision, json);
    expect(archive.type).toBe('application/zip');
    const bytes = new Uint8Array(await archive.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([80, 75, 3, 4]);
    expect(new TextDecoder().decode(bytes)).toContain(`portfolio/images/${image.id}.png`);
    expect(new TextDecoder().decode(bytes)).not.toContain('private-name.png');
    const latest = (await db.portfolios.get(p.id))!;
    expect(latest.publications[0].data).toEqual(JSON.parse(json));
    await expect(portfolios.save(p.id, p.content, p.revision)).rejects.toThrow('다른 화면');
    await portfolios.save(p.id, { ...latest.content, title: '후속 수정' }, latest.revision);
    expect((await db.portfolios.get(p.id))!.publications[0].data.title).toBe('새 포트폴리오');
  });
});

describe('v4 backup and upgrade', () => {
  it('round-trips all new records and excludes binary images from JSON', async () => {
    const { preparation } = await seed();
    const q = (await db.questions.toArray())[0];
    await interviews.version(q.id, q.revision, '보관');
    await interviews.createSession(sessionConfig(preparation.id));
    const p = await portfolios.create();
    await db.portfolioAssets.add({
      id: crypto.randomUUID(),
      portfolioId: p.id,
      blob: new Blob(['private binary']),
    });
    const before = await createBackup(db);
    expect(JSON.stringify(before)).not.toContain('private binary');
    await restoreBackup(parseBackup(JSON.stringify(before)), db);
    expect((await createBackup(db)).data).toEqual(before.data);
    expect(await db.portfolioAssets.count()).toBe(0);
  });
  it('restores real v1, v2, v3 backups and rejects invalid v4 relations without changing current data', async () => {
    await seed();
    await portfolios.create();
    const before = await createBackup(db);
    const old = {
      profiles: before.data.profiles,
      careers: before.data.careers,
      projects: before.data.projects,
      resumes: before.data.resumes,
      resumeVersions: before.data.resumeVersions,
      jobs: before.data.jobs,
      applications: before.data.applications,
      events: before.data.events,
    };
    for (const version of [1, 2, 3]) {
      const data =
        version === 3
          ? old
          : version === 2
            ? {
                profiles: old.profiles,
                careers: old.careers,
                projects: old.projects,
                resumes: old.resumes,
                resumeVersions: old.resumeVersions,
              }
            : { profiles: old.profiles, careers: old.careers, projects: old.projects };
      await restoreBackup(
        parseBackup(
          JSON.stringify({
            app: 'career-os',
            schemaVersion: version,
            exportedAt: before.exportedAt,
            data,
          }),
        ),
        db,
      );
      expect(await db.preparations.count()).toBe(0);
      expect(await db.portfolios.count()).toBe(0);
    }
    await restoreBackup(before, db);
    const invalid = structuredClone(before);
    invalid.data.questions[0].preparationId = crypto.randomUUID();
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
    expect((await createBackup(db)).data).toEqual(before.data);
  });
  it('rolls back old/new tables and image blobs together on restore failure', async () => {
    await seed();
    const p = await portfolios.create();
    const id = crypto.randomUUID();
    await db.portfolioAssets.add({ id, portfolioId: p.id, blob: new Blob(['kept']) });
    const before = await createBackup(db);
    vi.spyOn(db.portfolios, 'bulkAdd').mockRejectedValueOnce(new Error('full'));
    await expect(restoreBackup(before, db)).rejects.toThrow('full');
    expect((await createBackup(db)).data).toEqual(before.data);
    expect(await (await db.portfolioAssets.get(id))!.blob.text()).toBe('kept');
  });
  it('upgrades a real v3 Dexie database without modifying any existing records', async () => {
    await seed();
    const full = await createBackup(db);
    const { profiles, careers, projects, resumes, resumeVersions, jobs, applications, events } =
      full.data;
    const older = backupV3Schema.parse({
      ...full,
      schemaVersion: 3,
      data: { profiles, careers, projects, resumes, resumeVersions, jobs, applications, events },
    });
    const name = `upgrade-v3-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(3).stores({
      profiles: 'id',
      careers: 'id, updatedAt, company',
      projects: 'id, careerId, updatedAt, *skills',
      settings: 'id',
      resumes: 'id, updatedAt',
      resumeVersions: 'id, resumeId, &[resumeId+number], createdAt',
      jobs: 'id, updatedAt',
      applications: 'id, jobId, updatedAt',
      events: 'id, applicationId, date',
    });
    await old.open();
    for (const [key, rows] of Object.entries(older.data)) await old.table(key).bulkAdd(rows);
    old.close();
    const next = new CareerDatabase(name);
    try {
      await next.open();
      expect(next.verno).toBe(4);
      for (const [key, rows] of Object.entries(older.data))
        expect(await next.table(key).toArray()).toEqual(rows);
      expect(await next.questions.count()).toBe(0);
    } finally {
      await next.delete();
    }
  });
});

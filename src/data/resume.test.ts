import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareerDatabase } from './db';
import { createRepository } from './repository';
import { createResumeRepository } from './resume-repository';
import { createBackup, parseBackup, restoreBackup } from './backup';
import { emptyProfile, emptyCareer, emptyProject, normalizeBackup } from './schema';
import {
  checkResume,
  compareDocuments,
  createDocument,
  latestSourceDocument,
  moveItem,
} from './resume';
import { buildResumeBlocks, paginateBlocks, splitParagraph } from './resume-layout';

let database: CareerDatabase;
let originals: ReturnType<typeof createRepository>;
let resumes: ReturnType<typeof createResumeRepository>;
beforeEach(() => {
  database = new CareerDatabase(`phase2-test-${crypto.randomUUID()}`);
  originals = createRepository(database);
  resumes = createResumeRepository(database);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});

async function seed() {
  await originals.saveProfile({
    ...emptyProfile,
    name: '가상 작성자',
    email: 'author@example.invalid',
    targetRole: '프론트엔드 개발자',
    headline: '가상의 검증용 소개',
    skills: ['React'],
  });
  const career = await originals.saveCareer({
    ...emptyCareer,
    company: '가상 회사',
    position: '개발자',
    startDate: '2024-01',
    current: true,
  });
  const project = await originals.saveProject({
    ...emptyProject,
    name: '가상 프로젝트',
    careerId: career,
    role: '개발',
    startDate: '2024-02',
    current: true,
    outcome: '가상의 테스트 결과',
    skills: ['React'],
  });
  return { career, project };
}

describe('resume independence and immutable versions', () => {
  it('imports long multiline achievements without rejecting or dropping original content', async () => {
    const { project } = await seed();
    const lines = Array.from({ length: 150 }, (_, index) => `검증용 성과 ${index + 1}`);
    await database.projects.update(project, { outcome: lines.join('\n') });
    const draft = await resumes.create();
    expect(draft.content.projects[0].achievements).toHaveLength(100);
    expect(draft.content.projects[0].achievements.map((item) => item.text).join('\n')).toBe(
      lines.join('\n'),
    );
  });
  it('creates, edits, duplicates, reopens and deletes a resume without changing originals', async () => {
    await seed();
    const before = (await createBackup(database)).data;
    const first = await resumes.create();
    const content = structuredClone(first.content);
    content.projects[0].contribution = '이력서에서만 수정';
    content.title = '지원용 이력서';
    const saved = await resumes.save(first.id, content, first.revision);
    expect(saved.revision).toBe(2);
    const duplicate = await resumes.create(saved.content);
    expect(duplicate.id).not.toBe(first.id);
    await resumes.saveVersion(first.id, 'saved', '', saved.revision);
    database.close();
    await database.open();
    expect((await database.resumes.get(first.id))?.content.projects[0].contribution).toBe(
      '이력서에서만 수정',
    );
    await resumes.delete(first.id);
    expect(await database.resumeVersions.count()).toBe(0);
    expect(await database.resumes.get(duplicate.id)).toBeDefined();
    const after = (await createBackup(database)).data;
    expect(after.projects).toEqual(before.projects);
    expect(after.careers).toEqual(before.careers);
    expect(after.profiles).toEqual(before.profiles);
  });
  it('never changes submitted snapshots after changing or deleting source records and drafts', async () => {
    const source = await seed();
    const draft = await resumes.create();
    const snapshot = await resumes.saveVersion(
      draft.id,
      'submitted',
      '가상 기업 제출',
      draft.revision,
    );
    await resumes.save(
      draft.id,
      { ...draft.content, profile: { ...draft.content.profile, name: '수정한 이름' } },
      draft.revision,
    );
    const project = await database.projects.get(source.project);
    await database.projects.update(source.project, { name: '수정한 원본 프로젝트' });
    await originals.deleteCareer(source.career);
    await originals.deleteProject(source.project);
    await originals.deleteProfile();
    expect(project).toBeDefined();
    expect(await database.resumeVersions.get(snapshot.id)).toEqual(snapshot);
    expect(parseBackup(JSON.stringify(await createBackup(database))).schemaVersion).toBe(4);
  });
  it('allocates unique version numbers and preserves prior versions', async () => {
    await seed();
    const draft = await resumes.create();
    const versions = await Promise.all([
      resumes.saveVersion(draft.id, 'saved', '첫 버전', 1),
      resumes.saveVersion(draft.id, 'submitted', '제출본', 1),
    ]);
    expect(versions.map((item) => item.number).sort()).toEqual([1, 2]);
    expect(await database.resumeVersions.count()).toBe(2);
  });
  it('rejects stale writes and stale snapshot requests rather than overwriting', async () => {
    const draft = await resumes.create();
    await resumes.save(draft.id, { ...draft.content, title: '다른 탭' }, 1);
    await expect(
      resumes.save(draft.id, { ...draft.content, title: '오래된 탭' }, 1),
    ).rejects.toThrow('다른 탭');
    await expect(resumes.saveVersion(draft.id, 'saved', '', 1)).rejects.toThrow('초안이 변경');
    expect((await database.resumes.get(draft.id))?.content.title).toBe('다른 탭');
  });
  it('autosaves incomplete input but blocks submission until required errors are corrected', async () => {
    const draft = await resumes.create();
    const saved = await resumes.save(
      draft.id,
      { ...draft.content, profile: { ...draft.content.profile, email: 'unfinished@' } },
      1,
    );
    expect(saved.content.profile.email).toBe('unfinished@');
    await resumes.saveVersion(draft.id, 'saved', '작성 중', 2);
    await expect(resumes.saveVersion(draft.id, 'submitted', '', 2)).rejects.toThrow('작성 점검');
  });
});

describe('schema and backup compatibility', () => {
  it('upgrades a real Dexie v1 schema without changing any original rows', async () => {
    const name = `phase2-upgrade-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({
      profiles: 'id',
      careers: 'id, updatedAt, company',
      projects: 'id, careerId, updatedAt, *skills',
      settings: 'id',
    });
    await old.open();
    const now = new Date().toISOString();
    const profile = {
      ...emptyProfile,
      name: '기존 사용자',
      id: 'profile',
      createdAt: now,
      updatedAt: now,
    };
    const career = {
      ...emptyCareer,
      company: '기존 경력',
      position: '개발자',
      current: true,
      startDate: '2020-01',
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const project = {
      ...emptyProject,
      name: '기존 프로젝트',
      startDate: '2020-02',
      current: true,
      careerId: career.id,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await old.table('profiles').add(profile);
    await old.table('careers').add(career);
    await old.table('projects').add(project);
    old.close();
    const upgraded = new CareerDatabase(name);
    try {
      await upgraded.open();
      expect(upgraded.verno).toBe(4);
      expect(await upgraded.profiles.get('profile')).toEqual(profile);
      expect(await upgraded.careers.get(career.id)).toEqual(career);
      expect(await upgraded.projects.get(project.id)).toEqual(project);
      expect(await upgraded.resumes.count()).toBe(0);
    } finally {
      await upgraded.delete();
    }
  });
  it('imports v1 backups and explicitly replaces newer resumes with empty collections', async () => {
    await seed();
    const backup = await createBackup(database);
    const v1 = {
      app: 'career-os',
      schemaVersion: 1,
      exportedAt: backup.exportedAt,
      data: {
        profiles: backup.data.profiles,
        careers: backup.data.careers,
        projects: backup.data.projects,
      },
    };
    const draft = await resumes.create();
    await resumes.saveVersion(draft.id, 'submitted', '', 1);
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.schemaVersion).toBe(1);
    expect(normalizeBackup(parsed).data.resumes).toEqual([]);
    await restoreBackup(parsed, database);
    expect(await database.resumes.count()).toBe(0);
    expect(await database.resumeVersions.count()).toBe(0);
    expect((await createBackup(database)).data.projects).toEqual(backup.data.projects);
  });
  it('round-trips v2 drafts, supplements, all versions and independent source copies', async () => {
    await seed();
    const draft = await resumes.create();
    const content = {
      ...draft.content,
      education: [
        {
          id: crypto.randomUUID(),
          school: '가상 대학',
          degree: '학사',
          major: '가상 전공',
          startDate: '2019-03',
          endDate: '2023-02',
          detail: '',
        },
      ],
    };
    await resumes.save(draft.id, content, 1);
    await resumes.saveVersion(draft.id, 'saved', '보관', 2);
    await resumes.saveVersion(draft.id, 'submitted', '제출', 2);
    const before = await createBackup(database);
    await resumes.delete(draft.id);
    await restoreBackup(parseBackup(JSON.stringify(before)), database);
    expect((await createBackup(database)).data).toEqual(before.data);
  });
  it('rejects malformed version relationships and duplicate version numbers', async () => {
    await seed();
    const draft = await resumes.create();
    await resumes.saveVersion(draft.id, 'saved', '', 1);
    const backup = await createBackup(database);
    const version = backup.data.resumeVersions[0];
    for (const rows of [
      [{ ...version, resumeId: crypto.randomUUID() }],
      [version, { ...version, id: crypto.randomUUID() }],
    ]) {
      expect(() =>
        parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, resumeVersions: rows } })),
      ).toThrow();
    }
    expect((await createBackup(database)).data).toEqual(backup.data);
  });
  it('rolls back original records, drafts and versions after any restore write fails', async () => {
    await seed();
    const draft = await resumes.create();
    await resumes.saveVersion(draft.id, 'submitted', '', 1);
    const before = await createBackup(database);
    const incoming = structuredClone(before);
    incoming.data.resumes[0].content.title = '교체 시도';
    incoming.data.profiles[0].name = '교체 시도';
    vi.spyOn(database.resumeVersions, 'bulkAdd').mockRejectedValueOnce(new Error('storage full'));
    await expect(restoreBackup(incoming, database)).rejects.toThrow('storage full');
    expect((await createBackup(database)).data).toEqual(before.data);
  });
});

describe('quality, comparison and print layout', () => {
  it('checks roles, periods, links and evidence without invented scores', async () => {
    await seed();
    const draft = await resumes.create();
    const content = structuredClone(draft.content);
    content.projects[0].role = '';
    content.projects[0].startDate = '2024-13';
    content.profile.githubUrl = 'javascript:alert(1)';
    content.projects[0].summary = '긴'.repeat(1600);
    const issues = checkResume(content);
    expect(issues.some((item) => item.message.includes('역할') && item.level === 'error')).toBe(
      true,
    );
    expect(issues.some((item) => item.message.includes('기간'))).toBe(true);
    expect(issues.some((item) => item.message.includes('링크'))).toBe(true);
    expect(issues.some((item) => item.message.includes('근거') && item.level === 'warning')).toBe(
      true,
    );
    expect(issues.some((item) => item.message.includes('1,500'))).toBe(true);
    expect(buildResumeBlocks(content).some((block) => block.href?.startsWith('javascript:'))).toBe(
      false,
    );
  });
  it('compares current originals and prior versions without modifying either', async () => {
    const ids = await seed();
    const draft = await resumes.create();
    const originalContent = structuredClone(draft.content);
    await database.projects.update(ids.project, { role: '변경된 원본 역할' });
    const latest = latestSourceDocument(draft.content, await originals.readAll());
    expect(
      compareDocuments(draft.content, latest).some((item) => item.after === '변경된 원본 역할'),
    ).toBe(true);
    expect(draft.content).toEqual(originalContent);
  });
  it('preserves selection and ordering and hides sections in printed content', () => {
    const document = createDocument({ careers: [], projects: [] });
    document.profile.skills = ['PRINT_SKILL'];
    expect(buildResumeBlocks(document).some((block) => block.text.includes('PRINT_SKILL'))).toBe(
      true,
    );
    document.sections = document.sections.map((section) => ({
      ...section,
      visible: section.key !== 'skills',
    }));
    expect(buildResumeBlocks(document).some((block) => block.text.includes('PRINT_SKILL'))).toBe(
      false,
    );
    expect(moveItem(['first', 'second', 'third'], 1, -1)).toEqual(['second', 'first', 'third']);
    expect(moveItem(['first'], 0, -1)).toEqual(['first']);
  });
  it('splits long text without dropping characters and keeps headings with their body', () => {
    const text = '가나다😀 기술 선택의 이유와 근거 '.repeat(300);
    expect(splitParagraph(text).join('')).toBe(text);
    const blocks = [
      { id: '0', kind: 'text' as const, text: 'first' },
      { id: '1', kind: 'section' as const, text: 'title', keepWithNext: true },
      { id: '2', kind: 'text' as const, text: 'body' },
    ];
    const pages = paginateBlocks(blocks, [80, 15, 20], 100);
    expect(pages.map((page) => page.map((block) => block.id))).toEqual([['0'], ['1', '2']]);
  });
});

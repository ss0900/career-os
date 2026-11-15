import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CareerDatabase } from './db';
import { createRepository } from './repository';
import { createBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup } from './backup';
import {
  careerInputSchema,
  emptyCareer,
  emptyProfile,
  emptyProject,
  profileInputSchema,
  projectInputSchema,
} from './schema';
import { summarize } from './summary';

let database: CareerDatabase;
let repository: ReturnType<typeof createRepository>;
const career = {
  ...emptyCareer,
  company: '가상 테스트 회사',
  position: '개발자',
  startDate: '2024-01',
  current: true,
};
const project = {
  ...emptyProject,
  name: '가상 테스트 프로젝트',
  startDate: '2024-02',
  current: true,
  skills: ['React'],
};

beforeEach(() => {
  database = new CareerDatabase(`career-os-test-${crypto.randomUUID()}`);
  repository = createRepository(database);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});

describe('persistent records and relations', () => {
  it('starts empty and computes no invented statistics', async () => {
    const data = await repository.readAll();
    expect(data.profile).toBeUndefined();
    expect(summarize(data.profile, data.careers, data.projects)).toMatchObject({
      careerCount: 0,
      projectCount: 0,
      skills: [],
      completedProfileFields: 0,
    });
  });
  it('persists data after closing and reopening the database', async () => {
    await repository.saveProfile({ ...emptyProfile, name: '테스트 사용자', skills: ['React'] });
    const careerId = await repository.saveCareer(career);
    const projectId = await repository.saveProject({ ...project, careerId });
    database.close();
    await database.open();
    expect((await repository.readAll()).profile?.name).toBe('테스트 사용자');
    expect((await database.projects.get(projectId))?.careerId).toBe(careerId);
  });
  it('updates records without changing IDs or creation time', async () => {
    const id = await repository.saveProject(project);
    const before = await database.projects.get(id);
    await repository.saveProject(
      { ...project, name: '수정한 프로젝트', outcome: '검증한 결과' },
      id,
    );
    expect(await database.projects.count()).toBe(1);
    expect(await database.projects.get(id)).toMatchObject({
      id,
      createdAt: before?.createdAt,
      name: '수정한 프로젝트',
      outcome: '검증한 결과',
    });
  });
  it('keeps projects when a career is deleted', async () => {
    const careerId = await repository.saveCareer(career);
    const projectId = await repository.saveProject({ ...project, careerId });
    await repository.deleteCareer(careerId);
    expect(await database.careers.count()).toBe(0);
    expect(await database.projects.get(projectId)).toMatchObject({
      name: project.name,
      careerId: '',
    });
  });
  it('deletes only the selected profile/project', async () => {
    await repository.saveProfile({ ...emptyProfile, name: '테스트' });
    const careerId = await repository.saveCareer(career);
    const id = await repository.saveProject({ ...project, careerId });
    await repository.deleteProfile();
    expect(await database.profiles.count()).toBe(0);
    expect(await database.careers.count()).toBe(1);
    await repository.deleteProject(id);
    expect(await database.projects.count()).toBe(0);
    expect(await database.careers.count()).toBe(1);
  });
  it('rejects dangling relationships and editing a deleted record', async () => {
    await expect(
      repository.saveProject({ ...project, careerId: crypto.randomUUID() }),
    ).rejects.toThrow('연결할 경력');
    await expect(repository.saveCareer(career, crypto.randomUUID())).rejects.toThrow('이미 삭제');
    expect(await database.projects.count()).toBe(0);
  });
});

describe('backup safety', () => {
  it('round-trips every field and replaces records only after restore', async () => {
    await repository.saveProfile({ ...emptyProfile, name: '테스트', competencies: ['문제 해결'] });
    const careerId = await repository.saveCareer(career);
    await repository.saveProject({
      ...project,
      careerId,
      contribution: '직접 구현',
      outcome: '테스트 완료',
    });
    const backup = await createBackup(database);
    const parsed = parseBackup(JSON.stringify(backup));
    await repository.saveProject({ ...project, name: '백업 이후 기록' });
    expect(await database.projects.count()).toBe(2);
    await restoreBackup(parsed, database);
    expect((await createBackup(database)).data).toEqual(backup.data);
  });
  it('does not mutate live records when inspecting invalid backups', async () => {
    await repository.saveCareer(career);
    const before = await createBackup(database);
    for (const text of [
      '{',
      '{}',
      JSON.stringify({ ...before, schemaVersion: 999 }),
      JSON.stringify({ ...before, extra: 'unknown' }),
    ]) {
      expect(() => parseBackup(text)).toThrow();
    }
    expect((await createBackup(database)).data).toEqual(before.data);
  });
  it('rejects duplicate IDs, invalid dates, unsafe URLs, and missing career references', async () => {
    await repository.saveProject(project);
    const backup = await createBackup(database);
    const item = backup.data.projects[0];
    const invalidProjects = [
      [item, item],
      [{ ...item, startDate: '2024-13' }],
      [{ ...item, githubUrl: 'javascript:alert(1)' }],
      [{ ...item, careerId: crypto.randomUUID() }],
    ];
    for (const projects of invalidProjects)
      expect(() =>
        parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, projects } })),
      ).toThrow();
  });
  it('rolls back the entire restore transaction if a write fails', async () => {
    await repository.saveCareer(career);
    const before = await createBackup(database);
    const incoming = {
      ...before,
      data: { ...before.data, careers: [{ ...before.data.careers[0], company: '교체 데이터' }] },
    };
    vi.spyOn(database.projects, 'bulkAdd').mockRejectedValueOnce(
      new Error('simulated storage failure'),
    );
    await expect(restoreBackup(incoming, database)).rejects.toThrow('simulated storage failure');
    expect((await createBackup(database)).data).toEqual(before.data);
  });
  it('rejects oversized backups and accepts UTF-8 BOM', async () => {
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('5MB');
    const backup = await createBackup(database);
    expect(parseBackup('\uFEFF' + JSON.stringify(backup))).toEqual(backup);
  });
});

describe('input validation', () => {
  it('validates required fields, periods, team size, and contact URLs', () => {
    expect(profileInputSchema.safeParse(emptyProfile).success).toBe(false);
    expect(
      profileInputSchema.safeParse({ ...emptyProfile, name: '테스트', email: 'invalid' }).success,
    ).toBe(false);
    expect(
      careerInputSchema.safeParse({ ...career, current: false, endDate: '2023-12' }).success,
    ).toBe(false);
    expect(projectInputSchema.safeParse({ ...project, teamSize: -1 }).success).toBe(false);
    expect(
      projectInputSchema.safeParse({ ...project, demoUrl: 'data:text/html,test' }).success,
    ).toBe(false);
  });
  it('counts only real data and identifies incomplete project evidence', async () => {
    await repository.saveProfile({ ...emptyProfile, name: '테스트', skills: ['React'] });
    await repository.saveProject({ ...project, skills: ['React', 'TypeScript'] });
    const data = await repository.readAll();
    expect(summarize(data.profile, data.careers, data.projects)).toMatchObject({
      projectCount: 1,
      activeProjectCount: 1,
      skills: ['React', 'TypeScript'],
      completedProfileFields: 2,
    });
    expect(
      summarize(data.profile, data.careers, data.projects).projectsNeedingEvidence,
    ).toHaveLength(1);
  });
});

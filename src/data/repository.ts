import { db, type CareerDatabase } from './db';
import {
  careerInputSchema,
  profileInputSchema,
  projectInputSchema,
  type CareerInput,
  type ProfileInput,
  type ProjectInput,
} from './schema';

export function createRepository(database: CareerDatabase) {
  return {
    async readAll() {
      return database.transaction('r', database.tables, async () => ({
        profile: await database.profiles.get('profile'),
        careers: await database.careers.orderBy('updatedAt').reverse().toArray(),
        projects: await database.projects.orderBy('updatedAt').reverse().toArray(),
        settings: await database.settings.get('settings'),
        resumes: await database.resumes.orderBy('updatedAt').reverse().toArray(),
        resumeVersions: await database.resumeVersions.orderBy('createdAt').reverse().toArray(),
      }));
    },
    async saveProfile(input: ProfileInput) {
      const data = profileInputSchema.parse(input);
      await database.transaction('rw', database.profiles, async () => {
        const previous = await database.profiles.get('profile');
        const now = new Date().toISOString();
        await database.profiles.put({
          ...data,
          id: 'profile',
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        });
      });
    },
    async deleteProfile() {
      await database.profiles.delete('profile');
    },
    async saveCareer(input: CareerInput, id?: string) {
      const data = careerInputSchema.parse(input);
      return database.transaction('rw', database.careers, async () => {
        const previous = id ? await database.careers.get(id) : undefined;
        if (id && !previous) throw new Error('이미 삭제된 경력입니다. 목록을 새로 확인해 주세요.');
        const now = new Date().toISOString();
        const nextId = id ?? crypto.randomUUID();
        await database.careers.put({
          ...data,
          id: nextId,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        });
        return nextId;
      });
    },
    async deleteCareer(id: string) {
      // Keep project evidence when removing an employer; unlink atomically.
      await database.transaction('rw', database.careers, database.projects, async () => {
        await database.projects
          .where('careerId')
          .equals(id)
          .modify({ careerId: '', updatedAt: new Date().toISOString() });
        await database.careers.delete(id);
      });
    },
    async saveProject(input: ProjectInput, id?: string) {
      const data = projectInputSchema.parse(input);
      return database.transaction('rw', database.careers, database.projects, async () => {
        if (data.careerId && !(await database.careers.get(data.careerId)))
          throw new Error('연결할 경력이 없습니다. 경력을 다시 선택해 주세요.');
        const previous = id ? await database.projects.get(id) : undefined;
        if (id && !previous)
          throw new Error('이미 삭제된 프로젝트입니다. 목록을 새로 확인해 주세요.');
        const now = new Date().toISOString();
        const nextId = id ?? crypto.randomUUID();
        await database.projects.put({
          ...data,
          id: nextId,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        });
        return nextId;
      });
    },
    async deleteProject(id: string) {
      await database.projects.delete(id);
    },
  };
}
export const repository = createRepository(db);

import { db, type CareerDatabase } from './db';
import { createDocument, checkResume } from './resume';
import { resumeDocumentSchema, type Resume, type ResumeDocument, type ResumeVersion } from './resume-schema';

export function createResumeRepository(database: CareerDatabase) {
  return {
    async create(content?: ResumeDocument): Promise<Resume> {
      return database.transaction('rw', database.profiles, database.careers, database.projects, database.resumes, async () => {
        const document = content ?? createDocument({ profile: await database.profiles.get('profile'), careers: await database.careers.toArray(), projects: await database.projects.toArray() });
        const now = new Date().toISOString();
        const resume: Resume = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, revision: 1, content: resumeDocumentSchema.parse(document) };
        await database.resumes.add(resume);
        return resume;
      });
    },
    async save(id: string, content: ResumeDocument, expectedRevision: number): Promise<Resume> {
      const parsed = resumeDocumentSchema.parse(content);
      return database.transaction('rw', database.resumes, async () => {
        const previous = await database.resumes.get(id);
        if (!previous) throw new Error('이력서가 삭제되었거나 백업으로 교체되었습니다. 목록에서 다시 확인해 주세요.');
        if (previous.revision !== expectedRevision) throw new Error('다른 탭에서 이력서가 변경되었습니다. 현재 문구를 복사해 두고 새로고침해 주세요. 덮어쓰지 않았습니다.');
        const next = { ...previous, content: parsed, revision: previous.revision + 1, updatedAt: new Date().toISOString() };
        await database.resumes.put(next);
        return next;
      });
    },
    async saveVersion(resumeId: string, kind: ResumeVersion['kind'], label: string, expectedRevision: number): Promise<ResumeVersion> {
      return database.transaction('rw', database.resumes, database.resumeVersions, async () => {
        const draft = await database.resumes.get(resumeId);
        if (!draft || draft.revision !== expectedRevision) throw new Error('초안이 변경되었습니다. 저장 상태를 확인하고 다시 시도해 주세요.');
        if (kind === 'submitted' && checkResume(draft.content).some((issue) => issue.level === 'error')) throw new Error('작성 점검의 오류를 해결한 후 제출본으로 확정해 주세요.');
        const versions = await database.resumeVersions.where('resumeId').equals(resumeId).toArray();
        const version: ResumeVersion = { id: crypto.randomUUID(), resumeId, number: Math.max(0, ...versions.map((item) => item.number)) + 1, kind, label: label.slice(0, 300), createdAt: new Date().toISOString(), content: structuredClone(draft.content) };
        // Append-only: no version update method is exposed. Revisions are new rows.
        await database.resumeVersions.add(version);
        return version;
      });
    },
    async delete(id: string) {
      await database.transaction('rw', database.resumes, database.resumeVersions, async () => {
        await database.resumeVersions.where('resumeId').equals(id).delete();
        await database.resumes.delete(id);
      });
    },
  };
}
export const resumeRepository = createResumeRepository(db);

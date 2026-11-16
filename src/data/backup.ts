import { db, type CareerDatabase } from './db';
import {
  backupSchema,
  backupV3Schema,
  normalizeBackup,
  type Backup,
  type CurrentBackup,
} from './schema';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new Error('백업 파일은 20MB 이하여야 합니다.');
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('올바른 JSON 파일이 아닙니다. 기존 데이터는 변경되지 않았습니다.');
  }
  const result = backupSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      '지원하지 않는 백업 버전 또는 잘못된 데이터입니다. Career OS v1 / v2 / v3 백업 파일인지 확인해 주세요.',
    );
  return result.data;
}

export async function createBackup(database: CareerDatabase = db): Promise<CurrentBackup> {
  return database.transaction('r', database.tables, async () =>
    backupV3Schema.parse({
      app: 'career-os',
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      data: {
        profiles: await database.profiles.toArray(),
        careers: await database.careers.toArray(),
        projects: await database.projects.toArray(),
        resumes: await database.resumes.toArray(),
        resumeVersions: await database.resumeVersions.toArray(),
        jobs: await database.jobs.toArray(),
        applications: await database.applications.toArray(),
        events: await database.events.toArray(),
      },
    }),
  );
}

export async function restoreBackup(input: Backup, database: CareerDatabase = db): Promise<void> {
  const backup = normalizeBackup(backupSchema.parse(input));
  // Validate before opening the write transaction. Any write failure rolls back all tables.
  await database.transaction('rw', database.tables, async () => {
    await database.profiles.clear();
    await database.careers.clear();
    await database.projects.clear();
    await database.resumes.clear();
    await database.resumeVersions.clear();
    await database.jobs.clear();
    await database.applications.clear();
    await database.events.clear();
    await database.profiles.bulkAdd(backup.data.profiles);
    await database.careers.bulkAdd(backup.data.careers);
    await database.projects.bulkAdd(backup.data.projects);
    await database.resumes.bulkAdd(backup.data.resumes);
    await database.resumeVersions.bulkAdd(backup.data.resumeVersions);
    await database.jobs.bulkAdd(backup.data.jobs);
    await database.applications.bulkAdd(backup.data.applications);
    await database.events.bulkAdd(backup.data.events);
    await database.settings.put({ id: 'settings', lastBackupAt: null });
  });
}

export async function downloadBackup(): Promise<void> {
  const backup = await createBackup();
  const json = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES)
    throw new Error(
      '백업 용량이 20MB를 초과했습니다. 복원 한도를 늘린 버전이 필요합니다. 데이터는 그대로 유지됩니다.',
    );
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `career-os-backup-${backup.exportedAt.replace(/[:.]/g, '-')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await db.settings.put({ id: 'settings', lastBackupAt: backup.exportedAt });
}

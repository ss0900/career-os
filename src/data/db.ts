import Dexie, { type Table } from 'dexie';
import type { AppSettings, Career, Profile, Project } from './schema';
import type { Resume, ResumeVersion } from './resume-schema';
import type { Job, Application, ApplicationEvent } from './jobs-schema';

// Retain v1 for existing databases; new databases open with the latest schema.
export class CareerDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  careers!: Table<Career, string>;
  projects!: Table<Project, string>;
  settings!: Table<AppSettings, string>;
  resumes!: Table<Resume, string>;
  resumeVersions!: Table<ResumeVersion, string>;
  jobs!: Table<Job, string>;
  applications!: Table<Application, string>;
  events!: Table<ApplicationEvent, string>;

  constructor(name = 'career-os') {
    super(name);
    this.version(1).stores({
      profiles: 'id',
      careers: 'id, updatedAt, company',
      projects: 'id, careerId, updatedAt, *skills',
      settings: 'id',
    });
    // Additive upgrade only: v1 records and indexes are left intact.
    this.version(2).stores({
      resumes: 'id, updatedAt',
      resumeVersions: 'id, resumeId, &[resumeId+number], createdAt',
    });
    this.version(3).stores({
      jobs: 'id, updatedAt',
      applications: 'id, jobId, updatedAt',
      events: 'id, applicationId, date',
    });
  }
}
export const db = new CareerDatabase();

import type { Career, Profile, Project } from './schema';

export function summarize(profile: Profile | undefined, careers: Career[], projects: Project[]) {
  const skills = [
    ...new Set(
      [...(profile?.skills ?? []), ...projects.flatMap((project) => project.skills)]
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  ];
  const profileFields = [
    profile?.name,
    profile?.targetRole,
    profile?.headline,
    profile?.email,
    profile?.competencies.length,
    profile?.skills.length,
  ];
  return {
    careerCount: careers.length,
    projectCount: projects.length,
    activeProjectCount: projects.filter((project) => project.current).length,
    skills,
    completedProfileFields: profileFields.filter(Boolean).length,
    totalProfileFields: profileFields.length,
    projectsNeedingEvidence: projects.filter(
      (project) => !project.contribution || !project.outcome,
    ),
  };
}

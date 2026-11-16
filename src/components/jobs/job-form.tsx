import { ResumeInput, ResumeCheck, ResumeListInput } from '../resume/inputs';
import { DataDialog, Choice } from './shared';
import { emptyJob, jobInputSchema, type Job } from '../../data/jobs-schema';
import { duplicateJobs } from '../../data/jobs';
import { jobsRepository } from '../../data/jobs-repository';
import { useAppData } from '../../hooks/app-context';

export function JobForm({ job, onClose }: { job?: Job; onClose: () => void }) {
  const { jobs } = useAppData();
  const initial = job
    ? (Object.fromEntries(
        Object.keys(emptyJob).map((key) => [key, job[key as keyof typeof emptyJob]]),
      ) as typeof emptyJob)
    : emptyJob;
  return (
    <DataDialog
      title={job ? '채용공고 수정' : '채용공고 등록'}
      initial={initial}
      onClose={onClose}
      onSave={async (value) => {
        const parsed = jobInputSchema.parse(value);
        const duplicates = duplicateJobs(parsed, jobs, job?.id);
        if (
          duplicates.length &&
          !window.confirm(
            `동일 URL 또는 기업·직무의 공고가 ${duplicates.length}개 있습니다. 별도 공고로 저장할까요?`,
          )
        )
          throw new Error('중복 확인을 취소했습니다. 입력 내용을 확인해 주세요.');
        await jobsRepository.saveJob(parsed, job?.id, job?.revision);
      }}
    >
      {(value, change) => (
        <>
          <p className="field-hint">
            직접 입력하거나 JD 원문을 붙여넣으세요. 미기재 정보는 비워 두세요. 저장 후 상세 화면에서
            요구사항을 분류할 수 있습니다.
          </p>
          <div className="form-grid">
            {(
              [
                ['company', '기업명'],
                ['title', '채용공고 제목'],
                ['role', '지원 직무'],
                ['url', '채용공고 URL'],
                ['location', '근무지역'],
                ['employment', '고용형태'],
                ['experience', '경력 요구사항'],
                ['compensation', '연봉 및 처우'],
                ['postedOn', '공고 게시일'],
                ['deadline', '지원 마감일'],
                ['checkedOn', '공고 확인일'],
              ] as const
            ).map(([key, label]) => (
              <ResumeInput
                key={key}
                label={label}
                required={['company', 'title', 'role'].includes(key)}
                type={
                  ['postedOn', 'deadline', 'checkedOn'].includes(key)
                    ? 'date'
                    : key === 'url'
                      ? 'url'
                      : 'text'
                }
                maxLength={key === 'url' ? 2000 : 300}
                value={value[key]}
                onChange={(v) => change({ ...value, [key]: v })}
              />
            ))}
            <Choice
              label="근무형태"
              value={value.workMode}
              onChange={(v) => change({ ...value, workMode: v as typeof value.workMode })}
            >
              {['미기재', '출근', '재택', '하이브리드'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Choice>
            <Choice
              label="관심도"
              value={value.interest}
              onChange={(v) => change({ ...value, interest: v as typeof value.interest })}
            >
              {['미정', '낮음', '보통', '높음'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Choice>
          </div>
          <ResumeCheck
            checked={value.favorite}
            onChange={(favorite) => change({ ...value, favorite })}
          >
            즐겨찾기
          </ResumeCheck>
          {(
            [
              ['raw', 'JD 원문 전체'],
              ['duties', '주요 업무'],
              ['essential', '필수 자격요건'],
              ['preferred', '우대사항'],
              ['memo', '기업 및 직무 메모'],
              ['motivation', '지원하고 싶은 이유'],
              ['questions', '지원 전 확인할 사항'],
            ] as const
          ).map(([key, label]) => (
            <ResumeInput
              key={key}
              label={label}
              value={value[key]}
              multiline
              maxLength={key === 'raw' ? 100000 : 30000}
              onChange={(v) => change({ ...value, [key]: v })}
            />
          ))}
          <ResumeListInput
            label="공고 기술스택"
            values={value.skills}
            onChange={(skills) => change({ ...value, skills })}
          />
        </>
      )}
    </DataDialog>
  );
}

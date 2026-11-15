import { useState } from 'react';
import { repository } from '../data/repository';
import {
  careerInputSchema,
  emptyCareer,
  emptyProfile,
  emptyProject,
  profileInputSchema,
  projectInputSchema,
  type Career,
  type Profile,
  type Project,
} from '../data/schema';
import { useNotice } from '../hooks/app-context';
import { useRecordForm } from '../hooks/use-record-form';
import { splitTags } from '../lib/utils';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Field, SelectField } from './ui/field';

const str = (data: FormData, key: string) => String(data.get(key) ?? '');

function FormFooter({
  busy,
  onClose,
  label,
}: {
  busy: boolean;
  onClose: () => void;
  label: string;
}) {
  return (
    <div className="dialog-footer">
      <span className="save-note">이 브라우저에만 저장됩니다.</span>
      <Button variant="outline" disabled={busy} onClick={onClose}>
        취소
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? '저장 중…' : label}
      </Button>
    </div>
  );
}

export function ProfileForm({ profile, onClose }: { profile?: Profile; onClose: () => void }) {
  const initial = profile ?? emptyProfile;
  const notice = useNotice();
  const form = useRecordForm(
    profileInputSchema,
    async (value) => {
      await repository.saveProfile(value);
      notice('프로필을 저장했습니다.');
    },
    onClose,
  );
  return (
    <Dialog
      wide
      title={profile ? '프로필 수정' : '프로필 만들기'}
      description="나를 소개하는 기본 정보를 정리해 보세요. * 표시는 필수 항목입니다."
      onClose={form.close}
      canClose={!form.busy}
    >
      <form
        noValidate
        onChange={form.markDirty}
        onSubmit={(event) =>
          void form.submit(event, (data) => ({
            name: str(data, 'name'),
            email: str(data, 'email'),
            phone: str(data, 'phone'),
            targetRole: str(data, 'targetRole'),
            headline: str(data, 'headline'),
            competencies: splitTags(str(data, 'competencies')),
            skills: splitTags(str(data, 'skills')),
            githubUrl: str(data, 'githubUrl'),
            portfolioUrl: str(data, 'portfolioUrl'),
          }))
        }
      >
        <fieldset disabled={form.busy} className="form-content">
          {form.error && (
            <p role="alert" className="alert error">
              {form.error}
            </p>
          )}
          <div className="form-grid">
            <Field
              label="이름"
              name="name"
              autoComplete="name"
              required
              defaultValue={initial.name}
              error={form.errors.name}
            />
            <Field
              label="희망 직무"
              name="targetRole"
              defaultValue={initial.targetRole}
              placeholder="어떤 일을 하고 싶으신가요?"
              error={form.errors.targetRole}
            />
          </div>
          <Field
            label="한 줄 소개"
            name="headline"
            defaultValue={initial.headline}
            maxLength={300}
            placeholder="나의 경험과 강점을 한 문장으로 소개해 주세요."
            error={form.errors.headline}
          />
          <div className="form-grid">
            <Field
              label="이메일"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={initial.email}
              error={form.errors.email}
            />
            <Field
              label="연락처"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={initial.phone}
              error={form.errors.phone}
            />
          </div>
          <Field
            label="핵심역량"
            name="competencies"
            multiline
            defaultValue={initial.competencies.join('\n')}
            hint="한 줄에 하나씩, 직접 경험한 역량을 적어 주세요."
            error={form.errors.competencies}
          />
          <Field
            label="기술스택"
            name="skills"
            defaultValue={initial.skills.join(', ')}
            placeholder="React, TypeScript"
            hint="쉼표로 구분해 주세요."
            error={form.errors.skills}
          />
          <div className="form-grid">
            <Field
              label="GitHub URL"
              name="githubUrl"
              type="url"
              defaultValue={initial.githubUrl}
              placeholder="https://github.com/…"
              error={form.errors.githubUrl}
            />
            <Field
              label="포트폴리오 URL"
              name="portfolioUrl"
              type="url"
              defaultValue={initial.portfolioUrl}
              placeholder="https://…"
              error={form.errors.portfolioUrl}
            />
          </div>
        </fieldset>
        <FormFooter busy={form.busy} onClose={form.close} label="프로필 저장" />
      </form>
    </Dialog>
  );
}

function PeriodFields({
  initial,
  current,
  setCurrent,
  errors,
  career = false,
}: {
  initial: { startDate: string; endDate: string };
  current: boolean;
  setCurrent: (value: boolean) => void;
  errors: Record<string, string>;
  career?: boolean;
}) {
  return (
    <div className="period-fields">
      <div className="form-grid">
        <Field
          label="시작일"
          name="startDate"
          type="month"
          required
          defaultValue={initial.startDate}
          error={errors.startDate}
        />
        <Field
          label="종료일"
          name="endDate"
          type="month"
          disabled={current}
          required={!current}
          defaultValue={initial.endDate}
          error={errors.endDate}
        />
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="current"
          checked={current}
          onChange={(event) => setCurrent(event.target.checked)}
        />
        {career ? '현재 재직 중' : '현재 진행 중'}
      </label>
    </div>
  );
}

export function CareerForm({ career, onClose }: { career?: Career; onClose: () => void }) {
  const initial = career ?? emptyCareer;
  const [current, setCurrent] = useState(initial.current);
  const notice = useNotice();
  const form = useRecordForm(
    careerInputSchema,
    async (value) => {
      await repository.saveCareer(value, career?.id);
      notice('경력을 저장했습니다.');
    },
    onClose,
  );
  return (
    <Dialog
      wide
      title={career ? '경력 수정' : '경력 추가'}
      description="어디에서, 어떤 역할로 일했는지 기록하세요. * 표시는 필수 항목입니다."
      onClose={form.close}
      canClose={!form.busy}
    >
      <form
        noValidate
        onChange={form.markDirty}
        onSubmit={(event) =>
          void form.submit(event, (data) => ({
            company: str(data, 'company'),
            department: str(data, 'department'),
            position: str(data, 'position'),
            startDate: str(data, 'startDate'),
            endDate: current ? '' : str(data, 'endDate'),
            current,
            responsibilities: str(data, 'responsibilities'),
            achievements: str(data, 'achievements'),
          }))
        }
      >
        <fieldset disabled={form.busy} className="form-content">
          {form.error && (
            <p role="alert" className="alert error">
              {form.error}
            </p>
          )}
          <Field
            label="회사명"
            name="company"
            required
            defaultValue={initial.company}
            error={form.errors.company}
          />
          <div className="form-grid">
            <Field
              label="부서"
              name="department"
              defaultValue={initial.department}
              error={form.errors.department}
            />
            <Field
              label="직책 / 직무"
              name="position"
              required
              defaultValue={initial.position}
              error={form.errors.position}
            />
          </div>
          <PeriodFields
            career
            initial={initial}
            current={current}
            setCurrent={setCurrent}
            errors={form.errors}
          />
          <Field
            label="담당업무"
            name="responsibilities"
            multiline
            defaultValue={initial.responsibilities}
            placeholder="주요 업무와 책임 범위를 기록해 주세요."
            error={form.errors.responsibilities}
          />
          <Field
            label="성과 및 주요 기여"
            name="achievements"
            multiline
            defaultValue={initial.achievements}
            hint="확인할 수 있는 사실과 근거를 함께 남겨 주세요."
            error={form.errors.achievements}
          />
        </fieldset>
        <FormFooter busy={form.busy} onClose={form.close} label="경력 저장" />
      </form>
    </Dialog>
  );
}

export function ProjectForm({
  project,
  careers,
  onClose,
}: {
  project?: Project;
  careers: Career[];
  onClose: () => void;
}) {
  const initial = project ?? emptyProject;
  const [current, setCurrent] = useState(initial.current);
  const notice = useNotice();
  const form = useRecordForm(
    projectInputSchema,
    async (value) => {
      await repository.saveProject(value, project?.id);
      notice('프로젝트를 저장했습니다.');
    },
    onClose,
  );
  const narratives = [
    ['problem', '해결하려던 문제'],
    ['goal', '프로젝트 목표'],
    ['contribution', '본인 담당 범위와 기여'],
    ['techReason', '기술 선택 이유'],
    ['implementation', '설계 및 구현'],
    ['troubleshooting', '문제와 해결 과정'],
    ['outcome', '결과 및 성과'],
    ['reflection', '회고'],
  ] as const;
  return (
    <Dialog
      wide
      title={project ? '프로젝트 수정' : '프로젝트 추가'}
      description="작은 경험도 좋은 커리어의 근거가 됩니다. * 표시는 필수 항목입니다."
      onClose={form.close}
      canClose={!form.busy}
    >
      <form
        noValidate
        onChange={form.markDirty}
        onSubmit={(event) =>
          void form.submit(event, (data) => ({
            name: str(data, 'name'),
            summary: str(data, 'summary'),
            careerId: str(data, 'careerId'),
            startDate: str(data, 'startDate'),
            endDate: current ? '' : str(data, 'endDate'),
            current,
            role: str(data, 'role'),
            teamSize: str(data, 'teamSize') ? Number(str(data, 'teamSize')) : null,
            skills: splitTags(str(data, 'skills')),
            ...Object.fromEntries(narratives.map(([key]) => [key, str(data, key)])),
            githubUrl: str(data, 'githubUrl'),
            demoUrl: str(data, 'demoUrl'),
            resourceUrl: str(data, 'resourceUrl'),
          }))
        }
      >
        <fieldset disabled={form.busy} className="form-content">
          {form.error && (
            <p role="alert" className="alert error">
              {form.error}
            </p>
          )}
          <Field
            label="프로젝트명"
            name="name"
            required
            defaultValue={initial.name}
            error={form.errors.name}
          />
          <Field
            label="프로젝트 개요"
            name="summary"
            multiline
            maxLength={500}
            defaultValue={initial.summary}
            placeholder="어떤 문제를 해결하는 프로젝트인가요?"
            error={form.errors.summary}
          />
          <SelectField label="연결할 경력" name="careerId" defaultValue={initial.careerId}>
            <option value="">개인 / 기타 프로젝트</option>
            {careers.map((career) => (
              <option value={career.id} key={career.id}>
                {career.company} · {career.position}
              </option>
            ))}
          </SelectField>
          <PeriodFields
            initial={initial}
            current={current}
            setCurrent={setCurrent}
            errors={form.errors}
          />
          <div className="form-grid">
            <Field
              label="나의 역할"
              name="role"
              defaultValue={initial.role}
              error={form.errors.role}
            />
            <Field
              label="참여 인원"
              name="teamSize"
              type="number"
              min={1}
              max={100000}
              defaultValue={initial.teamSize ?? ''}
              error={form.errors.teamSize}
            />
          </div>
          <Field
            label="사용 기술"
            name="skills"
            defaultValue={initial.skills.join(', ')}
            placeholder="React, TypeScript"
            hint="쉼표로 구분해 주세요."
            error={form.errors.skills}
          />
          <details className="form-details" open={!!project}>
            <summary>
              문제 해결과 기여 기록 <span>선택</span>
            </summary>
            <p className="muted">
              내가 한 일, 선택한 이유, 확인 가능한 결과를 구분해서 기록하세요.
            </p>
            {narratives.map(([key, label]) => (
              <Field
                key={key}
                label={label}
                name={key}
                multiline
                defaultValue={initial[key]}
                error={form.errors[key]}
              />
            ))}
          </details>
          <details className="form-details" open={!!project}>
            <summary>
              링크와 참고자료 <span>선택</span>
            </summary>
            <Field
              label="GitHub URL"
              name="githubUrl"
              type="url"
              defaultValue={initial.githubUrl}
              error={form.errors.githubUrl}
            />
            <Field
              label="데모 URL"
              name="demoUrl"
              type="url"
              defaultValue={initial.demoUrl}
              error={form.errors.demoUrl}
            />
            <Field
              label="자료 / 이미지 URL"
              name="resourceUrl"
              type="url"
              defaultValue={initial.resourceUrl}
              hint="자료는 링크로 보관합니다. 원본 파일을 업로드하지 않습니다."
              error={form.errors.resourceUrl}
            />
          </details>
        </fieldset>
        <FormFooter busy={form.busy} onClose={form.close} label="프로젝트 저장" />
      </form>
    </Dialog>
  );
}

import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  copyCareer,
  copyProject,
  moveItem,
  sectionVisible,
  type ResumeSources,
} from '../../data/resume';
import {
  sectionLabels,
  type ResumeAchievement,
  type ResumeDocument,
} from '../../data/resume-schema';
import { Button } from '../ui/button';
import { RequiredMark } from '../ui/field';
import { OrderButtons, ResumeCheck, ResumeInput, ResumeListInput } from './inputs';

function Achievements({
  values,
  onChange,
}: {
  values: ResumeAchievement[];
  onChange: (values: ResumeAchievement[]) => void;
}) {
  return (
    <div className="resume-achievements">
      <h4>주요 성과 선택</h4>
      {values.map((item, index) => (
        <div className="resume-achievement" key={item.id}>
          <ResumeCheck
            checked={item.included}
            onChange={(included) =>
              onChange(
                values.map((entry) => (entry.id === item.id ? { ...entry, included } : entry)),
              )
            }
          >
            성과 {index + 1} 포함
          </ResumeCheck>
          <ResumeInput
            label={`성과 ${index + 1} 문구`}
            value={item.text}
            onChange={(text) =>
              onChange(values.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)))
            }
            multiline
          />
          <ResumeInput
            label={`성과 ${index + 1} 근거`}
            value={item.evidence}
            onChange={(evidence) =>
              onChange(
                values.map((entry) => (entry.id === item.id ? { ...entry, evidence } : entry)),
              )
            }
            hint="측정 방법, 확인 가능한 자료 등 직접 검증한 내용을 적으세요."
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...values, { id: crypto.randomUUID(), text: '', evidence: '', included: true }])
        }
      >
        <Plus size={14} />
        성과 추가
      </Button>
    </div>
  );
}

export function EditorFields({
  document,
  change,
  sources,
  refresh,
}: {
  document: ResumeDocument;
  change: (document: ResumeDocument) => void;
  sources: ResumeSources;
  refresh: () => void;
}) {
  const profile = document.profile;
  const setProfile = (key: keyof typeof profile, value: string | string[]) =>
    change({ ...document, profile: { ...profile, [key]: value } });
  return (
    <div className="resume-editor-fields">
      <section className="resume-edit-section">
        <h2>지원 정보</h2>
        <p className="field-hint">
          <RequiredMark /> 표시는 제출 시 필수 항목입니다. 작성 중인 초안은 빈 항목도 저장됩니다.
        </p>
        <ResumeInput
          label="이력서 제목"
          value={document.title}
          maxLength={300}
          onChange={(title) => change({ ...document, title })}
        />
        <div className="form-grid">
          <ResumeInput
            label="지원 기업명"
            value={document.company}
            maxLength={300}
            onChange={(company) => change({ ...document, company })}
          />
          <ResumeInput
            label="지원 직무"
            required
            value={document.role}
            maxLength={300}
            onChange={(role) => change({ ...document, role })}
          />
        </div>
        <label className="field">
          <span>
            문서 종류
            <RequiredMark />
          </span>
          <select
            required
            className="input"
            value={document.format}
            onChange={(event) =>
              change({ ...document, format: event.target.value as ResumeDocument['format'] })
            }
          >
            <option value="resume">이력서 · 핵심 기여와 성과</option>
            <option value="career-description">경력기술서 · 설계 및 구현 포함</option>
          </select>
        </label>
        <p className="field-hint">제목과 기업명은 보관용입니다. 출력에는 지원 직무가 표시됩니다.</p>
      </section>
      <details className="resume-edit-section" open>
        <summary>프로필 및 핵심역량</summary>
        <div className="form-grid">
          <ResumeInput
            label="이름"
            required
            value={profile.name}
            maxLength={300}
            onChange={(value) => setProfile('name', value)}
          />
          <ResumeInput
            label="이메일"
            required={!profile.phone.trim()}
            hint="이메일과 연락처 중 하나 이상 입력해 주세요."
            value={profile.email}
            maxLength={300}
            onChange={(value) => setProfile('email', value)}
          />
        </div>
        <ResumeInput
          label="연락처"
          required={!profile.email.trim()}
          value={profile.phone}
          maxLength={300}
          onChange={(value) => setProfile('phone', value)}
        />
        <ResumeInput
          label="한 줄 소개"
          value={profile.headline}
          onChange={(value) => setProfile('headline', value)}
          multiline
        />
        <ResumeListInput
          label="핵심역량"
          values={profile.competencies}
          onChange={(value) => setProfile('competencies', value)}
        />
        <ResumeListInput
          label="기술스택"
          values={profile.skills}
          onChange={(value) => setProfile('skills', value)}
        />
        <ResumeInput
          label="GitHub URL"
          value={profile.githubUrl}
          maxLength={2000}
          onChange={(value) => setProfile('githubUrl', value)}
        />
        <ResumeInput
          label="포트폴리오 URL"
          value={profile.portfolioUrl}
          maxLength={2000}
          onChange={(value) => setProfile('portfolioUrl', value)}
        />
        <ResumeInput
          label="추가 소개 / 맞춤 문구"
          value={document.note}
          onChange={(note) => change({ ...document, note })}
          multiline
        />
      </details>
      <details className="resume-edit-section">
        <summary>섹션 표시 및 순서</summary>
        {document.sections.map((section, index) => (
          <div className="resume-select-row" key={section.key}>
            <ResumeCheck
              checked={section.visible}
              onChange={(visible) =>
                change({
                  ...document,
                  sections: document.sections.map((item) =>
                    item.key === section.key ? { ...item, visible } : item,
                  ),
                })
              }
            >
              {sectionLabels[section.key]} 표시
            </ResumeCheck>
            <OrderButtons
              label={`${sectionLabels[section.key]} 섹션`}
              index={index}
              length={document.sections.length}
              move={(direction) =>
                change({ ...document, sections: moveItem(document.sections, index, direction) })
              }
            />
          </div>
        ))}
      </details>
      <details className="resume-edit-section" open>
        <summary>경력 선택 및 맞춤 문구</summary>
        <p className="muted">이곳의 수정은 원본 경력에 반영되지 않습니다.</p>
        {document.careers.map((career, index) => (
          <div className="resume-entry-editor" key={career.sourceId}>
            <div className="resume-select-row">
              <ResumeCheck
                checked={career.included}
                onChange={(included) =>
                  change({
                    ...document,
                    careers: document.careers.map((item) =>
                      item.sourceId === career.sourceId ? { ...item, included } : item,
                    ),
                  })
                }
              >
                {career.company || '이름 없는 경력'} 포함
              </ResumeCheck>
              <OrderButtons
                label={career.company || '경력'}
                index={index}
                length={document.careers.length}
                move={(direction) =>
                  change({ ...document, careers: moveItem(document.careers, index, direction) })
                }
              />
            </div>
            <details>
              <summary>경력 문구 편집</summary>
              {(
                [
                  'company',
                  'position',
                  'department',
                  'startDate',
                  'endDate',
                  'responsibilities',
                ] as const
              ).map((key) => (
                <ResumeInput
                  key={key}
                  label={
                    {
                      company: '회사명',
                      position: '직책',
                      department: '부서',
                      startDate: '시작일',
                      endDate: '종료일',
                      responsibilities: '담당업무',
                    }[key]
                  }
                  value={career[key]}
                  required={
                    career.included &&
                    sectionVisible(document, 'careers') &&
                    (key === 'startDate' || (key === 'endDate' && !career.current))
                  }
                  disabled={key === 'endDate' && career.current}
                  multiline={key === 'responsibilities'}
                  type={key.endsWith('Date') ? 'month' : 'text'}
                  maxLength={key === 'responsibilities' ? 12000 : 300}
                  onChange={(value) =>
                    change({
                      ...document,
                      careers: document.careers.map((item) =>
                        item.sourceId === career.sourceId ? { ...item, [key]: value } : item,
                      ),
                    })
                  }
                />
              ))}
              <ResumeCheck
                checked={career.current}
                onChange={(current) =>
                  change({
                    ...document,
                    careers: document.careers.map((item) =>
                      item.sourceId === career.sourceId
                        ? { ...item, current, endDate: current ? '' : item.endDate }
                        : item,
                    ),
                  })
                }
              >
                현재 재직 중
              </ResumeCheck>
              <Achievements
                values={career.achievements}
                onChange={(achievements) =>
                  change({
                    ...document,
                    careers: document.careers.map((item) =>
                      item.sourceId === career.sourceId ? { ...item, achievements } : item,
                    ),
                  })
                }
              />
            </details>
          </div>
        ))}
        {!document.careers.length && (
          <p className="muted">내 경력에서 경력을 먼저 등록해 주세요.</p>
        )}
        {sources.careers
          .filter((item) => !document.careers.some((career) => career.sourceId === item.id))
          .map((item) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              onClick={() =>
                change({ ...document, careers: [...document.careers, copyCareer(item)] })
              }
            >
              <Plus size={14} />
              {item.company} 가져오기
            </Button>
          ))}
      </details>
      <details className="resume-edit-section" open>
        <summary>프로젝트 선택 및 순서</summary>
        <p className="muted">
          회사에 연결된 프로젝트는 해당 경력 아래에 표시됩니다. 순서는 같은 회사 안에서 적용됩니다.
        </p>
        {document.projects.map((project, index) => (
          <div className="resume-entry-editor" key={project.sourceId}>
            <div className="resume-select-row">
              <ResumeCheck
                checked={project.included}
                onChange={(included) =>
                  change({
                    ...document,
                    projects: document.projects.map((item) =>
                      item.sourceId === project.sourceId ? { ...item, included } : item,
                    ),
                  })
                }
              >
                {project.name || '이름 없는 프로젝트'} 포함
              </ResumeCheck>
              <OrderButtons
                label={project.name || '프로젝트'}
                index={index}
                length={document.projects.length}
                move={(direction) =>
                  change({ ...document, projects: moveItem(document.projects, index, direction) })
                }
              />
            </div>
            <details>
              <summary>프로젝트 문구 편집</summary>
              {(
                [
                  'name',
                  'role',
                  'startDate',
                  'endDate',
                  'summary',
                  'contribution',
                  'implementation',
                  'githubUrl',
                  'demoUrl',
                ] as const
              ).map((key) => (
                <ResumeInput
                  key={key}
                  label={
                    {
                      name: '프로젝트명',
                      role: '담당 역할',
                      startDate: '시작일',
                      endDate: '종료일',
                      summary: '프로젝트 개요',
                      contribution: '본인 기여',
                      implementation: '설계 및 구현 · 경력기술서에 출력',
                      githubUrl: '프로젝트 GitHub URL',
                      demoUrl: '프로젝트 데모 URL',
                    }[key]
                  }
                  value={project[key]}
                  required={
                    project.included &&
                    sectionVisible(document, 'projects') &&
                    (key === 'role' ||
                      key === 'startDate' ||
                      (key === 'endDate' && !project.current))
                  }
                  disabled={key === 'endDate' && project.current}
                  type={key.endsWith('Date') ? 'month' : 'text'}
                  multiline={['summary', 'contribution', 'implementation'].includes(key)}
                  maxLength={
                    ['name', 'role'].includes(key) ? 300 : key.endsWith('Url') ? 2000 : 12000
                  }
                  onChange={(value) =>
                    change({
                      ...document,
                      projects: document.projects.map((item) =>
                        item.sourceId === project.sourceId ? { ...item, [key]: value } : item,
                      ),
                    })
                  }
                />
              ))}
              <ResumeCheck
                checked={project.current}
                onChange={(current) =>
                  change({
                    ...document,
                    projects: document.projects.map((item) =>
                      item.sourceId === project.sourceId
                        ? { ...item, current, endDate: current ? '' : item.endDate }
                        : item,
                    ),
                  })
                }
              >
                현재 진행 중
              </ResumeCheck>
              <ResumeListInput
                label="프로젝트 사용 기술"
                values={project.skills}
                onChange={(skills) =>
                  change({
                    ...document,
                    projects: document.projects.map((item) =>
                      item.sourceId === project.sourceId ? { ...item, skills } : item,
                    ),
                  })
                }
              />
              <ResumeCheck
                checked={project.showSkills}
                onChange={(showSkills) =>
                  change({
                    ...document,
                    projects: document.projects.map((item) =>
                      item.sourceId === project.sourceId ? { ...item, showSkills } : item,
                    ),
                  })
                }
              >
                사용 기술 표시
              </ResumeCheck>
              <Achievements
                values={project.achievements}
                onChange={(achievements) =>
                  change({
                    ...document,
                    projects: document.projects.map((item) =>
                      item.sourceId === project.sourceId ? { ...item, achievements } : item,
                    ),
                  })
                }
              />
            </details>
          </div>
        ))}
        {!document.projects.length && (
          <p className="muted">프로젝트를 등록한 뒤 가져올 수 있습니다.</p>
        )}
        {sources.projects
          .filter((item) => !document.projects.some((project) => project.sourceId === item.id))
          .map((item) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              onClick={() => {
                const career = sources.careers.find((entry) => entry.id === item.careerId);
                change({
                  ...document,
                  careers:
                    career && !document.careers.some((entry) => entry.sourceId === career.id)
                      ? [...document.careers, copyCareer(career)]
                      : document.careers,
                  projects: [...document.projects, copyProject(item)],
                });
              }}
            >
              <Plus size={14} />
              {item.name} 가져오기
            </Button>
          ))}
      </details>
      <details className="resume-edit-section">
        <summary>학력 · 자격증 · 수상 · 외국어</summary>
        <p className="muted">이 이력서에 별도로 저장됩니다. 복제하면 함께 복사됩니다.</p>
        <h3>학력</h3>
        {document.education.map((item) => (
          <div className="resume-entry-editor" key={item.id}>
            {(['school', 'degree', 'major', 'startDate', 'endDate', 'detail'] as const).map(
              (key) => (
                <ResumeInput
                  key={key}
                  label={
                    {
                      school: '학교명',
                      degree: '학위 / 상태',
                      major: '전공',
                      startDate: '입학 연월',
                      endDate: '졸업 연월',
                      detail: '학력 설명',
                    }[key]
                  }
                  value={item[key]}
                  required={key === 'school' && sectionVisible(document, 'education')}
                  type={key.endsWith('Date') ? 'month' : 'text'}
                  multiline={key === 'detail'}
                  maxLength={key === 'detail' ? 12000 : 300}
                  onChange={(value) =>
                    change({
                      ...document,
                      education: document.education.map((entry) =>
                        entry.id === item.id ? { ...entry, [key]: value } : entry,
                      ),
                    })
                  }
                />
              ),
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('이 학력 항목을 삭제할까요?'))
                  change({
                    ...document,
                    education: document.education.filter((entry) => entry.id !== item.id),
                  });
              }}
            >
              <Trash2 size={14} />
              학력 삭제
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            change({
              ...document,
              education: [
                ...document.education,
                {
                  id: crypto.randomUUID(),
                  school: '',
                  degree: '',
                  major: '',
                  startDate: '',
                  endDate: '',
                  detail: '',
                },
              ],
            })
          }
        >
          <Plus size={14} />
          학력 추가
        </Button>
        <h3>자격증 및 수상</h3>
        {document.qualifications.map((item) => (
          <div className="resume-entry-editor" key={item.id}>
            <label className="field">
              <span>
                분류
                <RequiredMark />
              </span>
              <select
                required
                className="input"
                value={item.category}
                onChange={(event) =>
                  change({
                    ...document,
                    qualifications: document.qualifications.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, category: event.target.value as typeof item.category }
                        : entry,
                    ),
                  })
                }
              >
                <option>자격증</option>
                <option>수상</option>
              </select>
            </label>
            {(['name', 'issuer', 'date', 'detail'] as const).map((key) => (
              <ResumeInput
                key={key}
                label={
                  {
                    name: '자격증 / 수상 이름',
                    issuer: '발급 / 주관 기관',
                    date: '취득 / 수상 연월',
                    detail: '자격증 / 수상 설명',
                  }[key]
                }
                value={item[key]}
                required={key === 'name' && sectionVisible(document, 'qualifications')}
                type={key === 'date' ? 'month' : 'text'}
                multiline={key === 'detail'}
                maxLength={key === 'detail' ? 12000 : 300}
                onChange={(value) =>
                  change({
                    ...document,
                    qualifications: document.qualifications.map((entry) =>
                      entry.id === item.id ? { ...entry, [key]: value } : entry,
                    ),
                  })
                }
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('이 자격증 / 수상 항목을 삭제할까요?'))
                  change({
                    ...document,
                    qualifications: document.qualifications.filter((entry) => entry.id !== item.id),
                  });
              }}
            >
              <Trash2 size={14} />
              자격증 / 수상 삭제
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            change({
              ...document,
              qualifications: [
                ...document.qualifications,
                {
                  id: crypto.randomUUID(),
                  category: '자격증',
                  name: '',
                  issuer: '',
                  date: '',
                  detail: '',
                },
              ],
            })
          }
        >
          <Plus size={14} />
          자격증 / 수상 추가
        </Button>
        <h3>외국어</h3>
        {document.languages.map((item) => (
          <div className="resume-entry-editor" key={item.id}>
            {(['name', 'level', 'test', 'date'] as const).map((key) => (
              <ResumeInput
                key={key}
                label={
                  { name: '언어', level: '구사 수준', test: '시험 / 점수', date: '응시 연월' }[key]
                }
                value={item[key]}
                required={key === 'name' && sectionVisible(document, 'languages')}
                maxLength={300}
                type={key === 'date' ? 'month' : 'text'}
                onChange={(value) =>
                  change({
                    ...document,
                    languages: document.languages.map((entry) =>
                      entry.id === item.id ? { ...entry, [key]: value } : entry,
                    ),
                  })
                }
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('이 외국어 항목을 삭제할까요?'))
                  change({
                    ...document,
                    languages: document.languages.filter((entry) => entry.id !== item.id),
                  });
              }}
            >
              <Trash2 size={14} />
              외국어 삭제
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            change({
              ...document,
              languages: [
                ...document.languages,
                { id: crypto.randomUUID(), name: '', level: '', test: '', date: '' },
              ],
            })
          }
        >
          <Plus size={14} />
          외국어 추가
        </Button>
      </details>
      <section className="resume-edit-section">
        <h2>최신 원본 반영</h2>
        <p className="muted">
          기존 맞춤 문구를 교체합니다. 원본만 수정했을 때 초안과 과거 제출본은 자동으로 바뀌지
          않습니다.
        </p>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw size={15} />
          원본에서 다시 가져오기
        </Button>
      </section>
    </div>
  );
}

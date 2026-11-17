import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../hooks/app-context';
import { useAutosave } from '../hooks/use-autosave';
import { useJobAction, jobError } from '../hooks/use-job-action';
import { db } from '../data/db';
import { portfolioRepository } from '../data/portfolio-repository';
import { portfolioSections, type Portfolio, type PortfolioProject } from '../data/portfolio-schema';
import {
  publicData,
  portfolioProject,
  imageExtension,
  publicationWarnings,
} from '../data/portfolio';
import { moveItem } from '../data/resume';
import { SaveGuard, SaveState } from '../components/interview/shared';
import {
  ResumeInput,
  ResumeCheck,
  ResumeListInput,
  OrderButtons,
} from '../components/resume/inputs';
import { Choice } from '../components/jobs/shared';
import { Button } from '../components/ui/button';
import { PublicPortfolioView } from '../components/portfolio/public-view';
import { downloadFile } from '../lib/files';

const projectLabels = {
  name: '프로젝트명',
  summary: '프로젝트 한 줄 소개',
  background: '프로젝트 목적 및 배경',
  problem: '해결하려던 문제',
  role: '본인 역할과 담당 범위',
  techReason: '기술 선택 이유',
  architecture: '시스템 아키텍처',
  features: '주요 기능',
  implementation: '구현 과정',
  troubleshooting: '기술적 문제 해결',
  outcome: '결과 및 성과',
  reflection: '한계와 개선사항',
  githubUrl: '프로젝트 GitHub',
  demoUrl: '프로젝트 데모',
} as const;
export function PortfolioEditorPage() {
  const { id } = useParams();
  const { portfolios } = useAppData();
  const p = portfolios.find((p) => p.id === id);
  return p ? (
    <PortfolioEditor key={p.id} portfolio={p} />
  ) : (
    <section className="jobs-section">
      <h1>포트폴리오를 찾을 수 없습니다.</h1>
      <Link to="/portfolios">포트폴리오 목록</Link>
    </section>
  );
}
function PortfolioEditor({ portfolio }: { portfolio: Portfolio }) {
  const originals = useAppData();
  const draft = useAutosave(portfolio, portfolioRepository.save);
  const action = useJobAction();
  const content = draft.content;
  const [reviewed, setReviewed] = useState('');
  const [approved, setApproved] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let urls: Record<string, string> = {};
    const subscription = liveQuery(() =>
      db.portfolioAssets.where('portfolioId').equals(portfolio.id).toArray(),
    ).subscribe((assets) => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
      urls = {};
      for (const a of assets)
        urls[`images/${a.id}.${imageExtension(a.blob.type)}`] = URL.createObjectURL(a.blob);
      setImageUrls(urls);
    });
    return () => {
      subscription.unsubscribe();
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [portfolio.id]);
  let preview: ReturnType<typeof publicData> | null = null;
  let previewError = '';
  try {
    preview = publicData(content);
  } catch (cause) {
    previewError = jobError(cause);
  }
  const fingerprint = preview ? JSON.stringify(preview) : '';
  const warnings = publicationWarnings(content);
  const current = originals.portfolios.find((p) => p.id === portfolio.id) ?? portfolio;
  const changeProject = (project: PortfolioProject) =>
    draft.change({
      ...content,
      projects: content.projects.map((p) => (p.id === project.id ? project : p)),
    });
  const imageInput = (p: PortfolioProject, replaceId?: string) => (
    <label className="field">
      {replaceId ? '이미지 파일 다시 연결' : '프로젝트 이미지 추가'}
      <input
        className="input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={action.busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          const input = e.target;
          if (!file) return;
          void action.run(async () => {
            await draft.flush();
            const image = await portfolioRepository.addImage(portfolio.id, file);
            draft.change((c) => ({
              ...c,
              projects: c.projects.map((project) =>
                project.id !== p.id
                  ? project
                  : {
                      ...project,
                      images: replaceId
                        ? project.images.map((old) =>
                            old.id === replaceId
                              ? { ...image, alt: old.alt, caption: old.caption }
                              : old,
                          )
                        : [...project.images, image],
                    },
              ),
            }));
            input.value = '';
          }, '이미지를 보관했습니다. 공개 여부는 별도로 선택하세요.');
        }}
      />
    </label>
  );
  return (
    <div className="jobs-page">
      <Link className="text-link" to="/portfolios">
        ← 포트폴리오 목록
      </Link>
      <h1>포트폴리오 작성</h1>
      <SaveState {...draft} />
      {action.error && (
        <p className="alert error" role="alert">
          {action.error}
        </p>
      )}
      <p className="inline-note">
        초안과 이미지는 비공개입니다. 공개 제목은 내보내기에 항상 포함되며, 나머지는 선택한
        섹션·항목만 포함됩니다. 원본 경력과 프로젝트는 변경되지 않습니다.
      </p>
      <fieldset className="portfolio-edit-fields" disabled={action.busy}>
        <div className="portfolio-workbench">
          <div>
            <section className="jobs-section">
              <h2>기본 정보와 공개 섹션</h2>
              {[
                ['title', '공개 포트폴리오 제목'],
                ['headline', '한 줄 소개'],
                ['role', '희망 직무'],
                ['about', '자기소개'],
                ['qualifications', '수상 및 자격증'],
                ['githubUrl', '공개 GitHub'],
                ['demoUrl', '공개 데모 사이트'],
                ['contact', '공개용 이메일'],
              ].map(([key, label]) => (
                <ResumeInput
                  key={key}
                  label={label}
                  required={key === 'title'}
                  multiline={['about', 'qualifications'].includes(key)}
                  maxLength={
                    ['about', 'qualifications', 'headline'].includes(key)
                      ? 30000
                      : key.endsWith('Url')
                        ? 2000
                        : 300
                  }
                  value={
                    content[
                      key as
                        | 'title'
                        | 'headline'
                        | 'role'
                        | 'about'
                        | 'qualifications'
                        | 'githubUrl'
                        | 'demoUrl'
                        | 'contact'
                    ]
                  }
                  onChange={(v) => draft.change({ ...content, [key]: v })}
                />
              ))}
              <ResumeListInput
                label="공개용 핵심역량"
                values={content.competencies}
                onChange={(competencies) => draft.change({ ...content, competencies })}
              />
              <ResumeListInput
                label="공개용 기술스택"
                values={content.skills}
                onChange={(skills) => draft.change({ ...content, skills })}
              />
              <Choice
                label="작성 상태"
                value={content.status}
                onChange={(status) =>
                  draft.change({ ...content, status: status as typeof content.status })
                }
              >
                <option>작성 중</option>
                <option>공개 검토 중</option>
                <option>공개 준비 완료</option>
              </Choice>
              <h3>공개할 섹션</h3>
              {portfolioSections.map((s) => (
                <ResumeCheck
                  key={s}
                  checked={content.sections.includes(s)}
                  onChange={(yes) =>
                    draft.change({
                      ...content,
                      sections: yes
                        ? [...content.sections, s]
                        : content.sections.filter((v) => v !== s),
                    })
                  }
                >
                  {s} 섹션 공개
                </ResumeCheck>
              ))}
            </section>
            <section className="jobs-section">
              <h2>경력 공개 문구</h2>
              {content.careers.map((c, i) => (
                <details key={c.id}>
                  <summary>
                    {c.company || '회사명 미입력'} · {c.included ? '공개 선택' : '비공개'}
                  </summary>
                  <ResumeCheck
                    checked={c.included}
                    onChange={(included) =>
                      draft.change({
                        ...content,
                        careers: content.careers.map((v) =>
                          v.id === c.id ? { ...v, included } : v,
                        ),
                      })
                    }
                  >
                    {c.company} 경력 공개
                  </ResumeCheck>
                  {[
                    ['company', '공개 회사명'],
                    ['position', '공개 직책'],
                    ['period', '공개 재직 기간'],
                    ['description', '공개 경력 설명'],
                  ].map(([key, label]) => (
                    <ResumeInput
                      key={key}
                      label={label}
                      value={c[key as 'company' | 'position' | 'period' | 'description']}
                      multiline={key === 'description'}
                      onChange={(value) =>
                        draft.change({
                          ...content,
                          careers: content.careers.map((v) =>
                            v.id === c.id ? { ...v, [key]: value } : v,
                          ),
                        })
                      }
                    />
                  ))}
                  <OrderButtons
                    label={`${c.company} 경력`}
                    index={i}
                    length={content.careers.length}
                    move={(direction) =>
                      draft.change({ ...content, careers: moveItem(content.careers, i, direction) })
                    }
                  />
                </details>
              ))}
            </section>
            <section className="jobs-section">
              <h2>프로젝트 상세</h2>
              <Choice label="추가로 가져올 프로젝트" value={sourceId} onChange={setSourceId}>
                <option value="">선택</option>
                {originals.projects
                  .filter((p) => !content.projects.some((v) => v.sourceId === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Choice>
              <Button
                variant="outline"
                disabled={!sourceId}
                onClick={() => {
                  const source = originals.projects.find((p) => p.id === sourceId);
                  if (source)
                    draft.change({
                      ...content,
                      projects: [...content.projects, portfolioProject(source)],
                    });
                  setSourceId('');
                }}
              >
                선택 프로젝트 복사
              </Button>
              {content.projects.map((p, index) => (
                <details className="portfolio-project-editor" key={p.id}>
                  <summary>
                    {p.name || '프로젝트명 미입력'} · {p.included ? '공개 선택' : '비공개'}
                  </summary>
                  <ResumeCheck
                    checked={p.included}
                    onChange={(included) => changeProject({ ...p, included })}
                  >
                    {p.name} 프로젝트 공개
                  </ResumeCheck>
                  <OrderButtons
                    label={`${p.name} 프로젝트`}
                    index={index}
                    length={content.projects.length}
                    move={(direction) =>
                      draft.change({
                        ...content,
                        projects: moveItem(content.projects, index, direction),
                      })
                    }
                  />
                  {Object.entries(projectLabels).map(([key, label]) => (
                    <ResumeInput
                      key={key}
                      label={label}
                      required={key === 'name' && p.included}
                      multiline={!['name', 'githubUrl', 'demoUrl'].includes(key)}
                      maxLength={key === 'name' ? 300 : key.endsWith('Url') ? 2000 : 30000}
                      value={p[key as keyof typeof projectLabels]}
                      onChange={(v) => changeProject({ ...p, [key]: v })}
                    />
                  ))}
                  <ResumeListInput
                    label="프로젝트 기술 태그"
                    values={p.skills}
                    onChange={(skills) => changeProject({ ...p, skills })}
                  />
                  <h3>이미지 및 다이어그램</h3>
                  <p className="field-hint">
                    PNG·JPEG·WebP, 파일당 3MB·1,600만 픽셀 이하. 원본 메타데이터를 제거해 로컬에
                    보관합니다. JSON 백업에는 이미지 설명만 포함됩니다.
                  </p>
                  {imageInput(p)}
                  {p.images.map((i, n) => (
                    <div className="evidence-card" key={i.id}>
                      <p className="field-hint">
                        {i.name} · 별도 백업 파일: {i.id}.{imageExtension(i.mime)}
                      </p>
                      {imageUrls[`images/${i.id}.${imageExtension(i.mime)}`] ? (
                        <img
                          className="portfolio-image"
                          src={imageUrls[`images/${i.id}.${imageExtension(i.mime)}`]}
                          alt={i.alt || '업로드 이미지 · 대체 텍스트 작성 필요'}
                        />
                      ) : (
                        <p role="status">이미지 파일 없음 · 아래에서 다시 연결해 주세요.</p>
                      )}
                      <ResumeInput
                        label="이미지 대체 텍스트"
                        required={i.approved}
                        value={i.alt}
                        maxLength={300}
                        onChange={(alt) =>
                          changeProject({
                            ...p,
                            images: p.images.map((v) => (v.id === i.id ? { ...v, alt } : v)),
                          })
                        }
                      />
                      <ResumeInput
                        label="이미지 설명"
                        value={i.caption}
                        multiline
                        onChange={(caption) =>
                          changeProject({
                            ...p,
                            images: p.images.map((v) => (v.id === i.id ? { ...v, caption } : v)),
                          })
                        }
                      />
                      <ResumeCheck
                        checked={i.approved}
                        onChange={(approved) =>
                          changeProject({
                            ...p,
                            images: p.images.map((v) => (v.id === i.id ? { ...v, approved } : v)),
                          })
                        }
                      >
                        이 이미지의 공개를 승인합니다
                      </ResumeCheck>
                      <OrderButtons
                        label={`이미지 ${n + 1}`}
                        index={n}
                        length={p.images.length}
                        move={(direction) =>
                          changeProject({ ...p, images: moveItem(p.images, n, direction) })
                        }
                      />
                      {imageInput(p, i.id)}
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (
                            window.confirm(
                              '이 이미지를 프로젝트에서 제외할까요? 보관 파일은 과거 공개 이력을 위해 유지됩니다.',
                            )
                          )
                            changeProject({ ...p, images: p.images.filter((v) => v.id !== i.id) });
                        }}
                      >
                        이미지 제외
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm('초안에서 이 프로젝트를 삭제할까요? 원본은 유지됩니다.'))
                        draft.change({
                          ...content,
                          projects: content.projects.filter((v) => v.id !== p.id),
                        });
                    }}
                  >
                    초안 프로젝트 삭제
                  </Button>
                </details>
              ))}
            </section>
          </div>
          <aside
            className="portfolio-local-preview"
            tabIndex={0}
            role="region"
            aria-label="현재 브라우저 공개 미리보기"
          >
            {preview ? (
              <PublicPortfolioView data={preview} imageUrls={imageUrls} />
            ) : (
              <p className="alert error">공개 미리보기 확인: {previewError}</p>
            )}
          </aside>
        </div>
        <section className="jobs-section">
          <h2>공개 데이터 최종 확인</h2>
          <p>
            개인정보·회사명·내부 자료의 공개 가능 여부를 직접 확인하세요. 공개 파일에는 면접 답변,
            지원 내역, 이력서 원본이 자동으로 포함되지 않습니다.
          </p>
          {warnings.map((w) => (
            <p key={w} className="inline-note">
              {w}
            </p>
          ))}
          <label className="field">
            최종 공개 JSON
            <textarea
              className="input phase4-json"
              aria-label="최종 공개 JSON"
              rows={12}
              readOnly
              value={preview ? JSON.stringify(preview, null, 2) : previewError}
            />
          </label>
          <Button
            variant="outline"
            disabled={!preview || !!warnings.length}
            onClick={() => setReviewed(fingerprint)}
          >
            공개 미리보기와 JSON 확인 완료
          </Button>
          <ResumeCheck
            checked={approved === fingerprint && !!fingerprint}
            onChange={(yes) => setApproved(yes ? fingerprint : '')}
          >
            선택한 문구·회사 정보·연락처·이미지의 공개를 최종 승인합니다
          </ResumeCheck>
          <div className="jobs-actions">
            <Button
              disabled={
                !fingerprint ||
                reviewed !== fingerprint ||
                approved !== fingerprint ||
                !!warnings.length ||
                action.busy
              }
              onClick={() =>
                void action.run(async () => {
                  const saved = await draft.flush();
                  const zip = await portfolioRepository.publish(
                    portfolio.id,
                    saved.revision,
                    fingerprint,
                  );
                  const latest = (await db.portfolios.get(portfolio.id))!;
                  draft.accept(latest);
                  downloadFile(zip, 'career-os-public-portfolio.zip');
                  setReviewed('');
                  setApproved('');
                }, '승인한 공개 파일의 다운로드를 요청했습니다. 게시하려면 직접 GitHub에 반영하세요.')
              }
            >
              승인한 정적 파일 내보내기
            </Button>
            <Button
              variant="outline"
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  async () =>
                    downloadFile(
                      await portfolioRepository.imageArchive(portfolio.id),
                      'career-os-private-images.zip',
                    ),
                  '비공개 이미지 보관 파일의 다운로드를 요청했습니다.',
                )
              }
            >
              이미지 별도 백업
            </Button>
          </div>
          <p className="field-hint">
            공개 ZIP의 portfolio 폴더를 public/ 아래에 배치하고 직접 Commit·Push하세요. 공개 주소는
            /career-os/portfolio.html입니다. 이미지 별도 백업에는 비공개 이미지도 포함되므로
            게시하지 마세요.
          </p>
          <h3>공개 데이터 내보내기 이력</h3>
          <p className="field-hint">다운로드 요청 이력이며 실제 게시 여부를 의미하지 않습니다.</p>
          {current.publications.map((p) => (
            <details key={p.id}>
              <summary>
                {new Date(p.createdAt).toLocaleString('ko-KR')} · 초안 수정 {p.revision}
              </summary>
              <pre className="phase4-json" tabIndex={0}>
                {JSON.stringify(p.data, null, 2)}
              </pre>
            </details>
          ))}
        </section>
      </fieldset>
      <SaveGuard blocker={draft.blocker} flush={draft.flush} />
    </div>
  );
}

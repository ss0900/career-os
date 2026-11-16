import { useJobAction } from '../../hooks/use-job-action';
import { useState } from 'react';
import { useAppData } from '../../hooks/app-context';
import { buildJobPrompt, promptKinds } from '../../data/jobs';
import type { Job } from '../../data/jobs-schema';
import { jobsRepository } from '../../data/jobs-repository';
import { ResumeCheck, ResumeInput } from '../resume/inputs';
import { Button } from '../ui/button';
import { Choice, DataDialog } from './shared';

export function PromptPanel({ job }: { job: Job }) {
  const data = useAppData();
  const action = useJobAction();
  const [kind, setKind] = useState<string>(promptKinds[0]);
  const [include, setInclude] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [reviewed, setReviewed] = useState('');
  const [editing, setEditing] = useState<{ result: string; kind: string; prompt: string } | null>(
    null,
  );
  const [selected, setSelected] = useState('');
  const [compare, setCompare] = useState('');
  const toggle = (key: string) =>
    setInclude(include.includes(key) ? include.filter((v) => v !== key) : [...include, key]);
  const prompt = buildJobPrompt({
    kind,
    job: include.includes('jd') ? job : undefined,
    role: include.includes('role') ? data.profile?.targetRole || job.role : undefined,
    skills: include.includes('skills') ? (data.profile?.skills ?? []) : undefined,
    careers: data.careers.filter((c) => include.includes(c.id)),
    projects: data.projects.filter((p) => include.includes(p.id)),
    outcomes: include.includes('outcomes'),
    question,
  });
  const current = job.analyses.find((a) => a.id === selected) ?? job.analyses.at(-1);
  const older = job.analyses.find((a) => a.id === compare);
  return (
    <section className="jobs-section">
      <div className="section-heading">
        <h2>ChatGPT 분석 프롬프트</h2>
      </div>
      <p className="field-hint">
        선택한 정보로 프롬프트를 만듭니다. 직접 복사해 ChatGPT에서 사용하고 결과를 보관하세요.
      </p>
      {action.error && (
        <p className="alert error" role="alert">
          {action.error}
        </p>
      )}
      <Choice label="프롬프트 유형" value={kind} onChange={setKind}>
        {promptKinds.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </Choice>
      <div className="jobs-checks">
        {[
          ['jd', '채용공고 JD'],
          ['role', '희망 직무'],
          ['skills', '프로필 기술스택'],
          ['outcomes', '선택한 기록의 성과'],
        ].map(([key, label]) => (
          <ResumeCheck key={key} checked={include.includes(key)} onChange={() => toggle(key)}>
            {label}
          </ResumeCheck>
        ))}
        {data.careers.map((c) => (
          <ResumeCheck key={c.id} checked={include.includes(c.id)} onChange={() => toggle(c.id)}>
            경력 · {c.company}
          </ResumeCheck>
        ))}
        {data.projects.map((p) => (
          <ResumeCheck key={p.id} checked={include.includes(p.id)} onChange={() => toggle(p.id)}>
            프로젝트 · {p.name}
          </ResumeCheck>
        ))}
      </div>
      <ResumeInput label="추가로 확인받을 사항" value={question} onChange={setQuestion} multiline />
      <label className="field">
        전체 프롬프트 미리보기
        <textarea className="input prompt-preview" readOnly value={prompt} rows={12} />
      </label>
      <ResumeCheck
        checked={reviewed === prompt}
        onChange={(checked) => setReviewed(checked ? prompt : '')}
      >
        전체 내용을 읽고 개인정보·회사 내부 정보의 포함 여부를 확인했습니다.
      </ResumeCheck>
      <div className="jobs-actions">
        <Button
          disabled={reviewed !== prompt || action.busy}
          onClick={() =>
            void action.run(async () => {
              if (!navigator.clipboard)
                throw new Error(
                  '클립보드를 사용할 수 없습니다. 미리보기에서 직접 선택해 복사하세요.',
                );
              await navigator.clipboard.writeText(prompt);
            }, '프롬프트를 복사했습니다. 외부 전송은 하지 않았습니다.')
          }
        >
          프롬프트 복사
        </Button>
        <Button variant="outline" onClick={() => setEditing({ result: '', kind, prompt })}>
          분석 결과 입력
        </Button>
      </div>
      <h3>보관한 분석 결과</h3>
      {!current ? (
        <p className="muted">저장된 분석 결과가 없습니다.</p>
      ) : (
        <>
          <Choice label="분석 결과 버전" value={current.id} onChange={setSelected}>
            {job.analyses.map((a, i) => (
              <option value={a.id} key={a.id}>
                분석 {i + 1} · {a.kind} · {a.createdAt.slice(0, 10)}
              </option>
            ))}
          </Choice>
          <div className="jobs-comparison">
            <div tabIndex={0} role="region" aria-label="선택한 분석 결과">
              <h4>선택한 결과</h4>
              <p className="jobs-prose">{current.result}</p>
            </div>
            {older && (
              <div tabIndex={0} role="region" aria-label="비교할 분석 결과">
                <h4>
                  비교 결과 {older.result === current.result ? '· 내용 동일' : '· 내용 차이 있음'}
                </h4>
                <p className="jobs-prose">{older.result}</p>
              </div>
            )}
          </div>
          <Choice label="이전 분석과 비교" value={compare} onChange={setCompare}>
            <option value="">비교 안 함</option>
            {job.analyses
              .filter((a) => a.id !== current.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.kind} · {a.createdAt}
                </option>
              ))}
          </Choice>
          <details>
            <summary>이 분석에 사용한 프롬프트</summary>
            <p className="jobs-prose">{current.prompt}</p>
          </details>
          <Button variant="outline" onClick={() => setEditing(current)}>
            분석 결과 수정
          </Button>
        </>
      )}
      {editing !== null && (
        <DataDialog
          title="분석 결과 보관"
          description="수정한 결과는 새 버전으로 저장하며 이전 결과도 보존합니다."
          initial={editing.result}
          onClose={() => setEditing(null)}
          onSave={(result) =>
            jobsRepository.saveAnalysis(job.id, job.revision, editing.kind, editing.prompt, result)
          }
        >
          {(value, change) => (
            <ResumeInput
              label="분석 결과"
              required
              value={value}
              onChange={change}
              multiline
              maxLength={50000}
            />
          )}
        </DataDialog>
      )}
    </section>
  );
}

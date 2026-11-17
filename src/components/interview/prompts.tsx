import { useState } from 'react';
import type { Preparation } from '../../data/schema';
import { useAppData } from '../../hooks/app-context';
import { useJobAction } from '../../hooks/use-job-action';
import { interviewPrompt, interviewPromptKinds } from '../../data/interview';
import { questionKinds } from '../../data/interview-schema';
import { interviewRepository } from '../../data/interview-repository';
import { ResumeCheck, ResumeInput } from '../resume/inputs';
import { Choice, DataDialog } from '../jobs/shared';
import { Button } from '../ui/button';

export function InterviewPrompts({ preparation }: { preparation?: Preparation }) {
  const data = useAppData();
  const action = useJobAction();
  const [kind, setKind] = useState<string>(interviewPromptKinds[0]);
  const [include, setInclude] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState('');
  const [questionKind, setQuestionKind] = useState('');
  const [saving, setSaving] = useState<{ prompt: string; kind: string } | null>(null);
  const toggle = (key: string, yes: boolean) =>
    setInclude(yes ? [...include, key] : include.filter((i) => i !== key));
  const selected: Record<string, unknown> = {};
  const projects = [
    ...(preparation?.projects ?? []),
    ...data.projects.filter((p) => !preparation?.projects.some((old) => old.id === p.id)),
  ];
  if (include.includes('company') && preparation) {
    selected.company = preparation.company;
    selected.role = preparation.role;
  }
  if (include.includes('jd') && preparation?.job)
    selected.jd = {
      raw: preparation.job.raw,
      duties: preparation.job.duties,
      essential: preparation.job.essential,
      preferred: preparation.job.preferred,
      requirements: preparation.job.requirements.map((r) => ({ kind: r.kind, text: r.text })),
    };
  if (questionKind) selected.questionType = questionKind;
  selected.projects = projects
    .filter((p) => include.includes(p.id))
    .map((p) => ({
      name: p.name,
      role: p.role,
      skills: p.skills,
      contribution: p.contribution,
      implementation: p.implementation,
      outcome: p.outcome,
    }));
  selected.submissions =
    preparation?.submissions.filter((s) => include.includes(s.id)).map((s) => s.content) ?? [];
  selected.answers = data.questions
    .filter((q) => include.includes(q.id))
    .map((q) => ({ question: q.text, answer: q.draft }));
  selected.feedback = data.sessions.filter((s) => include.includes(s.id)).map((s) => s.content);
  const prompt = interviewPrompt(kind, selected);
  return (
    <section className="jobs-section">
      <h2>ChatGPT 면접 프롬프트 생성</h2>
      <p>전송할 자료를 선택하고 전체 내용을 확인하세요. 복사 후 ChatGPT에서 직접 사용합니다.</p>
      <Choice label="면접 프롬프트 유형" value={kind} onChange={setKind}>
        {interviewPromptKinds.map((k) => (
          <option key={k}>{k}</option>
        ))}
      </Choice>
      <Choice label="포함할 질문 유형" value={questionKind} onChange={setQuestionKind}>
        <option value="">선택 안 함</option>
        {questionKinds.map((k) => (
          <option key={k}>{k}</option>
        ))}
      </Choice>
      <div className="jobs-checks">
        {preparation && (
          <>
            <ResumeCheck
              checked={include.includes('company')}
              onChange={(yes) => toggle('company', yes)}
            >
              기업 및 직무 · {preparation.company}
            </ResumeCheck>
            <ResumeCheck checked={include.includes('jd')} onChange={(yes) => toggle('jd', yes)}>
              준비 자료의 JD
            </ResumeCheck>
          </>
        )}
        {projects.map((p) => (
          <ResumeCheck
            key={p.id}
            checked={include.includes(p.id)}
            onChange={(yes) => toggle(p.id, yes)}
          >
            프로젝트 자료 · {p.name}
          </ResumeCheck>
        ))}
        {preparation?.submissions.map((s) => (
          <ResumeCheck
            key={s.id}
            checked={include.includes(s.id)}
            onChange={(yes) => toggle(s.id, yes)}
          >
            제출본 V{s.number} · {s.content.title} · 연락처 포함 가능
          </ResumeCheck>
        ))}
      </div>
      <details>
        <summary>답변 및 피드백 선택</summary>
        {data.questions.map((q) => (
          <ResumeCheck
            key={q.id}
            checked={include.includes(q.id)}
            onChange={(yes) => toggle(q.id, yes)}
          >
            답변 · {q.text}
          </ResumeCheck>
        ))}
        {data.sessions.map((s) => (
          <ResumeCheck
            key={s.id}
            checked={include.includes(s.id)}
            onChange={(yes) => toggle(s.id, yes)}
          >
            세션 피드백 · {s.content.title}
          </ResumeCheck>
        ))}
      </details>
      <label className="field">
        면접 프롬프트 전체 미리보기
        <textarea className="input" readOnly rows={12} value={prompt} />
      </label>
      <ResumeCheck checked={reviewed === prompt} onChange={(yes) => setReviewed(yes ? prompt : '')}>
        전체 프롬프트의 개인정보·회사 내부 정보를 확인했습니다.
      </ResumeCheck>
      {action.error && (
        <p role="alert" className="alert error">
          {action.error}
        </p>
      )}
      <div className="jobs-actions">
        <Button
          disabled={reviewed !== prompt || action.busy}
          onClick={() =>
            void action.run(async () => {
              if (!navigator.clipboard)
                throw new Error('클립보드가 지원되지 않습니다. 미리보기에서 직접 복사하세요.');
              await navigator.clipboard.writeText(prompt);
            }, '프롬프트를 복사했습니다.')
          }
        >
          면접 프롬프트 복사
        </Button>
        <Button variant="outline" onClick={() => setSaving({ prompt, kind })}>
          수동 분석 결과 보관
        </Button>
      </div>
      <h3>저장한 분석</h3>
      {data.interviewAnalyses
        .filter((a) => !preparation || a.preparationId === preparation.id)
        .map((a) => (
          <details key={a.id}>
            <summary>
              {a.kind} · {new Date(a.createdAt).toLocaleString('ko-KR')}
            </summary>
            <p className="jobs-prose">{a.result}</p>
            <details>
              <summary>사용한 프롬프트</summary>
              <p className="jobs-prose">{a.prompt}</p>
            </details>
          </details>
        ))}
      {saving && (
        <DataDialog
          title="면접 분석 결과"
          initial=""
          onClose={() => setSaving(null)}
          onSave={(result) =>
            interviewRepository.saveAnalysis(
              preparation?.id ?? '',
              saving.kind,
              saving.prompt,
              result,
            )
          }
        >
          {(v, change) => (
            <ResumeInput label="면접 분석 결과" required multiline value={v} onChange={change} />
          )}
        </DataDialog>
      )}
    </section>
  );
}

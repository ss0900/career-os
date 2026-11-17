import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../hooks/app-context';
import { useAutosave } from '../hooks/use-autosave';
import { useJobAction } from '../hooks/use-job-action';
import { interviewRepository } from '../data/interview-repository';
import { type Question, type Answer, starLabels, checklistLabels } from '../data/interview-schema';
import { answerChecks, answerText } from '../data/interview';
import { SaveGuard, SaveState } from '../components/interview/shared';
import { ResumeInput, ResumeCheck } from '../components/resume/inputs';
import { Choice } from '../components/jobs/shared';
import { Button } from '../components/ui/button';

const saveAnswer = async (id: string, content: Answer, revision: number) => {
  const q = await interviewRepository.saveAnswer(id, revision, content);
  return { ...q, content: q.draft };
};
export function InterviewAnswerPage() {
  const { id } = useParams();
  const data = useAppData();
  const q = data.questions.find((q) => q.id === id);
  return q ? (
    <AnswerEditor key={q.id} question={q} />
  ) : (
    <section className="jobs-section">
      <h1>질문을 찾을 수 없습니다.</h1>
      <Link to="/interviews">면접 준비</Link>
    </section>
  );
}
function AnswerEditor({ question }: { question: Question }) {
  const data = useAppData();
  const draft = useAutosave({ ...question, content: question.draft }, saveAnswer);
  const action = useJobAction();
  const [selected, setSelected] = useState('');
  const [label, setLabel] = useState('');
  const current = data.questions.find((q) => q.id === question.id) ?? question;
  const older = current.versions.find((v) => v.id === selected);
  const uses = data.sessions.flatMap((s) =>
    s.content.items
      .filter((i) => i.questionId === question.id)
      .map((i) => ({ session: s, item: i })),
  );
  return (
    <div className="jobs-page">
      <Link className="text-link" to="/interviews">
        ← 면접 준비
      </Link>
      <h1>{question.text}</h1>
      <p>
        {question.company || '일반 질문'} · {question.kind} · {question.source}
      </p>
      {question.requirementText && (
        <p className="inline-note">연결 JD: {question.requirementText}</p>
      )}
      <SaveState {...draft} />
      <fieldset className="phase4-edit-fields" disabled={action.busy}>
        <section className="jobs-section">
          <h2>STAR와 핵심 답변</h2>
          {Object.entries(starLabels).map(([key, label]) => (
            <ResumeInput
              key={key}
              label={label}
              multiline
              maxLength={30000}
              value={draft.content[key as keyof typeof starLabels]}
              onChange={(value) => draft.change({ ...draft.content, [key]: value })}
            />
          ))}
        </section>
        <section className="jobs-section">
          <h2>답변 품질 점검</h2>
          <p className="field-hint">
            규칙 기반 알림과 사용자 체크리스트입니다. 실제 면접 점수나 합격 확률을 계산하지
            않습니다.
          </p>
          {answerChecks(draft.content).map((c) => (
            <p key={c} className="inline-note">
              {c}
            </p>
          ))}
          {checklistLabels.map((text, i) => (
            <ResumeCheck
              key={text}
              checked={draft.content.checks[i]}
              onChange={(yes) =>
                draft.change({
                  ...draft.content,
                  checks: draft.content.checks.map((v, n) => (n === i ? yes : v)),
                })
              }
            >
              {text}
            </ResumeCheck>
          ))}
        </section>
        <section className="jobs-section">
          <h2>답변 버전</h2>
          {action.error && (
            <p className="alert error" role="alert">
              {action.error}
            </p>
          )}
          <ResumeInput label="답변 버전 메모" value={label} onChange={setLabel} maxLength={300} />
          <Button
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const saved = await draft.flush();
                const versioned = await interviewRepository.version(
                  question.id,
                  saved.revision,
                  label,
                );
                draft.accept({ ...versioned, content: versioned.draft });
              }, '답변 버전을 보관했습니다.')
            }
          >
            답변 버전 생성
          </Button>
          <p>
            최신 지정:{' '}
            {current.versions.find((v) => v.id === current.activeVersionId)?.number
              ? `V${current.versions.find((v) => v.id === current.activeVersionId)!.number}`
              : '없음'}
          </p>
          <Choice label="비교할 답변 버전" value={selected} onChange={setSelected}>
            <option value="">선택</option>
            {current.versions.map((v) => (
              <option key={v.id} value={v.id}>
                V{v.number} · {v.label || '메모 없음'} ·{' '}
                {new Date(v.createdAt).toLocaleString('ko-KR')}
              </option>
            ))}
          </Choice>
          {older && (
            <>
              <div className="jobs-comparison">
                <div tabIndex={0} role="region" aria-label="현재 답변">
                  <h3>현재 초안</h3>
                  <p className="jobs-prose">{answerText(draft.content)}</p>
                </div>
                <div tabIndex={0} role="region" aria-label="이전 답변">
                  <h3>
                    V{older.number} ·{' '}
                    {JSON.stringify(older.content) === JSON.stringify(draft.content)
                      ? '내용 동일'
                      : '내용 차이 있음'}
                  </h3>
                  <p className="jobs-prose">{answerText(older.content)}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    window.confirm('현재 답변을 선택한 버전으로 교체하고 최신 답변으로 지정할까요?')
                  )
                    void action.run(async () => {
                      const saved = await draft.flush();
                      const q = await interviewRepository.useVersion(
                        question.id,
                        saved.revision,
                        older.id,
                      );
                      draft.accept({ ...q, content: q.draft });
                    });
                }}
              >
                이 버전을 최신 답변으로 지정
              </Button>
            </>
          )}
        </section>
        <section className="jobs-section">
          <h2>면접에서 사용한 답변 · 개선 기록</h2>
          {!uses.length && <p>아직 이 질문을 연습한 세션이 없습니다.</p>}
          {uses.map(({ session, item }) => (
            <details key={item.id}>
              <summary>
                {session.content.mode} · {session.content.title} · {session.createdAt.slice(0, 10)}
              </summary>
              <p className="jobs-prose">{item.answer || '미답변'}</p>
              <p className="jobs-prose">개선사항: {item.feedback.improvements || '미등록'}</p>
              <Link to={`/interviews/sessions/${session.id}`}>세션 확인</Link>
            </details>
          ))}
        </section>
      </fieldset>
      <SaveGuard blocker={draft.blocker} flush={draft.flush} />
    </div>
  );
}

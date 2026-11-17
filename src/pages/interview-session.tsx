import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../hooks/app-context';
import { useAutosave } from '../hooks/use-autosave';
import { useJobAction } from '../hooks/use-job-action';
import { interviewRepository } from '../data/interview-repository';
import { followUpQuestions, answerText } from '../data/interview';
import { feedbackLabels, type InterviewSession } from '../data/interview-schema';
import { SaveGuard, SaveState } from '../components/interview/shared';
import { ResumeCheck, ResumeInput } from '../components/resume/inputs';
import { Choice } from '../components/jobs/shared';
import { Button } from '../components/ui/button';

export function InterviewSessionPage() {
  const { id } = useParams();
  const { sessions } = useAppData();
  const session = sessions.find((s) => s.id === id);
  return session ? (
    <SessionEditor key={session.id} session={session} />
  ) : (
    <section className="jobs-section">
      <h1>면접 기록을 찾을 수 없습니다.</h1>
      <Link to="/interviews">면접 준비</Link>
    </section>
  );
}
function SessionEditor({ session }: { session: InterviewSession }) {
  const data = useAppData();
  const navigate = useNavigate();
  const draft = useAutosave(session, interviewRepository.saveSession);
  const change = draft.change;
  const action = useJobAction();
  const [running, setRunning] = useState(false);
  const [follow, setFollow] = useState('');
  const [compare, setCompare] = useState('');
  const content = draft.content;
  const item = content.items[content.index];
  const source = data.questions.find((q) => q.id === item.questionId);
  const older = data.sessions.find((s) => s.id === compare);
  const changeItem = (next: typeof item) =>
    draft.change({ ...content, items: content.items.map((i) => (i.id === item.id ? next : i)) });
  useEffect(() => {
    if (!running || content.mode !== '모의 면접' || content.status === '완료') return;
    let previous = performance.now();
    const tick = () => {
      const now = performance.now();
      const elapsed = Math.min(2, Math.max(0, (now - previous) / 1000));
      previous = now;
      if (document.visibilityState === 'visible')
        change((c) => ({
          ...c,
          items: c.items.map((i, n) =>
            n === c.index ? { ...i, elapsed: i.elapsed + elapsed } : i,
          ),
        }));
    };
    const reset = () => {
      previous = performance.now();
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', reset);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [running, content.mode, content.status, change]);
  const transition = (status: typeof content.status) => {
    setRunning(status === '진행 중');
    draft.change({ ...content, status });
  };
  return (
    <div className="jobs-page">
      <Link className="text-link" to="/interviews">
        ← 면접 기록
      </Link>
      <h1>{content.title}</h1>
      <p>
        {content.mode} · {content.company || '일반'} · {content.role} · {content.type}
      </p>
      <SaveState {...draft} />
      <div className="jobs-actions">
        <Button onClick={() => transition('진행 중')}>
          {running ? '연습 진행 중' : '시작 / 이어하기'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            transition('중단');
            void action.run(draft.flush, '세션을 보관했습니다.');
          }}
        >
          중단 및 저장
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (
              window.confirm(
                `답변 완료 ${content.items.filter((i) => i.completed).length}/${content.items.length}개입니다. 세션을 종료할까요?`,
              )
            ) {
              transition('완료');
              void action.run(draft.flush, '면접 결과를 보관했습니다.');
            }
          }}
        >
          세션 종료
        </Button>
      </div>
      <p className="field-hint">
        시간은 화면이 보이는 동안만 측정합니다. 새로고침 후에는 이어하기를 눌러야 다시 측정하며,
        마지막 약 2초는 저장되지 않을 수 있습니다. 실제 면접 회고는 시간을 자동 측정하지 않습니다.
      </p>
      {action.error && (
        <p role="alert" className="alert error">
          {action.error}
        </p>
      )}
      <section className="jobs-section">
        <div className="jobs-actions">
          <span className="badge">
            질문 {content.index + 1}/{content.items.length}
          </span>
          <span aria-label="답변 경과 시간">{Math.floor(item.elapsed)}초</span>
          <span>{item.completed ? '답변 완료' : '미완료'}</span>
        </div>
        <h2>{item.text}</h2>
        <ResumeInput
          label="면접 답변"
          multiline
          maxLength={30000}
          value={item.answer}
          onChange={(answer) => changeItem({ ...item, answer })}
        />
        {source?.activeVersionId && (
          <Button
            variant="outline"
            onClick={() => {
              if (!item.answer || window.confirm('현재 입력을 최신 지정 답변으로 교체할까요?')) {
                const version = source.versions.find((v) => v.id === source.activeVersionId)!;
                changeItem({
                  ...item,
                  answer: answerText(version.content),
                  usedVersionId: version.id,
                });
              }
            }}
          >
            최신 지정 답변 불러오기
          </Button>
        )}
        <ResumeCheck
          checked={item.completed}
          onChange={(completed) => changeItem({ ...item, completed })}
        >
          이 질문 답변 완료
        </ResumeCheck>
        <h3>추가 검증 질문</h3>
        <p className="field-hint">
          미리 정의한 질문과 답변 키워드로 제안합니다. 답변의 의미를 AI가 평가한 결과가 아닙니다.
        </p>
        <Choice label="꼬리질문 선택" value={follow} onChange={setFollow}>
          <option value="">선택</option>
          {followUpQuestions(item.answer).map((f) => (
            <option key={f}>{f}</option>
          ))}
        </Choice>
        <ResumeInput label="직접 추가할 꼬리질문" value={follow} onChange={setFollow} />
        <Button
          variant="outline"
          disabled={!follow.trim() || item.followUps.length >= 30}
          onClick={() => {
            changeItem({
              ...item,
              followUps: [...item.followUps, { id: crypto.randomUUID(), text: follow, answer: '' }],
            });
            setFollow('');
          }}
        >
          꼬리질문 추가
        </Button>
        {item.followUps.map((f) => (
          <div key={f.id} className="evidence-card">
            <h4>{f.text}</h4>
            <ResumeInput
              label={`꼬리질문 답변 ${item.followUps.indexOf(f) + 1}`}
              multiline
              value={f.answer}
              onChange={(answer) =>
                changeItem({
                  ...item,
                  followUps: item.followUps.map((v) => (v.id === f.id ? { ...v, answer } : v)),
                })
              }
            />
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm('꼬리질문과 답변을 삭제할까요?'))
                  changeItem({ ...item, followUps: item.followUps.filter((v) => v.id !== f.id) });
              }}
            >
              꼬리질문 삭제
            </Button>
          </div>
        ))}
        <div className="jobs-actions">
          <Button
            variant="outline"
            disabled={content.index === 0}
            onClick={() => draft.change({ ...content, index: content.index - 1 })}
          >
            이전 질문
          </Button>
          <Button
            disabled={content.index === content.items.length - 1}
            onClick={() => draft.change({ ...content, index: content.index + 1 })}
          >
            다음 질문
          </Button>
        </div>
      </section>
      <section className="jobs-section">
        <h2>답변별 자체 평가</h2>
        <p>
          1점은 보완 필요, 5점은 스스로 충분하다고 판단한 상태입니다. 실제 면접 점수와 구분하세요.
        </p>
        <div className="form-grid">
          {feedbackLabels.map((label, i) => (
            <Choice
              key={label}
              label={label}
              value={String(item.feedback.ratings[i] ?? '')}
              onChange={(n) =>
                changeItem({
                  ...item,
                  feedback: {
                    ...item.feedback,
                    ratings: item.feedback.ratings.map((v, j) =>
                      j === i ? (n ? Number(n) : null) : v,
                    ),
                  },
                })
              }
            >
              <option value="">미평가</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Choice>
          ))}
        </div>
        {[
          ['strengths', '잘한 부분'],
          ['weaknesses', '부족한 부분'],
          ['improvements', '다음 개선사항'],
        ].map(([key, label]) => (
          <ResumeInput
            key={key}
            label={label}
            multiline
            value={item.feedback[key as 'strengths' | 'weaknesses' | 'improvements']}
            onChange={(v) => changeItem({ ...item, feedback: { ...item.feedback, [key]: v } })}
          />
        ))}
        <ResumeCheck
          checked={item.feedback.review}
          onChange={(review) => changeItem({ ...item, feedback: { ...item.feedback, review } })}
        >
          이 질문 복습 필요
        </ResumeCheck>
      </section>
      <section className="jobs-section">
        <h2>세션 결과와 회고</h2>
        <p>
          {content.mode} · {content.status} · 답변 완료{' '}
          {content.items.filter((i) => i.completed).length}/{content.items.length}
        </p>
        <ResumeInput
          label="면접 후 회고"
          multiline
          value={content.reflection}
          onChange={(reflection) => draft.change({ ...content, reflection })}
        />
        <Choice label="이전 세션과 비교" value={compare} onChange={setCompare}>
          <option value="">비교 안 함</option>
          {data.sessions
            .filter((s) => s.id !== session.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.content.mode} · {s.content.title} · {s.createdAt.slice(0, 10)}
              </option>
            ))}
        </Choice>
        {content.items.map((i, n) => (
          <details key={i.id}>
            <summary>
              {n + 1}. {i.text} · {i.completed ? '완료' : '미완료'}
            </summary>
            <div className="jobs-comparison">
              <div tabIndex={0} role="region" aria-label={`현재 세션 답변 ${n + 1}`}>
                <h3>이번 답변</h3>
                <p className="jobs-prose">{i.answer || '미답변'}</p>
                <p className="jobs-prose">{i.feedback.improvements}</p>
              </div>
              {older && (
                <div tabIndex={0} role="region" aria-label={`이전 세션 답변 ${n + 1}`}>
                  <h3>이전 세션</h3>
                  <p className="jobs-prose">
                    {older.content.items.find((v) => v.questionId === i.questionId)?.answer ||
                      '같은 질문의 답변 없음'}
                  </p>
                  <p className="jobs-prose">
                    {
                      older.content.items.find((v) => v.questionId === i.questionId)?.feedback
                        .improvements
                    }
                  </p>
                </div>
              )}
            </div>
          </details>
        ))}
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm('세션의 답변·피드백·회고를 삭제할까요?')) {
              setRunning(false);
              void action.run(async () => {
                await draft.flush();
                await interviewRepository.deleteSession(session.id);
                navigate('/interviews');
              });
            }
          }}
        >
          면접 세션 삭제
        </Button>
      </section>
      <SaveGuard blocker={draft.blocker} flush={draft.flush} />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useAppData } from '../../hooks/app-context';
import { answerText } from '../../data/interview';

export function PracticeDashboard() {
  const { questions, sessions, portfolios } = useAppData();
  return (
    <section className="jobs-section">
      <div className="section-heading">
        <h2>면접과 포트폴리오</h2>
        <Link className="text-link" to="/interviews">
          면접 준비 →
        </Link>
      </div>
      <div className="jobs-metrics">
        <div>
          <span>미답변 질문</span>
          <strong>{questions.filter((q) => !answerText(q.draft).trim()).length}</strong>
        </div>
        <div>
          <span>복습 필요</span>
          <strong>{questions.filter((q) => q.review).length}</strong>
        </div>
        <div>
          <span>이어할 모의 면접</span>
          <strong>
            {
              sessions.filter((s) => s.content.mode === '모의 면접' && s.content.status !== '완료')
                .length
            }
          </strong>
        </div>
        <div>
          <span>포트폴리오 초안</span>
          <strong>{portfolios.length}</strong>
        </div>
      </div>
      <Link className="text-link" to="/portfolios">
        포트폴리오 작성 →
      </Link>
    </section>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppData } from '../hooks/app-context';
import { PageHeading } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/dialog';
import { Choice, DataDialog } from '../components/jobs/shared';
import { portfolioRepository } from '../data/portfolio-repository';
import type { Portfolio } from '../data/portfolio-schema';

export function PortfoliosPage() {
  const { portfolios, resumes } = useAppData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);
  return (
    <div className="jobs-page">
      <PageHeading
        eyebrow="SELECTED WORK"
        title="포트폴리오"
        description="경험을 공개용 문구로 다듬고, 승인한 내용만 내보내세요."
        action={<Button onClick={() => setCreating(true)}>포트폴리오 만들기</Button>}
      />
      <p className="inline-note">
        초안은 이 브라우저에 저장됩니다. 정적 파일을 내보낸 뒤 직접 GitHub에 반영해야 다른 사람이 볼
        수 있습니다.
      </p>
      {!portfolios.length && (
        <p className="jobs-empty">
          첫 포트폴리오를 만들어 보세요. 프로젝트·경력·연락처 공개는 기본적으로 꺼져 있습니다.
        </p>
      )}
      {portfolios.map((p) => (
        <article key={p.id} className="jobs-section">
          <h2>
            <Link to={`/portfolios/${p.id}`}>{p.content.title || '제목 없는 포트폴리오'}</Link>
          </h2>
          <p>
            {p.content.status} · 프로젝트 {p.content.projects.length}개 · 내보내기 승인 이력{' '}
            {p.publications.length}개
          </p>
          <div className="jobs-actions">
            <Link className="text-link" to={`/portfolios/${p.id}`}>
              편집 / 공개 검토 →
            </Link>
            <Button variant="ghost" onClick={() => setDeleting(p)}>
              포트폴리오 삭제
            </Button>
          </div>
        </article>
      ))}
      {creating && (
        <DataDialog
          title="포트폴리오 초안 만들기"
          description="원본을 복사합니다. 이후 편집은 원본에 반영되지 않으며 공개 선택은 모두 해제됩니다."
          initial=""
          onClose={() => setCreating(false)}
          onSave={async (id) => {
            const p = await portfolioRepository.create(id);
            navigate(`/portfolios/${p.id}`);
          }}
        >
          {(value, change) => (
            <Choice label="가져올 원본" value={value} onChange={change}>
              <option value="">현재 프로필·경력·프로젝트</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  이력서 · {r.content.title}
                </option>
              ))}
            </Choice>
          )}
        </DataDialog>
      )}
      {deleting && (
        <ConfirmDialog
          title="포트폴리오를 삭제할까요?"
          description="초안·이미지·내보내기 이력이 삭제됩니다. 이미 GitHub에 게시한 파일은 사용자가 직접 삭제해야 합니다."
          onClose={() => setDeleting(null)}
          onConfirm={() => portfolioRepository.delete(deleting.id)}
        />
      )}
    </div>
  );
}

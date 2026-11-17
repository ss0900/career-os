import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Database,
  FileJson,
  HardDrive,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { PageHeading } from '../components/common';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/dialog';
import { downloadBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup } from '../data/backup';
import type { Backup } from '../data/schema';
import { useAppData, useNotice } from '../hooks/app-context';
import { dateLabel, errorMessage } from '../lib/utils';

export function SettingsPage() {
  const {
    profile,
    careers,
    projects,
    settings,
    resumes,
    resumeVersions,
    jobs,
    applications,
    events,
    questions,
    sessions,
    portfolios,
  } = useAppData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Backup | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const notice = useNotice();
  async function exportData() {
    setBusy(true);
    setError('');
    try {
      await downloadBackup();
      notice('백업 다운로드를 요청했습니다. 다운로드 폴더를 확인해 주세요.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('백업 파일은 20MB 이하여야 합니다.');
      setPending(parseBackup(await file.text()));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="SETTINGS"
        title="설정 및 백업"
        description="나의 기록을 직접 관리하고, 안전하게 보관하세요."
      />
      <div className="settings-grid">
        <div>
          <section className="panel">
            <div className="section-heading">
              <h2>
                <Database size={19} />
                데이터 보관함
              </h2>
              <span className="badge green">이 브라우저</span>
            </div>
            <div className="storage-counts">
              <div>
                <strong>{profile ? 1 : 0}</strong>
                <span>프로필</span>
              </div>
              <div>
                <strong>{careers.length}</strong>
                <span>경력</span>
              </div>
              <div>
                <strong>{projects.length}</strong>
                <span>프로젝트</span>
              </div>
              <div>
                <strong>{resumes.length}</strong>
                <span>이력서</span>
              </div>
              <div>
                <strong>{resumeVersions.length}</strong>
                <span>보관 버전</span>
              </div>
            </div>
            <p className="storage-note">
              <HardDrive size={16} />
              IndexedDB · 로컬 저장소 · 스키마 v4 · 채용공고 {jobs.length}개 · 지원{' '}
              {applications.length}개 · 일정 {events.length}개 · 면접 질문 {questions.length}개 ·
              세션 {sessions.length}개 · 포트폴리오 {portfolios.length}개
            </p>
          </section>
          <section className="panel backup-settings">
            <div className="section-heading">
              <div>
                <h2>백업 및 복원</h2>
                <p>기기를 바꾸기 전, 최신 백업을 만들어 두세요.</p>
              </div>
              <FileJson size={21} />
            </div>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <div className="backup-action">
              <span className="action-icon">
                <ArrowDownToLine size={22} />
              </span>
              <div>
                <h3>JSON 파일로 내보내기</h3>
                <p>경력·이력서·공고·분석·지원 이력·일정·제출 증빙을 함께 보관합니다.</p>
                <small>최근 다운로드 요청 · {dateLabel(settings?.lastBackupAt ?? undefined)}</small>
              </div>
              <Button variant="outline" onClick={() => void exportData()} disabled={busy}>
                JSON 백업
              </Button>
            </div>
            <div className="backup-action">
              <span className="action-icon">
                <ArrowUpFromLine size={22} />
              </span>
              <div>
                <h3>백업 파일 가져오기</h3>
                <p>복원 시 현재 데이터를 백업 내용으로 교체합니다.</p>
                <small>
                  Career OS v1 / v2 / v3 / v4 JSON · 최대 20MB. 이미지 파일은 제외됩니다.
                </small>
              </div>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                파일 선택
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                aria-label="백업 파일"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => void selectFile(event)}
              />
            </div>
            {busy && (
              <p role="status" className="muted">
                백업 파일을 처리하고 있습니다…
              </p>
            )}
            <p className="inline-note">
              백업 파일에는 개인정보가 포함됩니다. 개인 저장 공간에 보관하고, 공개 저장소에 올리지
              마세요. 다운로드가 완료되었는지도 확인해 주세요.
            </p>
          </section>
          <section className="panel roadmap-panel">
            <div className="section-heading">
              <h2>Career OS 개발 로드맵</h2>
              <span className="badge">v0.3</span>
            </div>
            <div className="roadmap-row">
              <span className="roadmap-step complete">
                <Check size={16} />
              </span>
              <div>
                <h3>Phase 1 · 커리어의 기반</h3>
                <p>프로필, 경력, 프로젝트 관리와 백업 · 현재 제공</p>
              </div>
            </div>
            <div className="roadmap-row">
              <span className="roadmap-step complete">
                <Check size={16} />
              </span>
              <div>
                <h3>Phase 2 · 이력서 시스템</h3>
                <p>맞춤 초안, A4/PDF, 불변 제출본, 버전 비교 · 현재 제공</p>
              </div>
            </div>
            <div className="roadmap-row">
              <span className="roadmap-step complete">
                <Check size={16} />
              </span>
              <div>
                <h3>Phase 3 · 채용공고와 이직 관리</h3>
                <p>JD 분석, 경험 근거, 지원 보드, 제출 증빙, 일정 · 현재 제공</p>
              </div>
            </div>
            {[
              [
                '04',
                '면접과 포트폴리오',
                '질문 은행, STAR 버전, 모의 면접, 공개 승인 및 정적 내보내기 · 현재 제공',
              ],
            ].map(([step, title, description]) => (
              <div className="roadmap-row" key={step}>
                <span className="roadmap-step complete">{step}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </section>
        </div>
        <aside className="settings-aside">
          <section className="privacy-card">
            <ShieldCheck size={28} />
            <h2>내 기록은 내가 소유해요</h2>
            <p>Career OS는 별도의 계정이나 서버 데이터베이스 없이 작동합니다.</p>
            <ul>
              <li>입력한 내용은 현재 브라우저에 저장됩니다.</li>
              <li>다른 브라우저나 기기와 자동 동기화되지 않습니다.</li>
              <li>
                브라우저 데이터 삭제, 시크릿 창 종료, 저장 공간 정리로 기록이 사라질 수 있습니다.
              </li>
              <li>같은 기기와 브라우저를 사용하는 사람은 기록에 접근할 수 있습니다.</li>
            </ul>
            <div className="privacy-footer">
              <LockKeyhole size={16} />
              개인 데이터는 자동으로 공개되지 않아요.
            </div>
          </section>
          <p className="muted settings-help">
            로컬 실행 주소와 GitHub Pages 주소의 저장 공간은 서로 다릅니다. JSON 백업과 복원으로
            옮겨 주세요.
          </p>
        </aside>
      </div>
      {pending && (
        <ConfirmDialog
          title="백업으로 데이터를 교체할까요?"
          confirmLabel="백업으로 교체"
          description={`${dateLabel(pending.exportedAt)} v${pending.schemaVersion} 백업: 프로필 ${pending.data.profiles.length}개, 경력 ${pending.data.careers.length}개, 프로젝트 ${pending.data.projects.length}개, 이력서 ${pending.schemaVersion !== 1 ? pending.data.resumes.length : 0}개, 보관 버전 ${pending.schemaVersion !== 1 ? pending.data.resumeVersions.length : 0}개, 공고 ${'jobs' in pending.data ? pending.data.jobs.length : 0}개, 지원 ${'applications' in pending.data ? pending.data.applications.length : 0}개, 일정 ${'events' in pending.data ? pending.data.events.length : 0}개, 질문 ${pending.schemaVersion === 4 ? pending.data.questions.length : 0}개, 세션 ${pending.schemaVersion === 4 ? pending.data.sessions.length : 0}개, 포트폴리오 ${pending.schemaVersion === 4 ? pending.data.portfolios.length : 0}개. 현재 프로필 ${profile ? 1 : 0}개, 경력 ${careers.length}개, 프로젝트 ${projects.length}개, 이력서 ${resumes.length}개와 보관 버전 ${resumeVersions.length}개, 공고 ${jobs.length}개·지원 ${applications.length}개·일정 ${events.length}개·질문 ${questions.length}개·세션 ${sessions.length}개·포트폴리오 ${portfolios.length}개가 모두 교체됩니다.${pending.schemaVersion === 1 ? ' 특히 v1 백업에는 이력서가 없으므로 현재 초안과 제출본이 모두 삭제됩니다.' : ''}${pending.schemaVersion < 3 ? ' v1·v2 백업에는 Phase 3 데이터가 없으므로 현재 공고·분석·지원 이력·일정·지원별 제출 증빙이 모두 삭제됩니다.' : ''}${pending.schemaVersion !== 4 ? ' v1~v3에는 면접·포트폴리오 데이터가 없으므로 질문·답변 버전·세션·피드백·포트폴리오·공개 이력이 모두 삭제됩니다.' : ''} 모든 버전의 JSON에는 이미지 파일이 없습니다. 현재 이미지 파일도 제거되므로 먼저 포트폴리오의 이미지 별도 백업을 받고 복원 후 다시 연결하세요. 현재 데이터를 먼저 백업했는지 확인해 주세요.`}
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await restoreBackup(pending);
            notice('백업을 복원했습니다.');
          }}
        />
      )}
    </>
  );
}

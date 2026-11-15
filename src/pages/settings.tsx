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
  const { profile, careers, projects, settings } = useAppData();
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
      if (file.size > MAX_BACKUP_BYTES) throw new Error('백업 파일은 5MB 이하여야 합니다.');
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
            </div>
            <p className="storage-note">
              <HardDrive size={16} />
              IndexedDB · 로컬 저장소 · 스키마 v1
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
                <p>프로필, 경력, 프로젝트를 하나의 파일에 담습니다.</p>
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
                <small>Career OS v1 JSON · 최대 5MB</small>
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
              <span className="badge">v0.1</span>
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
            {[
              ['02', '이력서 시스템', '프로젝트 선택, A4 미리보기, PDF, 제출 버전'],
              ['03', '이직 관리', '채용공고 분석, 지원 보드, 일정 관리'],
              ['04', '면접과 포트폴리오', 'STAR 답변, 프롬프트 생성, 공개 포트폴리오'],
            ].map(([step, title, description]) => (
              <div className="roadmap-row" key={step}>
                <span className="roadmap-step">{step}</span>
                <div>
                  <h3>
                    {title}
                    <span className="planned">예정</span>
                  </h3>
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
          description={`${dateLabel(pending.exportedAt)} 백업: 프로필 ${pending.data.profiles.length}개, 경력 ${pending.data.careers.length}개, 프로젝트 ${pending.data.projects.length}개. 현재 프로필 ${profile ? 1 : 0}개, 경력 ${careers.length}개, 프로젝트 ${projects.length}개가 모두 교체됩니다. 현재 데이터를 먼저 백업했는지 확인해 주세요.`}
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

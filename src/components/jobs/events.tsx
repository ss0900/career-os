import { useJobAction } from '../../hooks/use-job-action';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../../hooks/app-context';
import { eventKinds, type ApplicationEvent, type EventInput } from '../../data/jobs-schema';
import { jobsRepository } from '../../data/jobs-repository';
import { localDay } from '../../data/jobs';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/dialog';
import { ResumeCheck, ResumeInput } from '../resume/inputs';
import { Choice, DataDialog } from './shared';

export function Events({ applicationId }: { applicationId?: string }) {
  const { events, applications } = useAppData();
  const action = useJobAction();
  const [editing, setEditing] = useState<ApplicationEvent | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ApplicationEvent | null>(null);
  const [showDone, setShowDone] = useState(false);
  const rows = events
    .filter((e) => (!applicationId || e.applicationId === applicationId) && (showDone || !e.done))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const initial: EventInput =
    editing && editing !== 'new'
      ? {
          applicationId: editing.applicationId,
          title: editing.title,
          kind: editing.kind,
          date: editing.date,
          time: editing.time,
          memo: editing.memo,
          done: editing.done,
        }
      : {
          applicationId: applicationId ?? '',
          title: '',
          kind: '기타',
          date: '',
          time: '',
          memo: '',
          done: false,
        };
  return (
    <section className="jobs-section">
      <div className="section-heading">
        <h2>일정 및 후속 조치</h2>
        <Button onClick={() => setEditing('new')} disabled={!applications.length}>
          일정 추가
        </Button>
      </div>
      {action.error && (
        <p role="alert" className="alert error">
          {action.error}
        </p>
      )}
      <ResumeCheck checked={showDone} onChange={setShowDone}>
        완료한 일정 포함
      </ResumeCheck>
      {!rows.length && <p className="jobs-empty">등록된 미완료 일정이 없습니다.</p>}
      {rows.map((e) => (
        <article className="event-row" key={e.id}>
          <div>
            <strong>
              {e.date} {e.time || '시간 미정'} · {e.title}
            </strong>
            <p>
              <Link to={`/applications/${e.applicationId}`}>
                {applications.find((a) => a.id === e.applicationId)?.job.company}
              </Link>{' '}
              · {e.kind} ·{' '}
              {e.done
                ? '완료'
                : e.date < localDay() ||
                    (e.date === localDay() &&
                      e.time &&
                      e.time < new Date().toTimeString().slice(0, 5))
                  ? '지연된 할 일'
                  : '예정'}
            </p>
            <p className="jobs-prose">{e.memo}</p>
          </div>
          <div className="jobs-actions">
            <Button
              size="sm"
              variant="outline"
              disabled={action.busy}
              onClick={() =>
                void action.run(() =>
                  jobsRepository.saveEvent(
                    {
                      applicationId: e.applicationId,
                      title: e.title,
                      kind: e.kind,
                      date: e.date,
                      time: e.time,
                      memo: e.memo,
                      done: !e.done,
                    },
                    e.id,
                    e.updatedAt,
                  ),
                )
              }
            >
              {e.done ? '완료 취소' : '완료 처리'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
              일정 수정
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleting(e)}>
              일정 삭제
            </Button>
          </div>
        </article>
      ))}
      {editing && (
        <DataDialog
          title={editing === 'new' ? '일정 추가' : '일정 수정'}
          initial={initial}
          onClose={() => setEditing(null)}
          onSave={(value) =>
            jobsRepository.saveEvent(
              value,
              editing === 'new' ? undefined : editing.id,
              editing === 'new' ? undefined : editing.updatedAt,
            )
          }
        >
          {(value, change) => (
            <>
              <Choice
                label="관련 지원 기록"
                required
                value={value.applicationId}
                onChange={(applicationId) => change({ ...value, applicationId })}
              >
                <option value="">기업 / 지원 선택</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.job.company} · {a.job.role} · {a.createdAt.slice(0, 10)} · {a.id.slice(0, 6)}
                  </option>
                ))}
              </Choice>
              <ResumeInput
                label="일정 제목"
                required
                maxLength={300}
                value={value.title}
                onChange={(title) => change({ ...value, title })}
              />
              <Choice
                label="일정 종류"
                required
                value={value.kind}
                onChange={(kind) => change({ ...value, kind: kind as typeof value.kind })}
              >
                {eventKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Choice>
              <div className="form-grid">
                <ResumeInput
                  label="일정 날짜"
                  required
                  type="date"
                  value={value.date}
                  onChange={(date) => change({ ...value, date })}
                />
                <ResumeInput
                  label="일정 시간"
                  type="time"
                  value={value.time}
                  onChange={(time) => change({ ...value, time })}
                />
              </div>
              <ResumeInput
                label="일정 메모"
                multiline
                value={value.memo}
                onChange={(memo) => change({ ...value, memo })}
              />
              <ResumeCheck checked={value.done} onChange={(done) => change({ ...value, done })}>
                완료한 일정
              </ResumeCheck>
            </>
          )}
        </DataDialog>
      )}
      {deleting && (
        <ConfirmDialog
          title="일정을 삭제할까요?"
          description={deleting.title}
          onClose={() => setDeleting(null)}
          onConfirm={() => jobsRepository.deleteEvent(deleting.id)}
        />
      )}
    </section>
  );
}

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { emptyCareer, emptyProfile, emptyProject } from '../src/data/schema';
import { createDocument } from '../src/data/resume';
import { emptyJob } from '../src/data/jobs-schema';

test.setTimeout(120000);

test('job to evidence to submitted resume, stage history, schedule and protected document', async ({
  page,
}, info) => {
  const now = '2026-11-16T00:00:00.000Z';
  await page.goto('#/settings');
  await page.getByLabel('백업 파일').setInputFiles({
    name: 'test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        app: 'career-os',
        schemaVersion: 1,
        exportedAt: now,
        data: {
          profiles: [
            {
              ...emptyProfile,
              id: 'profile',
              createdAt: now,
              updatedAt: now,
              name: '가상 지원자',
              email: 'test@example.invalid',
              targetRole: '프론트엔드',
              skills: ['React'],
            },
          ],
          careers: [],
          projects: [
            {
              ...emptyProject,
              id: crypto.randomUUID(),
              createdAt: now,
              updatedAt: now,
              name: '가상 화면 개발',
              role: '개발',
              startDate: '2024-01',
              current: true,
              skills: ['React'],
              contribution: '직접 구현한 화면',
              outcome: '가상의 테스트 기록',
            },
          ],
        },
      }),
    ),
  });
  await page.getByRole('button', { name: '백업으로 교체' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('#/jobs');
  await page.getByRole('button', { name: '채용공고 등록', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '기업명', exact: true }).fill('가상 채용 기업');
  await dialog.getByRole('textbox', { name: '채용공고 제목', exact: true }).fill('프론트엔드 모집');
  await dialog.getByRole('textbox', { name: '지원 직무', exact: true }).fill('프론트엔드');
  await dialog
    .getByRole('textbox', { name: 'JD 원문 전체' })
    .fill('자격요건\nReact.js 사용 경험\n우대사항\nTypeScript 경험');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('link', { name: '프론트엔드 모집', exact: true }).click();
  const jobUrl = page.url();
  await page.getByRole('button', { name: 'JD 규칙 분석' }).click();
  const req = page
    .locator('.requirement-card')
    .filter({ has: page.getByRole('heading', { name: 'React.js 사용 경험', exact: true }) });
  await expect(req).toContainText('확인 필요');
  await req.getByRole('button', { name: '요구사항 수정' }).click();
  await page
    .getByRole('textbox', { name: '검토 메모', exact: true })
    .fill('개인 기여 범위를 검토했습니다.');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(req).toContainText('개인 기여 범위를 검토했습니다.');
  await req.getByRole('button', { name: '프로젝트 근거 연결' }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('근거 프로젝트', { exact: true })
    .selectOption({ label: '가상 화면 개발' });
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(req).toContainText('확인됨');
  await page.getByRole('button', { name: '공고 수정' }).click();
  await page.getByRole('textbox', { name: '근무지역', exact: true }).fill('서울');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('.job-facts')).toContainText('서울');
  const prompt = page.getByRole('textbox', { name: '전체 프롬프트 미리보기' });
  await expect(prompt).not.toHaveValue(/직접 구현한 화면/);
  await page.getByRole('checkbox', { name: '프로젝트 · 가상 화면 개발' }).check();
  await expect(prompt).toHaveValue(/직접 구현한 화면/);
  await expect(page.getByRole('button', { name: '프롬프트 복사' })).toBeDisabled();
  await page
    .getByRole('checkbox', {
      name: '전체 내용을 읽고 개인정보·회사 내부 정보의 포함 여부를 확인했습니다.',
    })
    .check();
  await expect(page.getByRole('button', { name: '프롬프트 복사' })).toBeEnabled();
  await page.getByRole('button', { name: '분석 결과 입력' }).click();
  await page.getByRole('textbox', { name: '분석 결과', exact: true }).fill('가상의 수동 검토 결과');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('.jobs-comparison')).toContainText('가상의 수동 검토 결과');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: '지원 기록 생성' }).click();
  await expect(page).toHaveURL(/#\/applications\//);
  const appUrl = page.url();
  await page.goto('#/resumes');
  await page.getByRole('button', { name: '새 이력서 만들기', exact: true }).first().click();
  await page.getByRole('textbox', { name: '지원 기업명', exact: true }).fill('가상 채용 기업');
  await expect(page.getByText('저장 완료', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '제출본 확정', exact: true }).click();
  await page.getByRole('button', { name: '제출본으로 보관' }).click();
  await expect(page.getByText('V1 · 읽기 전용', { exact: true })).toBeVisible();
  await page.goto(appUrl);
  await page.getByRole('button', { name: '제출 내역 보관', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('실제 제출본 버전', { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel('제출일').fill('2026-11-16');
  await dialog.getByRole('textbox', { name: '제출 방식', exact: true }).fill('기업 홈페이지');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.stage-history')).toContainText('지원 완료');
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '일정 제목', exact: true }).fill('면접 준비');
  await dialog.getByLabel('일정 날짜').fill('2026-11-20');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.event-row')).toContainText('시간 미정');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.goto('#/applications');
  if (info.project.name === 'desktop') {
    const card = page.locator('.kanban-card');
    await card.scrollIntoViewIfNeeded();
    const source = (await card.boundingBox())!;
    await page.mouse.move(source.x + 10, source.y + 10);
    await page.mouse.down();
    // Start dragging before scrolling the off-screen destination into view.
    await page.mouse.move(source.x + 20, source.y + 20, { steps: 5 });
    const destination = page
      .locator('.kanban-column')
      .filter({ has: page.getByRole('heading', { name: '면접 진행 0', exact: true }) });
    await destination.scrollIntoViewIfNeeded();
    const target = (await destination.boundingBox())!;
    await page.mouse.move(target.x + 100, target.y + 100, { steps: 10 });
    await page.mouse.move(target.x + 105, target.y + 105);
    await page.mouse.up();
  } else {
    await page.getByLabel('가상 채용 기업 단계 변경', { exact: true }).selectOption('면접 진행');
  }
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('button', { name: '테이블', exact: true }).click();
  await expect(page.locator('.jobs-table')).toContainText('면접 진행');
  await page.reload();
  await page.getByRole('button', { name: '테이블', exact: true }).click();
  await expect(page.locator('.jobs-table')).toContainText('면접 준비');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('applications.png'), fullPage: true });
  await page.goto('#/resumes');
  await page.getByRole('button', { name: '새 이력서 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await page.goto(appUrl);
  await page.getByRole('link', { name: '보관된 제출본 확인 / PDF' }).click();
  await expect(page.locator('.resume-preview')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.resume-pages')).toContainText('가상 지원자');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.pdf({ path: info.outputPath('submission.pdf'), preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  await page.goto(jobUrl);
  await expect(page.locator('.requirement-card').first()).toContainText('확인됨');
});

test('empty new screens, responsive layout and accessibility', async ({ page }, info) => {
  for (const path of ['#/jobs', '#/applications']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto('#/jobs');
  await page.getByRole('button', { name: '채용공고 등록', exact: true }).click();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.screenshot({ path: info.outputPath('job-form.png') });
});

test('dirty dialogs protect navigation and reject a stale save from another tab', async ({
  page,
  context,
}) => {
  await page.goto('#/jobs');
  await page.getByRole('button', { name: '채용공고 등록', exact: true }).click();
  await page.getByRole('textbox', { name: '기업명', exact: true }).fill('가상 충돌 기업');
  await page.getByRole('textbox', { name: '채용공고 제목', exact: true }).fill('동시 편집 검증');
  await page.getByRole('textbox', { name: '지원 직무', exact: true }).fill('개발자');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: '동시 편집 검증', exact: true }).click();
  const jobUrl = page.url();
  await page.getByRole('button', { name: '공고 수정' }).click();
  await page.getByRole('textbox', { name: '근무지역', exact: true }).fill('첫 탭의 미저장 입력');
  page.once('dialog', (d) => d.dismiss());
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(jobUrl);
  await expect(page.getByRole('textbox', { name: '근무지역', exact: true })).toHaveValue(
    '첫 탭의 미저장 입력',
  );
  const other = await context.newPage();
  await other.goto(jobUrl);
  await other.getByRole('button', { name: '공고 수정' }).click();
  await other.getByRole('textbox', { name: '근무지역', exact: true }).fill('두 번째 탭의 저장');
  await other.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(other.getByRole('dialog')).toHaveCount(0);
  await page.bringToFront();
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('다른 화면에서 변경된 기록');
  await expect(page.getByRole('textbox', { name: '근무지역', exact: true })).toHaveValue(
    '첫 탭의 미저장 입력',
  );
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.job-facts')).toContainText('두 번째 탭의 저장');
  await other.close();
});

for (const legacyVersion of [1, 2, 3]) {
  test(`browser upgrades a real v${legacyVersion} IndexedDB without changing original rows`, async ({
    page,
  }) => {
    const now = '2026-11-16T00:00:00.000Z';
    const meta = () => ({ id: crypto.randomUUID(), createdAt: now, updatedAt: now });
    const profile = {
      ...emptyProfile,
      ...meta(),
      id: 'profile' as const,
      name: '가상 이전 사용자',
      email: 'test@example.invalid',
      targetRole: '개발자',
    };
    const career = {
      ...emptyCareer,
      ...meta(),
      company: '가상 이전 경력',
      position: '개발자',
      startDate: '2024-01',
      current: true,
    };
    const project = {
      ...emptyProject,
      ...meta(),
      careerId: career.id,
      name: '가상 이전 프로젝트',
      role: '개발자',
      startDate: '2024-01',
      current: true,
    };
    const resume = {
      ...meta(),
      revision: 1,
      content: createDocument({ profile, careers: [career], projects: [project] }),
    };
    const version = {
      id: crypto.randomUUID(),
      resumeId: resume.id,
      number: 1,
      kind: 'submitted',
      label: '',
      createdAt: now,
      content: structuredClone(resume.content),
    };
    const rows: Record<string, object[]> = {
      profiles: [profile],
      careers: [career],
      projects: [project],
      settings: [{ id: 'settings', lastBackupAt: now }],
      ...(legacyVersion >= 2 ? { resumes: [resume], resumeVersions: [version] } : {}),
      ...(legacyVersion === 3
        ? {
            jobs: [
              {
                ...emptyJob,
                ...meta(),
                company: '가상 이전 공고 기업',
                title: '기존 v3 공고',
                role: '개발자',
                revision: 1,
                requirements: [],
                analyses: [],
              },
            ],
            applications: [],
            events: [],
          }
        : {}),
    };
    // Playwright gives each test a fresh browser context. Do not open any user's profile.
    await page.route(
      '**/career-os/',
      (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<title>Isolated migration fixture</title>',
        }),
      { times: 1 },
    );
    await page.goto('http://127.0.0.1:4173/career-os/');
    await page.evaluate(
      async ({ legacyVersion, rows }) => {
        await new Promise<void>((resolve, reject) => {
          // Dexie stores a logical version multiplied by ten in native IndexedDB.
          const request = indexedDB.open('career-os', legacyVersion * 10);
          request.onerror = () => reject(request.error);
          request.onupgradeneeded = () => {
            const database = request.result;
            for (const name of Object.keys(rows)) {
              const table = database.createObjectStore(name, { keyPath: 'id' });
              if (name === 'careers') {
                table.createIndex('updatedAt', 'updatedAt');
                table.createIndex('company', 'company');
              } else if (name === 'projects') {
                table.createIndex('careerId', 'careerId');
                table.createIndex('updatedAt', 'updatedAt');
                table.createIndex('skills', 'skills', { multiEntry: true });
              } else if (name === 'resumes' || name === 'jobs')
                table.createIndex('updatedAt', 'updatedAt');
              else if (name === 'applications') {
                table.createIndex('jobId', 'jobId');
                table.createIndex('updatedAt', 'updatedAt');
              } else if (name === 'events') {
                table.createIndex('applicationId', 'applicationId');
                table.createIndex('date', 'date');
              } else if (name === 'resumeVersions') {
                table.createIndex('resumeId', 'resumeId');
                table.createIndex('[resumeId+number]', ['resumeId', 'number'], { unique: true });
                table.createIndex('createdAt', 'createdAt');
              }
            }
          };
          request.onsuccess = () => {
            const database = request.result;
            const tx = database.transaction(Object.keys(rows), 'readwrite');
            for (const [name, values] of Object.entries(rows))
              values.forEach((row) => tx.objectStore(name).add(row));
            tx.onabort = () => {
              database.close();
              reject(tx.error);
            };
            tx.oncomplete = () => {
              database.close();
              resolve();
            };
          };
        });
      },
      { legacyVersion, rows },
    );
    await page.reload();
    await page.getByRole('link', { name: '설정 및 백업', exact: true }).click();
    await expect(page.getByRole('heading', { name: '설정 및 백업', exact: true })).toBeVisible();
    const after = await page.evaluate(async () => {
      return new Promise<{ version: number; rows: Record<string, unknown[]> }>(
        (resolve, reject) => {
          const request = indexedDB.open('career-os');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const result = { version: database.version, rows: {} as Record<string, unknown[]> };
            const tx = database.transaction([...database.objectStoreNames], 'readonly');
            for (const name of database.objectStoreNames) {
              const read = tx.objectStore(name).getAll();
              read.onsuccess = () => {
                result.rows[name] = read.result;
              };
            }
            tx.onabort = () => {
              database.close();
              reject(tx.error);
            };
            tx.oncomplete = () => {
              database.close();
              resolve(result);
            };
          };
        },
      );
    });
    expect(after.version).toBe(40);
    for (const [name, values] of Object.entries(rows)) expect(after.rows[name]).toEqual(values);
    for (const name of [
      'preparations',
      'questions',
      'sessions',
      'interviewAnalyses',
      'portfolios',
      'portfolioAssets',
    ])
      expect(after.rows[name]).toEqual([]);
    await page.goto('#/projects');
    await expect(page.getByRole('heading', { name: project.name, exact: true })).toBeVisible();
    if (legacyVersion >= 2) {
      await page.goto(`#/resumes/${resume.id}`);
      await page.getByLabel('이력서 버전 보기').selectOption(version.id);
      await expect(page.getByText('V1 · 읽기 전용', { exact: true })).toBeVisible();
    }
  });
}

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { emptyProfile, emptyProject } from '../src/data/schema';

test.setTimeout(120000);
async function seed(page: Page) {
  const now = '2026-11-16T00:00:00.000Z';
  const backup = {
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
          name: '가상 포트폴리오 작성자',
          email: 'private@example.invalid',
          headline: '문제를 이해하고 검증하는 개발자',
          targetRole: '프론트엔드',
          skills: ['React', 'TypeScript'],
        },
      ],
      careers: [],
      projects: ['공개 검토 프로젝트', '비공개 검증 프로젝트'].map((name) => ({
        ...emptyProject,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        name,
        summary: '테스트용 경험 기록',
        role: '개발자',
        startDate: '2024-01',
        current: true,
        skills: ['React'],
        contribution: '직접 구현한 가상 화면',
        problem: '테스트용 문제',
        outcome: '실제로 존재하지 않는 가상의 테스트 결과',
      })),
    },
  };
  await page.goto('#/settings');
  await page.getByLabel('백업 파일', { exact: true }).setInputFiles({
    name: 'synthetic-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: '백업으로 교체' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
}

test('JD preparation, STAR versions, session resume, follow-up and review feedback', async ({
  page,
}, info) => {
  await seed(page);
  await page.goto('#/jobs');
  await page.getByRole('button', { name: '채용공고 등록', exact: true }).click();
  await page.getByRole('textbox', { name: '기업명', exact: true }).fill('가상 면접 기업');
  await page
    .getByRole('textbox', { name: '채용공고 제목', exact: true })
    .fill('가상 프론트엔드 공고');
  await page.getByRole('textbox', { name: '지원 직무', exact: true }).fill('프론트엔드');
  await page.getByLabel('JD 원문 전체').fill('자격요건\nReact.js 경험');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: '가상 프론트엔드 공고', exact: true }).click();
  await page.getByRole('link', { name: '이 공고로 면접 준비' }).click();
  await page.getByRole('dialog').getByLabel('공개 검토 프로젝트', { exact: true }).check();
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /JD의 “React.js 경험”/ })).toBeVisible();
  await page.getByRole('link', { name: 'STAR 답변 작성 →' }).first().click();
  const answerUrl = page.url();
  await page.getByLabel('Action · 실제 행동').fill('저의 담당 범위를 구분해 화면을 구현했습니다.');
  await page.getByLabel('Result · 결과와 근거').fill('가상 테스트 보고서로 동작을 확인했습니다.');
  await expect(page.getByText('저장 완료', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '답변 버전 생성' }).click();
  await expect(page.getByText('최신 지정: V1')).toBeVisible();
  await page.getByLabel('Action · 실제 행동').fill('개선한 답변의 개인 기여');
  await expect(page.getByText('저장 완료', { exact: true })).toBeVisible();
  await page.getByLabel('비교할 답변 버전').selectOption({ index: 1 });
  await expect(page.getByRole('region', { name: '이전 답변', exact: true })).toContainText(
    '저의 담당 범위',
  );
  await axe(page);
  await page.reload();
  await expect(page.getByLabel('Action · 실제 행동')).toHaveValue('개선한 답변의 개인 기여');
  await page.getByRole('link', { name: '← 면접 준비' }).click();
  await page.getByRole('button', { name: '모의 면접 시작' }).click();
  await page.getByLabel('질문 개수 · 1~30').fill('2');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page).toHaveURL(/interviews\/sessions\//);
  await page.clock.install();
  await page.getByRole('button', { name: '시작 / 이어하기' }).click();
  await page.clock.runFor(3000);
  const elapsed = page.getByLabel('답변 경과 시간', { exact: true });
  expect(Number((await elapsed.textContent())!.replace('초', ''))).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const visibleTime = await elapsed.textContent();
  await page.clock.runFor(4000);
  await expect(elapsed).toHaveText(visibleTime!);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page
    .getByLabel('면접 답변', { exact: true })
    .fill('제가 직접 구현한 범위와 검증 방법을 설명합니다.');
  await page.getByLabel('꼬리질문 선택').selectOption({ index: 1 });
  await page.getByRole('button', { name: '꼬리질문 추가', exact: true }).click();
  await page.getByLabel('꼬리질문 답변 1').fill('직접 작성한 컴포넌트와 테스트입니다.');
  await page.getByLabel('이 질문 답변 완료').check();
  await page.getByLabel('개인 기여도 설명', { exact: true }).selectOption('2');
  await page.getByLabel('다음 개선사항').fill('설계 대안의 비교 근거 추가');
  await page.getByLabel('이 질문 복습 필요').check();
  await page.getByRole('button', { name: '중단 및 저장' }).click();
  await expect(page.getByText('저장 완료', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('면접 답변', { exact: true })).toHaveValue(
    '제가 직접 구현한 범위와 검증 방법을 설명합니다.',
  );
  await expect(page.getByLabel('꼬리질문 답변 1')).toHaveValue(
    '직접 작성한 컴포넌트와 테스트입니다.',
  );
  const restoredTime = await elapsed.textContent();
  await page.clock.fastForward(60000);
  await expect(elapsed).toHaveText(restoredTime!);
  await page.getByRole('button', { name: '다음 질문', exact: true }).click();
  await page.getByLabel('면접 답변', { exact: true }).fill('두 번째 질문의 실제 경험 답변');
  await page.getByLabel('이 질문 답변 완료').check();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '세션 종료', exact: true }).click();
  await expect(page.getByText(/모의 면접 · 완료 · 답변 완료 2\/2/)).toBeVisible();
  await axe(page);
  await page.screenshot({ path: info.outputPath('interview-session.png'), fullPage: true });
  await page.getByRole('link', { name: '← 면접 기록' }).click();
  await page.getByLabel('질문 상태 필터').selectOption('review');
  await expect(page.getByRole('link', { name: 'STAR 답변 작성 →' })).toHaveCount(1);
  await page.getByRole('button', { name: 'ChatGPT 프롬프트', exact: true }).click();
  await expect(page.getByRole('button', { name: '면접 프롬프트 복사' })).toBeDisabled();
  await page.getByLabel('프로젝트 자료 · 공개 검토 프로젝트').check();
  await expect(page.getByLabel('면접 프롬프트 전체 미리보기')).toHaveValue(/직접 구현한 가상 화면/);
  await expect(page.getByLabel('면접 프롬프트 전체 미리보기')).not.toHaveValue(/private@example/);
  await page.getByLabel('전체 프롬프트의 개인정보·회사 내부 정보를 확인했습니다.').check();
  await expect(page.getByRole('button', { name: '면접 프롬프트 복사' })).toBeEnabled();
  await page.goto(answerUrl);
});

test('portfolio editing, approval, images and independent public data rendering', async ({
  page,
  context,
}, info) => {
  await seed(page);
  await page.goto('#/portfolios');
  await page.getByRole('button', { name: '포트폴리오 만들기' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page).toHaveURL(/portfolios\//);
  const preview = page.getByRole('region', { name: '현재 브라우저 공개 미리보기' });
  await expect(preview).not.toContainText('비공개 검증 프로젝트');
  await expect(preview).not.toContainText('private@example.invalid');
  await page.getByLabel('공개 포트폴리오 제목').fill('가상 개발자의 작업 기록');
  await page.getByLabel('소개 섹션 공개').check();
  await page.getByLabel('기술스택 섹션 공개').check();
  await page.getByLabel('프로젝트 섹션 공개').check();
  const project = page
    .locator('.portfolio-project-editor')
    .filter({ has: page.locator('summary').filter({ hasText: '공개 검토 프로젝트' }) });
  await project.locator('summary').first().click();
  await project.getByLabel('공개 검토 프로젝트 프로젝트 공개', { exact: true }).check();
  await project
    .getByLabel('기술적 문제 해결', { exact: true })
    .fill('문제 재현, 원인 분석, 회귀 검증 순서로 해결했습니다.');
  await project.getByLabel('프로젝트 이미지 추가').setInputFiles({
    name: 'diagram.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  });
  await expect(page.getByRole('alert')).toContainText('PNG');
  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const drawing = canvas.getContext('2d')!;
      drawing.fillStyle = '#1b5a59';
      drawing.fillRect(0, 0, 32, 32);
      return canvas.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
  await project
    .getByLabel('프로젝트 이미지 추가')
    .setInputFiles({ name: 'private-diagram.png', mimeType: 'image/png', buffer: png });
  await expect(project.getByAltText('업로드 이미지 · 대체 텍스트 작성 필요')).toBeVisible();
  await project.getByLabel('이미지 대체 텍스트').fill('가상 구성도');
  await project.getByLabel('이 이미지의 공개를 승인합니다').check();
  await expect(page.getByText('저장 완료', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '승인한 정적 파일 내보내기' })).toBeDisabled();
  await page.getByRole('button', { name: '공개 미리보기와 JSON 확인 완료' }).click();
  await page.getByLabel('선택한 문구·회사 정보·연락처·이미지의 공개를 최종 승인합니다').check();
  await page.getByLabel('한 줄 소개', { exact: true }).fill('확인한 근거를 기록하는 개발자');
  await expect(page.getByRole('button', { name: '승인한 정적 파일 내보내기' })).toBeDisabled();
  await page.getByRole('button', { name: '공개 미리보기와 JSON 확인 완료' }).click();
  await page.getByLabel('선택한 문구·회사 정보·연락처·이미지의 공개를 최종 승인합니다').check();
  const json = await page.getByLabel('최종 공개 JSON', { exact: true }).inputValue();
  const publicData = JSON.parse(json);
  expect(publicData.projects).toHaveLength(1);
  expect(publicData.projects[0].images).toHaveLength(1);
  for (const text of [
    'private@example.invalid',
    '비공개 검증 프로젝트',
    'sourceId',
    'interview',
    'private-diagram',
  ])
    expect(json).not.toContain(text);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '승인한 정적 파일 내보내기' }).click();
  const zip = await download;
  await zip.saveAs(info.outputPath('public-portfolio.zip'));
  const bytes = await readFile((await zip.path())!);
  expect(bytes.subarray(0, 4)).toEqual(Buffer.from([80, 75, 3, 4]));
  await expect(page.getByText('초안 수정', { exact: false })).toBeVisible();
  await expect(page.getByText('저장 완료', { exact: true })).toBeVisible();
  await axe(page);
  const publicPage = await context.newPage();
  await publicPage.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new Error('Public page must never access IndexedDB');
      },
    });
  });
  const errors: string[] = [];
  publicPage.on('pageerror', (e) => errors.push(e.message));
  await publicPage.route('**/portfolio/portfolio.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: json }),
  );
  await publicPage.route('**/portfolio/images/*.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: png }),
  );
  await publicPage.goto('http://127.0.0.1:4173/career-os/portfolio.html');
  await expect(
    publicPage.getByRole('heading', { name: '확인한 근거를 기록하는 개발자' }),
  ).toBeVisible();
  await expect(publicPage.getByRole('navigation', { name: '주요 메뉴' })).toHaveCount(0);
  await axe(publicPage);
  await publicPage.screenshot({ path: info.outputPath('public-portfolio.png'), fullPage: true });
  await publicPage.getByRole('button', { name: '공개 검토 프로젝트 프로젝트 상세' }).click();
  await expect(
    publicPage.getByText('문제 재현, 원인 분석, 회귀 검증 순서로 해결했습니다.'),
  ).toBeVisible();
  await expect(publicPage.getByAltText('가상 구성도')).toBeVisible();
  expect(errors).toEqual([]);
  await publicPage.close();
  await page.goto('#/projects');
  await expect(
    page.getByRole('heading', { name: '공개 검토 프로젝트', exact: true }),
  ).toBeVisible();
});

test('new empty routes and public fallback are accessible and have no page overflow', async ({
  page,
}) => {
  for (const path of ['#/interviews', '#/portfolios', 'portfolio.html']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await axe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await expect(page.getByText('아직 게시된 포트폴리오가 없습니다.')).toBeVisible();
});

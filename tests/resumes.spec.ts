import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { emptyCareer, emptyProfile, emptyProject } from '../src/data/schema';

function legacyBackup(long = false) {
  const timestamp = '2026-11-16T00:00:00.000Z';
  const careerId = crypto.randomUUID();
  return {
    app: 'career-os',
    schemaVersion: 1,
    exportedAt: timestamp,
    data: {
      profiles: [
        {
          ...emptyProfile,
          id: 'profile',
          createdAt: timestamp,
          updatedAt: timestamp,
          name: '가상 지원자',
          email: 'test@example.invalid',
          targetRole: '프론트엔드 개발자',
          headline: '사용자 경험을 개선하는 가상의 개발자',
          competencies: ['접근성 개선'],
          skills: ['React', 'TypeScript'],
        },
      ],
      careers: [
        {
          ...emptyCareer,
          id: careerId,
          createdAt: timestamp,
          updatedAt: timestamp,
          company: '가상 테스트 회사',
          position: '개발자',
          startDate: '2023-01',
          current: true,
          responsibilities: '사용자 화면 개발',
        },
      ],
      projects: ['첫 번째 프로젝트', '두 번째 프로젝트'].map((name, index) => ({
        ...emptyProject,
        id: `00000000-0000-4000-8000-00000000000${index + 1}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        careerId,
        name,
        role: '프론트엔드 설계',
        summary: '실제 개인정보를 포함하지 않은 검증용 프로젝트',
        startDate: '2024-01',
        current: true,
        skills: ['React'],
        contribution: long
          ? '문제를 분석하고 접근성을 검증했습니다. 기술 선택의 근거를 기록했습니다. '.repeat(100) +
            '긴 설명의 마지막 문장'
          : '직접 컴포넌트 구현',
        implementation: '모듈 구조와 테스트 설계',
        outcome: '가상의 검증 결과',
      })),
    },
  };
}
async function seed(page: Page, long = false) {
  const data = legacyBackup(long);
  await page.goto('#/settings');
  await page.getByLabel('백업 파일', { exact: true }).setInputFiles({
    name: 'phase1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.getByRole('dialog')).toContainText('v1 백업에는 이력서가 없으므로');
  await page.getByRole('dialog').getByRole('button', { name: '백업으로 교체' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('#/resumes');
  await page.getByRole('button', { name: '새 이력서 만들기', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: '이력서 제목', exact: true })).toBeVisible();
  await expect(page.locator('.resume-preview')).toHaveAttribute('data-ready', 'true');
  return data;
}
async function saved(page: Page) {
  await expect(page.getByText('저장 완료', { exact: true })).toBeVisible();
}

test('draft autosave, selection, order, sections, supplements, duplicate and delete', async ({
  page,
}, testInfo) => {
  await seed(page);
  const editorUrl = page.url();
  await page
    .getByRole('textbox', { name: '이력서 제목', exact: true })
    .fill('가상 기업 맞춤 이력서');
  await page.getByLabel('지원 기업명', { exact: true }).fill('가상 지원 기업');
  await page.getByLabel('두 번째 프로젝트 포함').uncheck();
  await saved(page);
  await expect(page.locator('.resume-pages')).not.toContainText('두 번째 프로젝트');
  await page.getByLabel('두 번째 프로젝트 포함').check();
  await page.getByRole('button', { name: '두 번째 프로젝트 위로', exact: true }).click();
  await page.getByText('섹션 표시 및 순서', { exact: true }).click();
  await page.getByLabel('기술스택 표시', { exact: true }).uncheck();
  await page.getByText('학력 · 자격증 · 수상 · 외국어', { exact: true }).click();
  await page.getByRole('button', { name: '학력 추가', exact: true }).click();
  await page.getByLabel('학교명', { exact: true }).fill('가상 대학교');
  await page.getByRole('button', { name: '자격증 / 수상 추가', exact: true }).click();
  await page.getByLabel('자격증 / 수상 이름', { exact: true }).fill('가상 자격증');
  await page.getByRole('button', { name: '외국어 추가', exact: true }).click();
  await page.getByLabel('언어', { exact: true }).fill('영어');
  await page.getByLabel('구사 수준', { exact: true }).fill('업무 소통');
  await saved(page);
  await page.reload();
  await expect(page.getByRole('textbox', { name: '이력서 제목', exact: true })).toHaveValue(
    '가상 기업 맞춤 이력서',
  );
  await expect(page.locator('.resume-preview')).toHaveAttribute('data-ready', 'true');
  const preview = page.locator('.resume-pages');
  await expect(preview).toContainText('가상 대학교');
  await expect(preview).toContainText('가상 자격증');
  await expect(preview).toContainText('업무 소통');
  await expect(preview.locator('h2', { hasText: '기술스택' })).toHaveCount(0);
  const text = await preview.textContent();
  expect(text!.indexOf('두 번째 프로젝트')).toBeLessThan(text!.indexOf('첫 번째 프로젝트'));
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '미리보기', exact: true }).click();
    await expect(page.locator('.resume-preview-panel')).toBeVisible();
    expect(
      await page
        .locator('.preview-scroll')
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('resume-studio.png'), fullPage: false });
  await page.goto('#/resumes');
  await page.getByRole('button', { name: '가상 기업 맞춤 이력서 복제' }).click();
  await expect(page.getByRole('textbox', { name: '이력서 제목', exact: true })).toHaveValue(
    '가상 기업 맞춤 이력서 (복사)',
  );
  expect(page.url()).not.toBe(editorUrl);
  await page.goto('#/resumes');
  await page.getByRole('button', { name: '가상 기업 맞춤 이력서 (복사) 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
  await expect(
    page.getByRole('heading', { name: '가상 기업 맞춤 이력서 (복사)', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '가상 기업 맞춤 이력서 (복사) 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '가상 기업 맞춤 이력서 (복사)', exact: true }),
  ).toHaveCount(0);
});

test('immutable submitted versions, source comparison and v2 backup round-trip', async ({
  page,
}) => {
  await seed(page);
  const url = page.url();
  await page.getByText('프로젝트 문구 편집', { exact: true }).first().click();
  await page.getByLabel('본인 기여', { exact: true }).first().fill('초안에만 있는 맞춤 기여');
  await saved(page);
  await page.getByRole('button', { name: '버전 저장', exact: true }).click();
  await expect(page.getByText('V1 · 읽기 전용', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '초안으로 돌아가기' }).click();
  await page.getByRole('button', { name: '제출본 확정', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '제출본으로 보관' }).click();
  await expect(page.getByText('V2 · 읽기 전용', { exact: true })).toBeVisible();
  const versionId = await page.getByLabel('이력서 버전 보기').inputValue();
  await expect(page.locator('.resume-pages')).toContainText('초안에만 있는 맞춤 기여');
  await page.getByRole('button', { name: '초안으로 돌아가기' }).click();
  await page.getByLabel('이름', { exact: true }).fill('변경한 초안 이름');
  await saved(page);
  await page.goto('#/projects');
  await page.getByRole('button', { name: '첫 번째 프로젝트 수정', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('본인 담당 범위와 기여')).toHaveValue(
    '직접 컴포넌트 구현',
  );
  await page.getByRole('dialog').getByLabel('프로젝트명').fill('변경된 원본 프로젝트');
  await page.getByRole('dialog').getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(url);
  await page.getByLabel('이력서 버전 보기').selectOption(versionId);
  await expect(page.locator('.resume-pages')).toContainText('가상 지원자');
  await expect(page.locator('.resume-pages')).not.toContainText('변경한 초안 이름');
  await expect(page.locator('.resume-pages')).toContainText('첫 번째 프로젝트');
  await page.getByLabel('비교 대상', { exact: true }).selectOption('source');
  await expect(page.locator('.comparison-content')).toContainText('변경된 원본 프로젝트');
  await page.goto('#/settings');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON 백업', exact: true }).click();
  const download = await downloadEvent;
  const contents = await readFile((await download.path())!, 'utf8');
  const data = JSON.parse(contents);
  expect(data.schemaVersion).toBe(2);
  expect(data.data.resumes).toHaveLength(1);
  expect(data.data.resumeVersions).toHaveLength(2);
  await page.getByLabel('백업 파일', { exact: true }).setInputFiles({
    name: 'v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
  await page.getByRole('dialog').getByRole('button', { name: '백업으로 교체' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(url);
  await page.getByLabel('이력서 버전 보기').selectOption(versionId);
  await page.reload();
  await page.getByLabel('이력서 버전 보기').selectOption(versionId);
  await expect(page.locator('.resume-pages')).toContainText('초안에만 있는 맞춤 기여');
});

test('navigation protects unsaved changes and accessibility stays usable', async ({ page }) => {
  await seed(page);
  const editorUrl = page.url();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByLabel('지원 직무', { exact: true }).fill('변경 중인 직무');
  await page
    .getByRole('navigation', { name: '주요 메뉴' })
    .getByRole('link', { name: '프로젝트', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('저장한 뒤 이동할까요');
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
  await expect(page.getByLabel('지원 직무', { exact: true })).toHaveValue('변경 중인 직무');
  await page.clock.runFor(600);
  await saved(page);
  await page.getByLabel('지원 직무', { exact: true }).fill('잠깐 입력한 문구');
  await page.getByLabel('지원 직무', { exact: true }).fill('변경 중인 직무');
  await page.clock.runFor(600);
  await saved(page);
  await page.getByLabel('지원 직무', { exact: true }).fill('이동 전에 저장한 직무');
  await page
    .getByRole('navigation', { name: '주요 메뉴' })
    .getByRole('link', { name: '프로젝트', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: '저장 후 이동' }).click();
  await expect(page).toHaveURL(/#\/projects$/);
  await page.clock.resume();
  await page.goto(editorUrl);
  await expect(page.getByLabel('지원 직무', { exact: true })).toHaveValue('이동 전에 저장한 직무');
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => node.target) })),
  ).toEqual([]);
});

test('A4 pagination, print invocation and real PDF output', async ({ page }, testInfo) => {
  await seed(page, true);
  await expect(page.locator('.resume-preview')).toHaveAttribute('data-ready', 'true');
  const count = await page.locator('.resume-page').count();
  expect(count).toBeGreaterThan(2);
  const overflow = await page.locator('.resume-page-body').evaluateAll((pages) =>
    pages.some((page) => {
      const box = page.getBoundingClientRect();
      return [...page.children].some(
        (child) => child.getBoundingClientRect().bottom > box.bottom + 1,
      );
    }),
  );
  expect(overflow).toBe(false);
  await expect(page.locator('.resume-pages')).toContainText('긴 설명의 마지막 문장');
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printInvoked = 'true';
    };
  });
  await page.getByRole('button', { name: '인쇄 / PDF 저장', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-invoked', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.resume-edit-panel')).toBeHidden();
  const pdf = await page.pdf({
    path: testInfo.outputPath('resume-a4.pdf'),
    preferCSSPageSize: true,
    printBackground: true,
  });
  const parsed = await PDFDocument.load(pdf);
  expect(parsed.getPageCount()).toBe(count);
  for (const sheet of parsed.getPages()) {
    expect(sheet.getWidth()).toBeCloseTo(595.28, 0);
    expect(sheet.getHeight()).toBeCloseTo(841.89, 0);
  }
  await page.emulateMedia({ media: 'screen' });
});

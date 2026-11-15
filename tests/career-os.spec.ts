import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

async function addCareer(page: Page) {
  await page.goto('#/career');
  await page.getByRole('button', { name: '경력 추가', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('회사명').fill('가상 검증 회사');
  await dialog.getByLabel('직책 / 직무').fill('프론트엔드 개발자');
  await dialog.getByLabel('시작일').fill('2024-01');
  await dialog.getByLabel('현재 재직 중').check();
  await dialog.getByLabel('담당업무').fill('가상 테스트 데이터 · 실제 개인정보 아님');
  await dialog.getByRole('button', { name: '경력 저장' }).click();
  await expect(dialog).toHaveCount(0);
}

async function addProject(page: Page, linked = true) {
  await page.goto('#/projects?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('프로젝트명').fill('검증용 프로젝트');
  await dialog.getByLabel('프로젝트 개요').fill('데이터 저장과 복원을 검증하는 가상의 프로젝트');
  if (linked)
    await dialog
      .getByLabel('연결할 경력')
      .selectOption({ label: '가상 검증 회사 · 프론트엔드 개발자' });
  await dialog.getByLabel('시작일').fill('2024-02');
  await dialog.getByLabel('현재 진행 중').check();
  await dialog.getByLabel('사용 기술').fill('React, TypeScript');
  await dialog.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(dialog).toHaveCount(0);
}

test('empty state, direct routes, responsive layout, accessibility', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('');
  await expect(page.getByRole('heading', { name: '나의 다음 챕터를 준비하세요' })).toBeVisible();
  await expect(page.getByText('아직 기록된 프로젝트가 없어요')).toBeVisible();
  await expect(page.locator('.stat-number').first()).toHaveText('0개');
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    accessibility.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  for (const route of ['#/career', '#/projects', '#/settings']) {
    await page.goto(route);
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const routeAccessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(routeAccessibility.violations.map(({ id }) => `${route}: ${id}`)).toEqual([]);
  }
  await page.goto('#/missing');
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('profile validation, persistence, safe rendering, edit and delete', async ({ page }) => {
  await page.goto('#/career?edit=profile');
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '프로필 저장' }).click();
  await expect(dialog.getByText('필수 항목을 입력해 주세요.')).toBeVisible();
  await dialog.getByRole('textbox', { name: '이름', exact: true }).fill('가상 사용자');
  await dialog.getByLabel('이메일').fill('invalid');
  await dialog.getByRole('button', { name: '프로필 저장' }).click();
  await expect(dialog.getByText('이메일 형식을 확인해 주세요.')).toBeVisible();
  await dialog.getByLabel('이메일').fill('sample@example.invalid');
  await dialog.getByLabel('한 줄 소개').fill('<img src=x onerror=alert(1)>');
  await dialog.getByLabel('기술스택').fill('React, React, TypeScript');
  await dialog.getByRole('button', { name: '프로필 저장' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '가상 사용자', exact: true })).toBeVisible();
  await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
  await expect(page.locator('.profile-body img')).toHaveCount(0);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '이름', exact: true }).fill('수정한 가상 사용자');
  await dialog.getByRole('button', { name: '프로필 저장' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '프로필 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: '수정한 가상 사용자' })).toBeVisible();
  await page.getByRole('button', { name: '프로필 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('button', { name: '프로필 만들기' })).toBeVisible();
});

test('career and project CRUD survives reload and preserves unlinked projects', async ({
  page,
}) => {
  await addCareer(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: '가상 검증 회사' })).toBeVisible();
  await page.getByRole('button', { name: '가상 검증 회사 수정' }).click();
  await page.getByRole('dialog').getByLabel('부서').fill('개발팀');
  await page.getByRole('dialog').getByRole('button', { name: '경력 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await addProject(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: '검증용 프로젝트' })).toBeVisible();
  await page.getByRole('button', { name: '검증용 프로젝트 수정' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('프로젝트명').fill('수정된 검증 프로젝트');
  await dialog.getByLabel('본인 담당 범위와 기여').fill('저장 로직 구현');
  await dialog.getByLabel('결과 및 성과').fill('데이터 유지 확인');
  await dialog.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('프로젝트 검색').fill('없는 검색어');
  await expect(page.getByText('검색 결과가 없어요')).toBeVisible();
  await page.getByRole('button', { name: '검색 초기화' }).click();
  await page.getByLabel('프로젝트 상태 필터').selectOption('done');
  await expect(page.getByText('검색 결과가 없어요')).toBeVisible();
  await page.goto('#/career');
  await page.getByRole('button', { name: '가상 검증 회사 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('#/projects');
  await expect(page.getByRole('heading', { name: '수정된 검증 프로젝트' })).toBeVisible();
  await expect(page.getByText('개인 / 기타', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '수정된 검증 프로젝트 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('첫 프로젝트가 다음 기회의 시작이에요')).toBeVisible();
});

test('backup download, invalid file, cancellation and restore', async ({ page }) => {
  await addCareer(page);
  await addProject(page);
  await page.goto('#/settings');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON 백업', exact: true }).click();
  const download = await downloadEvent;
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const json = await readFile(filePath!, 'utf-8');
  expect(JSON.parse(json).data.projects).toHaveLength(1);
  const upload = page.getByLabel('백업 파일', { exact: true });
  await upload.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  });
  await expect(page.getByRole('alert')).toContainText('올바른 JSON 파일이 아닙니다');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await upload.setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
  await page.goto('#/projects');
  await page.getByRole('button', { name: '검증용 프로젝트 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('#/settings');
  await upload.setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await page.getByRole('dialog').getByRole('button', { name: '백업으로 교체' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.goto('#/projects');
  await expect(page.getByRole('heading', { name: '검증용 프로젝트' })).toBeVisible();
  await expect(page.getByText('가상 검증 회사', { exact: true })).toBeVisible();
});

test('form accessibility, long text and dirty cancellation', async ({ page }) => {
  await page.goto('#/projects?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('프로젝트명').fill('가'.repeat(180));
  await dialog.getByLabel('시작일').fill('2024-05');
  await dialog.getByLabel('종료일').fill('2024-04');
  await dialog.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(
    dialog.getByText('종료일은 시작일 이후여야 합니다. 진행 중이면 체크해 주세요.'),
  ).toBeVisible();
  await dialog.getByLabel('현재 진행 중').check();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    accessibility.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  page.once('dialog', (browserDialog) => void browserDialog.dismiss());
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

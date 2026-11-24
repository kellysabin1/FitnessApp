import { expect, mockState, test } from './support/fixtures';

test('challenge setup: custom length, group plan rules and daily tasks (max 3)', async ({ page, seed }) => {
  await seed({}, '/challenge-new');
  await page.getByPlaceholder('e.g. November lift club').fill('Booty bootcamp');
  await page.getByText('Custom', { exact: true }).click();
  await page.locator('input[inputmode="numeric"]').first().fill('200');
  await expect(page.getByText('Length should be between 1 and 120 days.')).toBeVisible();
  await page.locator('input[inputmode="numeric"]').first().fill('45');

  await page.getByText('Group plan', { exact: true }).click();
  await expect(page.getByText('Add at least one workout to the plan.')).toBeVisible();
  await page.getByText('Mat Pilates', { exact: true }).click();
  await expect(page.getByText('Add at least one workout to the plan.')).toHaveCount(0);
  await expect(page.getByText('Plan bonus')).toHaveCount(0);
  await page.getByText('Any workout', { exact: true }).click();
  await expect(page.getByText('Plan bonus')).toBeVisible();

  await page.getByText('Drink 3 L water').click();
  await page.getByText('Stretch 10 min').click();
  await page.getByPlaceholder('Write your own').fill('Journal 5 min');
  await page.getByText('Add', { exact: true }).click();
  await expect(page.getByText('That’s the max of 3')).toBeVisible();
  await expect(page.locator('text=/^• /')).toHaveCount(3);
});

test('challenge page: tick a daily task and see it in the points breakdown', async ({ page, seed }) => {
  await seed({}, '/challenge/c1');
  await expect(page.getByText('Lift together, keep it fun.')).toBeVisible();
  await page.getByLabel('Drink 3 L water').click();
  await expect(page.getByLabel('Drink 3 L water, done')).toHaveCount(1);
  await expect.poll(async () => (await mockState()).checks.map((c: any) => c.task_index)).toEqual([0]);
  await page
    .getByLabel(/points — show breakdown/)
    .first()
    .click();
  await expect(page.getByText('Daily tasks', { exact: true })).toBeVisible();
  await page.getByLabel('How scoring works').click();
  await expect(page.locator('text=/Each workout = 10 points/')).toBeVisible();
});

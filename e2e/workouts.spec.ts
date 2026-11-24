import { daysAgo, expect, lb, test } from './support/fixtures';

const hipThrusts = (title = 'Glutes & hamstrings', n = 3) => ({
  id: 'old',
  title,
  startedAt: daysAgo(n).toISOString(),
  finishedAt: new Date(+daysAgo(n) + 3600e3).toISOString(),
  exercises: [
    {
      id: 'e1',
      name: 'Hip Thrust',
      category: 'strength',
      kind: 'weighted',
      sets: [
        { weightKg: lb(135), reps: 8, done: true },
        { weightKg: lb(135), reps: 8, done: true },
      ],
    },
  ],
});

test('repeating a workout shows last time and marks sets that beat it', async ({ page, seed }) => {
  await seed({ workouts: [hipThrusts()] }, '/train');
  await page.getByText('Glutes & hamstrings').first().click();
  await expect(page.getByText(/^Last time/).first()).toContainText('135×8');
  const inputs = page.locator('input[inputmode="decimal"]');
  await inputs.nth(0).fill('145'); // set 1: 145×8 beats 135×8
  await inputs.nth(3).fill('7'); // set 2: 135×7 doesn't
  await page.getByLabel('Mark set done').nth(0).click();
  await page.getByLabel('Mark set done').nth(0).click();
  await expect(page.getByText('1↑', { exact: true })).toHaveCount(1);
  await expect(page.getByText('2↑', { exact: true })).toHaveCount(0);
});

test('logging a past workout saves it at the chosen time and sorts it into history', async ({ page, seed, store }) => {
  await seed({ workouts: [hipThrusts('Older session', 3)] }, '/train');
  await page.getByText('Log a past workout').click();
  await expect(page.getByText('Forgot to log live?', { exact: false })).toBeVisible();
  await page.getByText('Glutes & hamstrings', { exact: true }).last().click();
  await page.getByText('Yesterday', { exact: true }).filter({ visible: true }).last().click();
  await page.getByText('Morning', { exact: true }).filter({ visible: true }).last().click();
  await page.getByText('Add exercises & sets').click();
  const inputs = page.locator('input[inputmode="decimal"]').filter({ visible: true });
  await inputs.nth(0).fill('155');
  await inputs.nth(1).fill('8');
  await page.getByText('Save workout').click();
  await expect.poll(async () => (await store()).workouts.length).toBe(2);
  const s = await store();
  expect(s.workouts.map((w: any) => w.title)).toEqual(['Glutes & hamstrings', 'Older session']);
  const w = s.workouts[0];
  expect(new Date(w.startedAt).getDate()).toBe(daysAgo(1).getDate());
  expect(w.exercises[0].sets[0]).toMatchObject({ reps: 8, done: true });
  expect(w.exercises[0].sets[0].weightKg).toBeCloseTo(lb(155), 3);
  await page.goto('/train');
  await expect(page.getByText('Yesterday morning')).toBeVisible();
});

test('exercise picker finds single-leg moves and saves custom exercises', async ({ page, seed, store }) => {
  await seed({ workouts: [hipThrusts()] }, '/train');
  await page.getByText('Glutes & hamstrings').first().click();
  await page.getByText('Add exercise').click();
  const search = page.getByPlaceholder('Search exercises or muscles');
  await search.fill('single-leg leg');
  await expect(page.getByText('Single-Leg Leg Press', { exact: true })).toBeVisible();
  await search.fill('Monster Walk');
  await page.getByText('Create “Monster Walk”').click();
  await page.getByText('Reps only').click();
  await page.getByText('Save to my exercises').click();
  await expect.poll(async () => (await store()).customExercises.map((e: any) => e.name)).toContain('Monster Walk');
});

import { daysAgo, expect, lb, mockState, test } from './support/fixtures';

const logged = {
  id: 'old',
  title: 'Glutes',
  startedAt: daysAgo(3).toISOString(),
  finishedAt: new Date(+daysAgo(3) + 3600e3).toISOString(),
  exercises: [
    {
      id: 'e1',
      name: 'Hip Thrust',
      category: 'strength',
      kind: 'weighted',
      sets: [
        { warmup: true, weightKg: lb(95), reps: 10, done: true },
        { weightKg: lb(135), reps: 8, done: true },
      ],
    },
  ],
};

test('ready-made split: saved as active, Up next rolls forward after finishing', async ({ page, seed, store }) => {
  await seed(
    {
      profile: {
        name: 'Kelly',
        goals: ['build_strength'],
        experience: 'intermediate',
        daysPerWeek: 4,
        stepGoal: 8000,
        equipment: '',
        notes: '',
      },
    },
    '/train',
  );
  await page.getByText('+ New split').click();
  await page.getByText('Start from a ready-made split', { exact: true }).click();
  await expect(page.getByText('Recommended for your goals').filter({ visible: true }).first()).toBeVisible();
  await page.getByText('Use this split', { exact: true }).first().click();
  await expect(page.getByText('Your active split')).toBeVisible();
  let s = await store();
  expect(s.splits).toHaveLength(1);
  expect(s.activeSplitId).toBe(s.splits[0].id);
  const [first, second] = s.splits[0].workouts.map((w: any) => w.title);

  await page.goto('/train');
  await expect(page.getByText(first, { exact: true }).first()).toBeVisible();
  await page.getByText('Start', { exact: true }).first().click();
  await expect(page).toHaveURL(/\/workout\//);
  s = await store();
  const w = s.workouts.find((x: any) => !x.finishedAt);
  expect(w).toMatchObject({ splitId: s.splits[0].id, title: first });
  expect(w.exercises).toHaveLength(s.splits[0].workouts[0].exercises.length);

  await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('rep-store-v1')!);
    const w = o.state.workouts.find((x: any) => !x.finishedAt);
    w.finishedAt = new Date().toISOString();
    localStorage.setItem('rep-store-v1', JSON.stringify(o));
  });
  await page.goto('/');
  await expect(page.getByText(second, { exact: true }).first()).toBeVisible();
  // the split tag travels with the workout to the account
  await expect
    .poll(async () => Object.values((await mockState()).workouts.uA ?? {}).some((r: any) => r.split_id === s.splits[0].id))
    .toBe(true);
});

test('after a reinstall, untagged workouts still put Up next in the right place', async ({ page, seed }) => {
  const now = Date.now();
  const at = (d: number) => new Date(now - d * 86400e3).toISOString();
  const split = {
    id: 'sp1',
    name: 'Upper/lower',
    source: 'template',
    createdAt: at(10),
    updatedAt: at(10),
    workouts: [
      { id: 'a', title: 'Lower A', exercises: [{ name: 'Back Squat', sets: 3, reps: '8' }] },
      { id: 'b', title: 'Upper A', exercises: [{ name: 'Bench Press', sets: 3, reps: '8' }] },
      { id: 'c', title: 'Lower B', exercises: [{ name: 'Hip Thrust', sets: 3, reps: '10' }] },
    ],
  };
  const w = (id: string, title: string, d: number) => ({ id, title, startedAt: at(d), finishedAt: at(d - 0.04), exercises: [] });
  await seed(
    { splits: [split], activeSplitId: 'sp1', workouts: [w('w2', 'Upper A', 2), w('w1', 'Lower A', 4), w('w0', 'Upper A', 20)] },
    '/train',
  );
  await expect(page.getByText('Lower B', { exact: true })).toBeVisible();
});

test('build your own split with a workout', async ({ page, seed, store }) => {
  await seed({}, '/split-new');
  await page.getByText('Build your own', { exact: true }).click();
  await page.getByPlaceholder('e.g. My 5-day split').fill('My Mon/Thu');
  await page.getByText('Create split').click();
  await page.getByText('Add a workout').click();
  await page.getByPlaceholder('e.g. Lower A').fill('Legs');
  await page.getByPlaceholder('Add an exercise (search)').fill('romanian');
  await page
    .getByText(/^Romanian Deadlift$/)
    .first()
    .click();
  await page.getByText('Save workout').click();
  await expect
    .poll(async () => (await store()).splits.find((x: any) => x.name === 'My Mon/Thu')?.workouts[0]?.exercises[0]?.name)
    .toBe('Romanian Deadlift');
});

test('lift target: start filled from the log, stored in kg, on track at baseline', async ({ page, seed, store }) => {
  await seed({ workouts: [logged] }, '/target-new');
  await page.getByText('Lift', { exact: true }).click();
  await page.getByPlaceholder('Search, e.g. hip thrust').fill('hip thr');
  await page.getByText('Hip Thrust', { exact: true }).first().click();
  await expect(page.locator('input').nth(1)).toHaveValue('135');
  await page.getByPlaceholder('—').last().fill('155');
  await page.getByText('8 weeks', { exact: true }).click();
  await page.getByText('Create target').click();
  await expect(page.getByText('Build my plan')).toBeVisible();
  await expect(page.getByText('On track')).toBeVisible();
  const t = (await store()).targets[0];
  expect(t.kind).toBe('lift');
  expect(t.startValue).toBeCloseTo(lb(135), 3);
  expect(t.targetValue).toBeCloseTo(lb(155), 3);
});

test('custom target: check-in moves progress; editing keeps history and retitles', async ({ page, seed, store }) => {
  await seed({}, '/target-new');
  await page.getByText('Something else', { exact: true }).click();
  await page.getByPlaceholder('e.g. pull-ups, minutes plank').fill('pull-ups');
  const nums = page.locator('input[inputmode="decimal"]').filter({ visible: true });
  await nums.nth(0).fill('2');
  await nums.nth(1).fill('8');
  await page.getByText('Create target').click();
  await expect(page.getByText('Save check-in')).toBeVisible();
  await page.getByPlaceholder('—').filter({ visible: true }).last().fill('4');
  await page.getByText('Save check-in').click();
  await expect(page.getByText('33% of the way')).toBeVisible();
  let t = (await store()).targets[0];
  expect(t.title).toBe('8 pull-ups');
  await page.goto('/target-new?id=' + t.id);
  await expect(page.getByText('Save changes')).toBeVisible();
  await page.locator('input[inputmode="decimal"]').filter({ visible: true }).nth(1).fill('10');
  await page.getByText('Save changes').click();
  await expect.poll(async () => (await store()).targets[0].targetValue).toBe(10);
  t = (await store()).targets[0];
  expect(t.history).toHaveLength(1);
  expect(t.title).toBe('10 pull-ups');
  await page.goto('/progress');
  await expect(page.getByText('10 pull-ups', { exact: true }).filter({ visible: true })).toBeVisible();
});

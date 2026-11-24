import { expect, mockState, test } from './support/fixtures';

test.describe('accounts', () => {
  test('a new person signs up, picks a username, onboards, and their profile is backed up', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByText('Create an account to get started')).toBeVisible();
    await page.getByPlaceholder('you@example.com').fill('new@example.com');
    await page.getByPlaceholder('At least 8 characters').fill('secret123');
    await page.getByRole('checkbox', { name: /Terms of Use/ }).click();
    await page.getByRole('checkbox', { name: /health and fitness data/ }).click();
    await page.getByText('Create account').last().click();
    await expect(page.getByText('Pick your @username')).toBeVisible();
    await page.getByPlaceholder('kelly', { exact: true }).fill('newbie');
    await page.getByPlaceholder('Kelly', { exact: true }).fill('Newbie');
    await page.getByText('Save').last().click();
    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByText('Continue').click();
    await page.getByText('Get stronger').click();
    for (let i = 0; i < 3; i++) await page.getByText('Continue').click();
    await page.getByText('Enter rep.').click();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(async () => Object.values((await mockState()).userData).some((u: any) => u.profile?.name === 'Newbie'), { timeout: 15_000 })
      .toBe(true);
  });

  test('signing in on a new phone restores profile, body log and custom exercises', async ({ page, store }) => {
    await page.goto('/welcome');
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.getByPlaceholder('you@example.com').fill('kelly@example.com');
    await page.getByPlaceholder('Your password').fill('secret123');
    await page.getByText('Sign in', { exact: true }).last().click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(async () => (await store()).profile?.name).toBe('Kelly R');
    const s = await store();
    expect(s.profile.stepGoal).toBe(9000);
    expect(s.body).toHaveLength(1);
    expect(s.body[0].weightKg).toBe(64.5);
    expect(s.customExercises.some((e: any) => e.name === 'Banded Walk')).toBe(true);
  });

  test('a different person on the same phone starts clean', async ({ page, store }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem(
        'rep-store-v1',
        JSON.stringify({
          state: {
            onboarded: true,
            units: 'metric',
            dataOwner: 'uOther',
            profile: { name: 'Other', goals: [], experience: 'beginner', daysPerWeek: 3, stepGoal: 8000, equipment: '', notes: '' },
            workouts: [
              { id: 'wX', title: 'Not yours', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), exercises: [] },
            ],
            body: [{ id: 'bX', date: '2026-11-01', weightKg: 99 }],
            health: {},
            coach: [],
            pendingDeletes: [],
            pendingBodyDeletes: [],
            customExercises: [],
            server: { url: '', token: '' },
          },
          version: 0,
        }),
      ),
    );
    await page.goto('/welcome');
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.getByPlaceholder('you@example.com').fill('kelly@example.com');
    await page.getByPlaceholder('Your password').fill('secret123');
    await page.getByText('Sign in', { exact: true }).last().click();
    await expect.poll(async () => (await store()).profile?.name).toBe('Kelly R');
    const s = await store();
    expect(s.workouts.some((w: any) => w.id === 'wX')).toBe(false);
    expect(s.body.some((b: any) => b.id === 'bX')).toBe(false);
    expect(s.units).toBe('us');
  });

  test('signing out clears the phone and returns to welcome', async ({ page, seed, store }) => {
    await seed(
      { workouts: [{ id: 'w1', title: 'Legs', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), exercises: [] }] },
      '/account',
    );
    await page.getByText('Sign out', { exact: true }).last().click();
    await expect(page).toHaveURL(/\/welcome$/);
    const s = await store();
    expect(s.account).toBeFalsy();
    expect(s.workouts ?? []).toHaveLength(0);
  });
});

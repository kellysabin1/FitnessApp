import { readFileSync } from 'node:fs';

import { ALL_CONSENTS, expect, mockState, test } from './support/fixtures';

const kinds = async () => (await mockState()).consents.filter((c: any) => c.user_id === 'uA').map((c: any) => `${c.kind}:${c.granted}`);

test('privacy policy and terms are readable before signing in', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText('The short version')).toBeVisible();
  await expect(page.getByText('Consumer health data')).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByText('Not medical advice', { exact: true })).toBeVisible();
});

test('sign-up needs both agreements, and they are saved to the account once it exists', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByPlaceholder('you@example.com').fill('new@example.com');
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  const create = page.getByRole('button', { name: 'Create account' });
  await expect(create).toBeDisabled();
  await page.getByRole('checkbox', { name: /Terms of Use/ }).click();
  await expect(create).toBeDisabled(); // health-data consent is separate and also required
  await page.getByRole('checkbox', { name: /health and fitness data/ }).click();
  await expect(create).toBeEnabled();
  await create.click();
  await page.getByPlaceholder('kelly', { exact: true }).fill('newbie');
  await page.getByPlaceholder('Kelly', { exact: true }).fill('Newbie');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () =>
      (await mockState()).consents
        .filter((c: any) => c.user_id.startsWith('uN'))
        .map((c: any) => c.kind)
        .sort(),
    )
    .toEqual(['health_data', 'terms_privacy']);
});

test('consent screen blocks the app until both boxes are ticked', async ({ page, seed, store }) => {
  // an account with no consent records anywhere
  await seed({ consents: {}, account: { userId: 'uA', email: 'kelly@example.com', username: 'kelly', displayName: 'Kelly' } }, '/consent');
  await page.route('**/rest/v1/consents*', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.continue()));
  await page.goto('/');
  await expect(page).toHaveURL(/\/consent$/);
  const go = page.getByRole('button', { name: 'Continue' });
  await expect(go).toBeDisabled();
  await page.getByRole('checkbox', { name: /Terms of Use/ }).click();
  await page.getByRole('checkbox', { name: /health and fitness data/ }).click();
  await go.click();
  await expect(page).toHaveURL(/\/$/);
  expect(Object.keys((await store()).consents).sort()).toEqual(['health_data', 'terms_privacy']);
});

test('AI coach asks first, lists what it sends, and can be turned off', async ({ page, seed }) => {
  await seed({}, '/coach');
  await expect(page.getByText('What the coach uses')).toBeVisible();
  await expect(page.getByText(/Anthropic’s Claude AI/)).toBeVisible();
  await page.getByRole('button', { name: 'Allow the AI coach' }).click();
  await expect(page.getByText('What the coach uses')).toHaveCount(0);
  await expect.poll(kinds).toContain('ai_coach:true');

  await page.goto('/your-data');
  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByText('AI coach turned off. Nothing more is sent to Anthropic.')).toBeVisible();
  await expect.poll(kinds).toContain('ai_coach:false');
  await page.goto('/coach');
  await expect(page.getByText('What the coach uses')).toBeVisible();
});

test('download my data: a JSON file with account, cloud and phone data', async ({ page, seed }) => {
  await seed({ consents: ALL_CONSENTS, coach: [{ id: 'm1', role: 'user', text: 'hi', at: new Date().toISOString() }] }, '/your-data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download my data' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^rep-data-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(readFileSync((await file.path())!, 'utf8'));
  expect(data).toMatchObject({ format: 'rep-export', version: 1, account: { userId: 'uA', username: 'kelly' } });
  expect(data.cloud.bodyEntries[0].weight_kg).toBe(64.5);
  expect(data.cloud.consents.length).toBeGreaterThanOrEqual(2);
  expect(data.thisPhone.coachChat[0].text).toBe('hi');
  expect(JSON.stringify(data)).not.toContain('p256dh'); // notification keys are never exported
});

test('delete my account: wrong password is refused, right one deletes and signs out', async ({ page, seed, store }) => {
  await seed(
    { workouts: [{ id: 'w1', title: 'Legs', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), exercises: [] }] },
    '/your-data',
  );
  await page.getByRole('button', { name: 'Delete my account…' }).click();
  const confirm = page.getByRole('button', { name: 'Permanently delete my account' });
  await page.getByLabel('Your password').fill('wrong-password');
  await expect(confirm).toBeDisabled(); // must also type DELETE
  await page.getByPlaceholder('DELETE').fill('DELETE');
  await confirm.click();
  await expect(page.getByText('That password isn’t right.')).toBeVisible();
  expect((await mockState()).deleted).toEqual([]);

  await page.getByLabel('Your password').fill('secret123');
  await confirm.click();
  await expect(page).toHaveURL(/\/welcome$/);
  expect((await mockState()).deleted).toEqual(['uA']);
  const s = await store();
  expect(s.account).toBeFalsy();
  expect(s.workouts ?? []).toHaveLength(0);
});

test('invite links show what is shared and wait for a tap before joining', async ({ page, seed }) => {
  await seed({}, '/join/ABC123');
  await expect(page.getByText(/Members will see your workouts/)).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await mockState()).joined).toEqual([]); // nothing happened on its own
  await page.getByRole('button', { name: 'Join challenge' }).click();
  await expect(page).toHaveURL(/\/challenge\/c1$/);
  const st = await mockState();
  expect(st.joined).toEqual(['ABC123']);
  expect(st.consents.some((c: any) => c.kind === 'challenge_sharing' && c.context === 'join:ABC123')).toBe(true);
});

test('the health data policy is linked from the start screen and readable signed out', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByText('Consumer Health Data Privacy Policy', { exact: true }).first().click();
  await expect(page.getByText('Health data we collect')).toBeVisible();
  await expect(page.getByText('Who we share it with')).toBeVisible();
  await expect(page.getByText(/We answer within 45 days/).first()).toBeVisible();
});

test('a reset link that is expired or broken explains what to do and clears the address bar', async ({ page }) => {
  await page.goto('/reset-password#error=access_denied&error_code=otp_expired');
  await expect(page.getByText(/This reset link has expired/)).toBeVisible();
  expect(page.url()).not.toContain('error=');
  await page.goto('/reset-password');
  await expect(page.getByText(/This reset link has expired/)).toBeVisible();
});

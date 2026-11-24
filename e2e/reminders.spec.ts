import { dayKey, expect, mockState, test } from './support/fixtures';

test('reminder time and push/email settings are saved to the account', async ({ page, seed }) => {
  await seed({}, '/reminders');
  await expect(page.getByText('8:00 pm')).toBeVisible();
  await page.getByLabel('30 minutes later').click();
  await expect(page.getByText('8:30 pm')).toBeVisible();
  await expect.poll(async () => (await mockState()).reminders.uA?.remind_at).toBe('20:30');
  expect((await mockState()).reminders.uA.tz).toBeTruthy();
  await expect(page.getByText('Email reminders are coming soon — push works now.')).toBeVisible();
  await page.goto('/you');
  await expect(page.getByText('Workout reminders')).toBeVisible();
});

test('rest day on Today skips tonight and can be undone', async ({ page, seed, store }) => {
  await seed({}, '/');
  await page.getByText('Rest day today', { exact: true }).click();
  await expect(page.getByText('Rest day — no reminder tonight.')).toBeVisible();
  await expect.poll(async () => (await mockState()).reminders.uA?.rest_day).toBe(dayKey());
  expect((await store()).restDay).toBe(dayKey());
  await page.getByText('Undo', { exact: true }).click();
  await expect(page.getByText('Rest day today', { exact: true })).toBeVisible();
  await expect.poll(async () => (await mockState()).reminders.uA?.rest_day).toBeNull();
});

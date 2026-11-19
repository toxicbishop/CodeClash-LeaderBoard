import { expect, test } from '@playwright/test';

test('competition administrators can sign in and reach their dashboard', async ({ page }) => {
  const email = process.env.COMPETITION_ADMIN_EMAIL;
  const password = process.env.COMPETITION_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set the test administrator credentials before running this test.');

  await page.goto('/admin');
  await expect(page).toHaveURL('/');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/admin');
  await expect(page.getByRole('heading', { name: 'Competition Overview' })).toBeVisible();

  await page.goto('/');
  await expect(page).toHaveURL('/admin');
});

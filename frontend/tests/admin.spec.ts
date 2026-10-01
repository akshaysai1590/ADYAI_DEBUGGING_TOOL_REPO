import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test('Admin can log in and view the dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByPlaceholder('Admin Password').fill('adhyant2026');
    await page.getByRole('button', { name: 'Enter Admin Dashboard' }).click();

    // Verify successful login
    await expect(page.getByText('Adhyant Admin')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rounds' })).toBeVisible();
  });

  test('Admin can navigate through all tabs seamlessly', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByPlaceholder('Admin Password').fill('adhyant2026');
    await page.getByRole('button', { name: 'Enter Admin Dashboard' }).click();

    // Navigate tabs
    await page.getByRole('button', { name: /Questions/ }).click();
    await expect(page.getByText('Questions in this round').or(page.getByText('No questions yet'))).toBeAttached();

    await page.getByRole('button', { name: /Teams/ }).click();
    await expect(page.getByText('Add Single Team')).toBeVisible();
    await expect(page.getByText('Bulk Generate Teams')).toBeVisible();

    await page.getByRole('button', { name: /Live Monitor/ }).click();
    await expect(page.getByText('Total Violations')).toBeVisible();

    await page.getByRole('button', { name: /Scoreboard/ }).click();
    await expect(page.getByText('🏆 Live Standings')).toBeVisible();
  });
});

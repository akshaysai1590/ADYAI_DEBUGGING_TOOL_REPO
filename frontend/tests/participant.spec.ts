import { test, expect } from '@playwright/test';

test.describe('Participant Flow', () => {
  test('Participant can log in with demo credentials and reach the lobby', async ({ page }) => {
    await page.goto('/join');
    
    await expect(page.getByRole('heading', { name: 'Adhyant Debugging' })).toBeVisible();

    await page.getByPlaceholder('e.g. DBG42 or DBG01').fill('DEMO99');
    await page.getByPlaceholder('4-digit PIN').fill('1234');
    await page.getByPlaceholder('e.g. Team Alpha').fill('Test Team');
    
    await page.getByRole('button', { name: 'Enter Contest Lobby' }).click();

    // Verify successful login to lobby
    await expect(page).toHaveURL(/.*\/lobby/);
    await expect(page.getByText('Team: Test Team')).toBeVisible();
    await expect(page.getByText('DEMO99')).toBeVisible();
  });

  test('Participant can see the language picker when entering contest', async ({ page }) => {
    // 1. Log in
    await page.goto('/join');
    await page.getByPlaceholder('e.g. DBG42 or DBG01').fill('DEMO99');
    await page.getByPlaceholder('4-digit PIN').fill('1234');
    await page.getByRole('button', { name: 'Enter Contest Lobby' }).click();
    await expect(page).toHaveURL(/.*\/lobby/);

    // 2. Bypass wait (we assume they can click Enter Contest or we navigate directly since active round might be needed)
    // To properly test the language picker, we navigate directly to contest
    await page.goto('/contest');

    // 3. Language picker should be visible
    await expect(page.getByText('Choose Your Language')).toBeVisible();
    await expect(page.getByText('This choice is final and cannot be changed once the round begins.')).toBeVisible();

    // Select language
    await page.getByRole('button', { name: 'Python' }).click();
    // The test logic assumed there was a "Confirm & Enter Sandbox" button.
    // In Contest.tsx, clicking the language icon button directly calls confirmLanguage.
    // There is no separate "Confirm" button. Wait for the language picker to disappear.
    await expect(page.getByText('Choose Your Language')).not.toBeVisible();
    // Assuming there is some element in the contest page we can assert on
    await expect(page.getByRole('button', { name: /Run Code/ })).toBeVisible();
  });
});

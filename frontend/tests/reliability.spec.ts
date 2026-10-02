import { test, expect } from '@playwright/test';

// Event-day reliability regressions. Run them in the pre-event dry-run
// against a seeded backend (dev server on :5173 + Supabase):
//   E2E_TEAM_ID=DBG01 E2E_TEAM_PIN=<pin> npx playwright test tests/reliability.spec.ts
const TEAM_ID = process.env.E2E_TEAM_ID ?? 'DEMO99';
const TEAM_PIN = process.env.E2E_TEAM_PIN ?? '1234';
test.describe('Event-day reliability', () => {
  test('Refresh keeps the session (no silent logout)', async ({ page }) => {
    await page.goto('/join');
    await page.getByPlaceholder('e.g. DBG42 or DBG01').fill(TEAM_ID);
    await page.getByPlaceholder('4-digit PIN').fill(TEAM_PIN);
    await page.getByRole('button', { name: 'Enter Contest Lobby' }).click();
    await expect(page).toHaveURL(/.*\/lobby/);

    await page.reload();
    // Must stay in the lobby — a bounce back to /join means the persisted
    // auth store (teamDbId / sessionToken) was lost on refresh.
    await expect(page).toHaveURL(/.*\/lobby/, { timeout: 15000 });
    await expect(page.getByText(TEAM_ID)).toBeVisible();
  });

  test('Language choice survives refresh (no re-picker loop)', async ({ page }) => {
    await page.goto('/join');
    await page.getByPlaceholder('e.g. DBG42 or DBG01').fill(TEAM_ID);
    await page.getByPlaceholder('4-digit PIN').fill(TEAM_PIN);
    await page.getByRole('button', { name: 'Enter Contest Lobby' }).click();
    await expect(page).toHaveURL(/.*\/lobby/);

    await page.goto('/contest');
    await page.getByRole('button', { name: 'Python' }).click();
    await expect(page.getByText('Choose Your Language')).not.toBeVisible();

    await page.reload();
    // Picker must not come back: selectedLanguage is persisted. Either the
    // editor (Run Code) or the lobby redirect may show, depending on whether
    // a round is active — but never the language picker again.
    await expect(page.getByText('Choose Your Language')).toBeHidden({ timeout: 15000 });
  });

  test('Lobby shows live online-team count, not a frozen total', async ({ page }) => {
    await page.goto('/join');
    await page.getByPlaceholder('e.g. DBG42 or DBG01').fill(TEAM_ID);
    await page.getByPlaceholder('4-digit PIN').fill(TEAM_PIN);
    await page.getByRole('button', { name: 'Enter Contest Lobby' }).click();
    await expect(page).toHaveURL(/.*\/lobby/);

    // Guards the polling fix: the label must reflect online teams and the
    // value must be a rendered number (updated on a 10s poll, not realtime).
    await expect(page.getByText('Teams online now')).toBeVisible();
    const count = page.locator('div.card div', { hasText: /^[0-9]+$/ });
    await expect(count.first()).toBeVisible();
  });
});

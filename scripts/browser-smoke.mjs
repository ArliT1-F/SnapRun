import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  ...(process.env.CHROMIUM_ARGS ? { args: process.env.CHROMIUM_ARGS.split(' ') } : {}),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.addInitScript(() => {
  window.open = (url) => {
    window.__snaprunOpenedUrl = String(url);
    return {};
  };
});
const email = `smoke-${Date.now()}@example.test`;
const password = 'browser-smoke-companion-password';
let accountCreated = false;
let signedIn = false;
const button = (name) => page.getByRole('button', { name, exact: true });
const waitForText = async (text) =>
  page.getByText(text, { exact: true }).first().waitFor({ timeout: 10000 });
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await waitForText('Your space, in sync.');
  await button('I already have an account').click();
  await waitForText('Continue on Snapchat.');
  assert.equal(
    await page.locator('dialog input[type="password"]').count(),
    0,
    'Snapchat handoff must never collect a password',
  );
  await button('Close dialog').click();
  await button('Create a Snapchat account').click();
  await waitForText('Start your Snapchat story.');
  assert.equal(await page.locator('dialog input[type="password"]').count(), 0);
  assert.equal(
    await page
      .locator('dialog')
      .getByRole('button', { name: /Snapchat’s official account-creation guide/ })
      .count(),
    1,
  );
  await button('Close dialog').click();
  await page.getByRole('link', { name: 'Contacts', exact: true }).click();
  await button('Add your first contact').click();
  await page.getByLabel('Display name').fill('Guest Contact');
  await page.getByLabel('Snapchat username').fill('guest.contact');
  await page.getByLabel('Private notes').fill('A local-only note');
  await page.locator('dialog').getByRole('button', { name: 'Add contact', exact: true }).click();
  await waitForText('Guest Contact');
  await page.getByLabel('Search contacts').fill('no-match');
  await waitForText('No one by that name. Yet.');
  await button('Clear filters').click();
  await button('Sign in').click();
  await button('Create an account').click();
  await page.getByLabel('Your name').fill('Smoke Tester');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Companion password', { exact: true }).fill(password);
  await button('Create companion account').click();
  await page.locator('dialog').waitFor({ state: 'detached' });
  accountCreated = true;
  signedIn = true;
  await waitForText('Good company starts here.');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await button('Contact labels').click();
  await page.getByLabel('Label name').fill('Close friends');
  await button('Add label').click();
  await page.locator('.labels-list').getByText('Close friends', { exact: true }).waitFor();
  await button('Appearance').click();
  await button('Daylight Light theme').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.getByRole('link', { name: 'Contacts', exact: true }).click();
  await button('Add your first contact').click();
  await page.getByLabel('Display name').fill('Synced Contact');
  await page.getByLabel('Snapchat username').fill('synced.contact');
  await page.getByLabel('Private notes').fill('Encrypted server-backed note');
  await page.locator('dialog').getByRole('button', { name: 'Close friends', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Add contact', exact: true }).click();
  await waitForText('Synced Contact');
  await page.reload({ waitUntil: 'networkidle' });
  await waitForText('Synced Contact');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await button('Privacy & security').click();
  await page.getByRole('switch', { name: 'Privacy Mode', exact: true }).click();
  await page.getByRole('switch', { name: 'Privacy Mode', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('switch', { name: 'Privacy Mode', exact: true })
      .getAttribute('aria-checked'),
    'true',
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('snaprun.preferences')),
    null,
    'Privacy Mode must remove the local preference cache',
  );
  await button('Wipe local data').click();
  await page
    .locator('dialog')
    .getByRole('button', { name: 'Wipe this device', exact: true })
    .click();
  await page.locator('dialog').waitFor({ state: 'detached' });
  signedIn = false;
  assert.equal(await page.evaluate(() => localStorage.getItem('snaprun.preferences')), null);
  await waitForText('Session-only preferences');
  const relogin = await page.request.post(`${base}/api/auth/login`, {
    headers: { Origin: base },
    data: { email, password },
  });
  assert.equal(relogin.ok(), true, 'Smoke account must remain deletable after local wipe');
  signedIn = true;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => localStorage.getItem('snaprun.preferences')), null);
  await page
    .getByRole('link', { name: /Notifications/ })
    .first()
    .click();
  await button('Mark all as read').click();
  await button('Unread 0').click();
  await waitForText('All caught up.');
  await page.getByRole('link', { name: 'Messages', exact: true }).click();
  await button('Connect to Snapchat').click();
  await button('Open Snapchat Web').click();
  await button('I signed in on Snapchat').waitFor();
  assert.equal(await page.evaluate(() => window.__snaprunOpenedUrl), 'https://web.snapchat.com/');
  await button('I signed in on Snapchat').click();
  await page.locator('dialog').waitFor({ state: 'detached' });
  await page.getByText('Signed in · self-reported', { exact: true }).first().waitFor();
  await waitForText('Not available');
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search pages and contacts').fill('Synced');
  await page
    .locator('dialog')
    .getByRole('button', { name: /Synced Contact/ })
    .click();
  await waitForText('Synced Contact');
  await page.setViewportSize({ width: 390, height: 844 });
  await button('Open navigation').click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await waitForText('Welcome back, Smoke.');
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'Mobile layout must not overflow horizontally',
  );
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log(
    'Browser smoke passed: onboarding, guest contacts, registration, labels, themes, persistence, Privacy Mode, local wipe, notifications, honest handoff, command search and mobile layout.',
  );
} finally {
  if (accountCreated) {
    if (!signedIn)
      await page.request.post(`${base}/api/auth/login`, {
        headers: { Origin: base },
        data: { email, password },
      });
    await page.request.delete(`${base}/api/account`, {
      headers: { Origin: base },
      data: { password, confirmation: 'DELETE' },
    });
  }
  await browser.close();
}

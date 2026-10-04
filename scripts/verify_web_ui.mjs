#!/usr/bin/env node
// Verify only against a disposable, seeded local simulator.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const modulePath = arg('--playwright-module', 'playwright');
const { chromium } = await import(modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath);
const output = resolve(arg('--output', '/tmp/bettermate-web-checks'));
const base = arg('--url', 'http://127.0.0.1:5173/');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], checks = [];
const check = (condition, label) => { assert(condition, label); checks.push(label); };
const watch = page => page.on('pageerror', error => errors.push({ url: page.url(), error: error.stack || String(error) }));
const waitFor = locator => locator.waitFor({ timeout: 20000 });
const capture = async (page, name) => {
  await page.evaluate(async () => { await document.fonts.load('15px "Space Grotesk"'); await document.fonts.load('14px "JetBrains Mono"'); await document.fonts.ready; });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  await writeFile(`${output}/${name}.txt`, await page.locator('body').ariaSnapshot());
};
const navigate = async (page, route, heading) => {
  await page.goto(new URL(route, base).href);
  await waitFor(page.getByRole('heading', { name: heading, exact: true }));
  await page.evaluate(() => document.fonts.ready);
};
const validate = async (page, name) => {
  const r = await page.evaluate(() => {
    const visible = e => e.getBoundingClientRect().width && e.getBoundingClientRect().height && getComputedStyle(e).visibility !== 'hidden';
    const icons = [...document.querySelectorAll('.bm-icon')].filter(visible);
    const cards = [...document.querySelectorAll('.card, .app-card-surface')].filter(visible);
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      icons: icons.length,
      badIcons: icons.filter(e => { const s = getComputedStyle(e); return Number.parseFloat(s.width) !== 24 || Number.parseFloat(s.height) !== 24; }).map(e => ({ name: e.getAttribute('data-icon'), width: getComputedStyle(e).width, height: getComputedStyle(e).height })),
      effects: cards.filter(e => getComputedStyle(e).boxShadow !== 'none' || getComputedStyle(e).backdropFilter !== 'none').length,
      font: getComputedStyle(document.body).fontFamily,
      fontsLoaded: document.fonts.check('15px "Space Grotesk"') && document.fonts.check('14px "JetBrains Mono"'),
    };
  });
  check(!(await page.locator('body').innerText()).includes('NaN'), `${name}: no invalid readings`);
  check(!r.overflow, `${name}: no page overflow`);
  check(r.icons > 0 && r.badIcons.length === 0, `${name}: native 24px icons ${JSON.stringify(r.badIcons)}`);
  check(r.effects === 0, `${name}: flat card surfaces`);
  check(r.font.includes('Space Grotesk') && r.fontsLoaded, `${name}: both fonts loaded ${r.font}, ${r.fontsLoaded}`);
};
const mode = async (page, name) => {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForFunction(label => [...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === label && b.getAttribute('aria-pressed') === 'true'), name);
  check(true, `${name}: mode acknowledged`);
};
const routes = [
  ['profiles', 'Profiles'], ['profiles/first', 'Edit First'], ['settings', 'Settings'],
  ['history', 'Shot History'], ['analyzer', 'Deep Dive Shot Analyzer'],
  ['statistics', 'Statistics'], ['dashboard-settings', 'Dashboard Settings'],
];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const page = await context.newPage(); watch(page);
  await page.goto(base);
  await waitFor(page.getByRole('button', { name: 'Brew', exact: true })); await waitFor(page.getByText('93°C', { exact: true }).first());
  await mode(page, 'Brew');
  await capture(page, 'dashboard-light'); await validate(page, 'dashboard-light');
  check((await page.title()).includes('BetterMate'), 'BetterMate document title');
  const temp = page.getByRole('button', { name: 'Increase temp target' }).first();
  const before = await temp.evaluate(b => b.parentElement.textContent);
  await temp.click();
  await page.waitForFunction(previous => document.querySelector('button[aria-label="Increase temp target"]')?.parentElement.textContent !== previous, before);
  check(await temp.evaluate(b => b.parentElement.textContent) !== before, 'Temperature adjustment acknowledged');
  await page.getByRole('button', { name: 'Decrease temp target' }).first().click();
  await mode(page, 'Steam');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('button[aria-label="Steam"]')).backgroundColor === 'rgb(232, 68, 10)');
  check(await page.getByRole('button', { name: 'Steam', exact: true }).evaluate(b => getComputedStyle(b).backgroundColor) === 'rgb(232, 68, 10)', 'Steam uses heat color');
  await capture(page, 'steam-light');
  for (const name of ['Water', 'Grind']) {
    await mode(page, name);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await waitFor(page.getByRole('button', { name: 'Pause', exact: true }));
    check(true, `${name}: starts through simulator API`);
    await capture(page, `${name.toLowerCase()}-active`);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Pause"]'));
    const finish = page.getByRole('button', { name: 'Finish', exact: true });
    if (await finish.count()) await finish.click();
    await waitFor(page.getByRole('button', { name: 'Start', exact: true }));
    check(true, `${name}: stops through simulator API`);
  }
  await mode(page, 'Brew');
  await page.getByRole('button', { name: 'Dashboard view' }).click();
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  const first = page.getByRole('button', { name: /^First/ }); await waitFor(first); await first.click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.startsWith('First') && b.getAttribute('aria-pressed') === 'true'));
  check(true, 'Favorite selection acknowledged');
  await capture(page, 'dashboard-advanced'); await validate(page, 'dashboard-advanced');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Start anyway' }).click();
  await waitFor(page.getByRole('button', { name: 'Pause', exact: true }));
  check(true, 'Brew starts with warning confirmation'); await capture(page, 'brew-active');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Pause"]'));
  const brewFinish = page.getByRole('button', { name: 'Finish', exact: true });
  if (await brewFinish.count()) await brewFinish.click();
  await waitFor(page.getByRole('button', { name: 'Start', exact: true })); check(true, 'Brew stops and clears');
  for (const [route, heading] of routes) {
    await navigate(page, route, heading);
    if (route === 'profiles') await waitFor(page.getByRole('link', { name: 'Edit First profile' }));
    if (route === 'settings') await waitFor(page.getByRole('combobox', { name: 'Theme', exact: true }));
    if (route === 'history') await waitFor(page.getByRole('link', { name: 'Open in Analyzer' }).first());
    const name = route.replaceAll('/', '-'); await capture(page, name); await validate(page, name);
  }
  await navigate(page, 'history', 'Shot History');
  await page.getByRole('link', { name: 'Open in Analyzer' }).first().click();
  await waitFor(page.locator('canvas').first()); await capture(page, 'analyzer-loaded'); await validate(page, 'analyzer-loaded');
  await navigate(page, 'statistics', 'Statistics');
  await page.getByRole('button', { name: 'Play statistics' }).click();
  await waitFor(page.getByText('Total Shots', { exact: true }));
  await capture(page, 'statistics-built'); await validate(page, 'statistics-built');
  await navigate(page, 'settings', 'Settings');
  const themes = page.getByRole('combobox', { name: 'Theme', exact: true }); await waitFor(themes);
  check(JSON.stringify(await themes.locator('option').allTextContents()) === JSON.stringify(['System', 'Light', 'Dark']), 'Only system/light/dark offered');
  await themes.selectOption('dark'); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  check(await page.evaluate(() => localStorage.getItem('gaggimate-daisyui-theme')) === 'dark', 'Theme storage key retained');
  await capture(page, 'settings-dark');
  for (const tab of ['machine', 'calibration', 'plugins', 'bluetooth', 'system']) {
    await navigate(page, `settings/${tab}`, 'Settings');
    await page.locator('[role="tab"][aria-selected="true"]').waitFor();
    await capture(page, `settings-${tab}`); await validate(page, `settings-${tab}`);
  }
  for (const [route, heading] of routes.filter(([r]) => r !== 'settings' && r !== 'profiles/first')) {
    await navigate(page, route, heading); await capture(page, `${route}-dark`); await validate(page, `${route}-dark`);
  }
  await page.goto(base); await waitFor(page.getByRole('button', { name: 'Brew', exact: true })); await waitFor(page.getByText('93°C', { exact: true }).first());
  await capture(page, 'dashboard-dark'); await validate(page, 'dashboard-dark');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await mobile.addInitScript(() => localStorage.setItem('gaggimate.desktopNavCollapsed', 'true'));
  const phone = await mobile.newPage(); watch(phone);
  await phone.goto(base); await waitFor(phone.getByRole('button', { name: 'Brew', exact: true })); await waitFor(phone.getByText('93°C', { exact: true }).first());
  await capture(phone, 'phone-dashboard'); await validate(phone, 'phone-dashboard');
  await phone.getByRole('button', { name: 'Open navigation' }).click();
  await waitFor(phone.getByRole('link', { name: 'Profiles', exact: true })); await capture(phone, 'phone-navigation');
  await phone.getByRole('link', { name: 'Profiles', exact: true }).click();
  await waitFor(phone.getByRole('heading', { name: 'Profiles', exact: true })); await waitFor(phone.getByRole('button', { name: 'Open navigation' }));
  check(true, 'Phone navigation opens and closes after routing');
  for (const [route, heading] of routes.filter(([r]) => r !== 'dashboard-settings')) {
    await navigate(phone, route, heading);
    if (route === 'settings') await waitFor(phone.getByRole('combobox', { name: 'Theme', exact: true }));
    await capture(phone, `phone-${route.replaceAll('/', '-')}`); await validate(phone, `phone-${route}`);
  }
  await phone.setViewportSize({ width: 844, height: 390 }); await phone.goto(base);
  await waitFor(phone.getByRole('button', { name: 'Brew', exact: true })); await waitFor(phone.getByText('93°C', { exact: true }).first());
  await capture(phone, 'phone-landscape'); await validate(phone, 'phone-landscape'); await mobile.close();
  for (const [stored, expected] of [['coffee', 'dark'], ['nord', 'light'], ['system', 'dark']]) {
    const legacy = await browser.newContext({ colorScheme: 'dark' });
    await legacy.addInitScript(value => localStorage.setItem('gaggimate-daisyui-theme', value), stored);
    const tab = await legacy.newPage(); watch(tab); await tab.goto(base);
    await waitFor(tab.getByRole('button', { name: 'Brew', exact: true }));
    check(await tab.evaluate(() => document.documentElement.dataset.theme) === expected, `${stored}: resolves to ${expected}`);
    if (stored === 'system') {
      await tab.emulateMedia({ colorScheme: 'light' }); await tab.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      check(true, 'System theme responds to OS changes');
    }
    await legacy.close();
  }
  check(errors.length === 0, 'No browser runtime errors');
} catch (error) { errors.push({ verification: error.stack || String(error) }); process.exitCode = 1; }
finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ assertions: checks.length, checks, errors }, null, 2));
  console.log(JSON.stringify({ output, assertions: checks.length, errors })); await browser.close();
}

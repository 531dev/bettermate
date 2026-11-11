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
  await page.evaluate(async () => { await document.fonts.load('300 32px "Jost"'); await document.fonts.load('400 15px "Jost"'); await document.fonts.ready; });
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
      fontsLoaded: document.fonts.check('300 32px "Jost"') && document.fonts.check('400 15px "Jost"'),
    };
  });
  check(!(await page.locator('body').innerText()).includes('NaN'), `${name}: no invalid readings`);
  check(!r.overflow, `${name}: no page overflow`);
  check(r.icons > 0 && r.badIcons.length === 0, `${name}: native 24px icons ${JSON.stringify(r.badIcons)}`);
  check(r.effects === 0, `${name}: flat card surfaces`);
  check(r.font.includes('Jost') && r.fontsLoaded, `${name}: Jost light and regular loaded ${r.font}, ${r.fontsLoaded}`);
};
const mode = async (page, name) => {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForFunction(label => [...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === label && b.getAttribute('aria-pressed') === 'true'), name);
  check(true, `${name}: mode acknowledged`);
};
// The dial stays blank until telemetry arrives, so it is the signal to wait on.
const telemetry = page => page.waitForFunction(() => {
  const dial = document.querySelector('[aria-label="Live readings"]');
  return dial && !dial.innerText.includes('—');
}, null, { timeout: 20000 });
// Text inside the dial, and whether all of it fits inside the ring.
const dialText = page => page.locator('[aria-label="Live readings"]').innerText();
const dialFits = page => page.evaluate(() => {
  const center = document.querySelector('.bm-dial__center');
  return !center || (center.scrollHeight <= center.clientHeight + 1 && center.scrollWidth <= center.clientWidth + 1);
});
// Scrolls to the end of a page and reports whether its last card clears the floating bar.
const clearsDock = page => page.evaluate(() => {
  const main = document.querySelector('#main'), dock = document.querySelector('.bm-dock');
  main.scrollTop = main.scrollHeight;
  const cards = [...main.querySelectorAll('section, .card')].filter(e => e.getBoundingClientRect().height > 0);
  return !dock || cards.every(e => e.getBoundingClientRect().bottom <= dock.getBoundingClientRect().top);
});
// The dashboard view lives in Settings, so the menu only holds pages.
const setView = async (page, value) => {
  await navigate(page, 'settings', 'Settings');
  await page.getByRole('combobox', { name: 'Dashboard view', exact: true }).selectOption(value);
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
  await waitFor(page.getByRole('button', { name: 'Brew', exact: true }));
  await mode(page, 'Brew');
  await telemetry(page);
  await capture(page, 'dashboard-light'); await validate(page, 'dashboard-light');
  check((await page.title()).includes('BetterMate'), 'BetterMate document title');
  const readings = page.locator('[aria-label="Machine readings"]');
  check(await page.locator('[aria-label="Live chart"]').count() === 0, 'Simple has no chart between shots');
  check(!/flow|pump/i.test(await readings.innerText()), 'Simple leaves out readings that sit at zero between shots');
  check(!/target/i.test(await readings.innerText()), 'Simple readings do not repeat the target');
  check(!/temperature|pressure/i.test(await readings.innerText()), 'Temperature and pressure live on the dial, not again in the readings');
  check(await page.locator('[aria-label="Live readings"][data-rim="split"]').isVisible(), 'Brew: the dial rim carries temperature and pressure');
  check(/\d+°/.test(await dialText(page)) && /Boiler/.test(await dialText(page)), 'Brew: the dial reads the boiler temperature');
  check(await dialFits(page), 'Brew: dial text fits inside the ring');
  check(await page.locator('svg[aria-label^="Espresso machine"]').count() === 0, 'The machine drawing is gone');
  check(!(await page.getByRole('button', { name: 'Start shot', exact: true }).innerText()).includes('°'), 'Start shot does not repeat the temperature');
  check(await page.getByRole('button', { name: 'Flush water' }).isVisible(), 'Flush stays visible on the machine card');
  check(await page.locator('[aria-label="Shot setup"] [aria-label^="Increase temp"]').count() === 1, 'Profile and temperature share one setup group');
  check(JSON.stringify(await page.locator('.sidebar a.btn').allTextContents()) === JSON.stringify(['Dashboard', 'Profiles', 'History', 'Settings']), 'Menu holds the four pages of the daily routine');
  const dock = page.getByRole('navigation', { name: 'Machine mode' });
  check(JSON.stringify(await dock.getByRole('button').allTextContents()) === JSON.stringify(['Standby', 'Brew', 'Steam', 'Water', 'Grind']), 'Desktop floating bar holds the machine modes');
  check(await dock.getByRole('button').evaluateAll(items => items.every(b => b.getBoundingClientRect().height >= 44)), 'Desktop floating bar targets are at least 44 px');
  const dockBox = await dock.boundingBox(), content = await page.locator('#main').boundingBox();
  check(Math.abs(dockBox.x + dockBox.width / 2 - (content.x + content.width / 2)) <= 1, 'Desktop floating bar is centered on the content');
  check(dockBox.y + dockBox.height <= 1000 - 8 && dockBox.x > content.x, 'Desktop floating bar floats clear of the window edge and sidebar');
  check(await page.locator('.sidebar button[aria-label="Brew"]').isHidden(), 'Desktop sidebar leaves the modes to the floating bar');
  const temp = page.getByRole('button', { name: 'Increase temp target' }).first();
  const before = await temp.evaluate(b => b.parentElement.textContent);
  await temp.click();
  await page.waitForFunction(previous => document.querySelector('button[aria-label="Increase temp target"]')?.parentElement.textContent !== previous, before);
  check(await temp.evaluate(b => b.parentElement.textContent) !== before, 'Temperature adjustment acknowledged');
  await page.getByRole('button', { name: 'Decrease temp target' }).first().click();
  await mode(page, 'Steam');
  check(await page.getByRole('button', { name: 'Steam', exact: true }).evaluate(b => b.textContent.includes('Steam')), 'Steam has a visible label');
  check(!(await page.locator('[aria-label="Machine status"]').innerText()).includes('Flush recommended'), 'Steam leaves out the flush reminder');
  check(await page.locator('[aria-label="Live readings"][data-rim="temp"]').isVisible() && /Boiler/.test(await dialText(page)), 'Steam: one ring, reading the boiler');
  await capture(page, 'steam-light');
  for (const name of ['Water', 'Grind']) {
    await mode(page, name);
    const noun = name.toLowerCase();
    if (name === 'Grind') {
      await waitFor(page.getByRole('button', { name: 'Increase grind target' }));
      check(/Grind target/.test(await dialText(page)) && await page.locator('[aria-label="Live readings"][data-rim="progress"]').isVisible(), 'Grind: the dial shows the target on a progress ring');
      check(await dialFits(page), 'Grind: dial text fits inside the ring');
      const grindBefore = await dialText(page);
      await page.getByRole('button', { name: 'Increase grind target' }).click();
      await page.waitForFunction(previous => document.querySelector('[aria-label="Live readings"]').innerText !== previous, grindBefore);
      check(true, 'Grind: the target changes from the dial');
      await page.getByRole('button', { name: 'Decrease grind target' }).click();
    } else {
      check(/Boiler/.test(await dialText(page)), 'Water: the dial reads the boiler temperature');
    }
    await page.getByRole('button', { name: `Start ${noun}`, exact: true }).click();
    await waitFor(page.getByRole('button', { name: `Stop ${noun}`, exact: true }));
    check(true, `${name}: starts through simulator API`);
    if (name === 'Water') {
      check(!/\d:\d\d/.test(await dialText(page)) && /Boiler/.test(await dialText(page)), 'Water: the dial reads the boiler, with no timer the firmware does not report');
    } else {
      await page.waitForFunction(() => /\d:\d\d/.test(document.querySelector('[aria-label="Live readings"]').innerText) && /of \d/.test(document.querySelector('[aria-label="Live readings"]').innerText));
      check(true, 'Grind: the dial shows progress against the target');
    }
    await capture(page, `${name.toLowerCase()}-active`);
    await page.getByRole('button', { name: `Stop ${noun}`, exact: true }).click();
    await page.waitForFunction(label => !document.querySelector(`button[aria-label="${label}"]`), `Stop ${noun}`);
    const finish = page.getByRole('button', { name: 'Done', exact: true });
    if (await finish.count()) await finish.click();
    await waitFor(page.getByRole('button', { name: `Start ${noun}`, exact: true }));
    check(true, `${name}: stops through simulator API`);
  }
  await mode(page, 'Brew');
  await setView(page, 'advanced');
  await page.goto(base); await waitFor(page.locator('[aria-label="Machine status"]')); await telemetry(page);
  check(await page.locator('[aria-label="Live chart"]').isVisible(), 'Advanced keeps the live chart between shots');
  check(/flow/i.test(await readings.innerText()) && /target/i.test(await readings.innerText()), 'Advanced keeps every reading and its target');
  const first = page.getByRole('button', { name: /^First/ }); await waitFor(first); await first.click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.startsWith('First') && b.getAttribute('aria-pressed') === 'true'));
  check(true, 'Favorite selection acknowledged');
  await capture(page, 'dashboard-advanced'); await validate(page, 'dashboard-advanced');
  await page.getByRole('button', { name: 'Start shot', exact: true }).click();
  // The device's confirmation arrives asynchronously over WebSocket. Wait
  // for its authoritative outcome before deciding whether confirmation is needed.
  await waitFor(page.getByRole('button', { name: 'Stop shot', exact: true }).or(page.getByRole('button', { name: 'Start anyway', exact: true })));
  if (await page.getByRole('button', { name: 'Start anyway', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Start anyway', exact: true }).click();
  await waitFor(page.getByRole('button', { name: 'Stop shot', exact: true }));
  check(true, 'Brew starts with warning confirmation'); await capture(page, 'brew-active');
  // Every mode change stops the running process on the firmware, so the other modes lock during a shot.
  for (const name of ['Standby', 'Steam', 'Water', 'Grind']) check(await page.getByRole('button', { name, exact: true }).isDisabled(), `${name} locked during a shot`);
  check(await page.getByRole('button', { name: 'Brew', exact: true }).isEnabled(), 'Current mode stays enabled during a shot');
  await page.getByRole('button', { name: 'Stop shot', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Stop shot"]'));
  const brewFinish = page.getByRole('button', { name: 'Done', exact: true });
  if (await brewFinish.count()) await brewFinish.click();
  await waitFor(page.getByRole('button', { name: 'Start shot', exact: true })); check(true, 'Brew stops and clears');
  await waitFor(page.getByRole('button', { name: 'Steam', exact: true }).and(page.locator(':enabled')));
  check(true, 'Modes unlock when the shot ends');
  // Standby's next step is waking the machine, and the wake action really switches modes.
  await mode(page, 'Standby');
  check(/Boiler/.test(await dialText(page)) && !/Wakes/.test(await dialText(page)), 'Standby: the dial reads the boiler, with no wake time when none is set');
  await page.getByRole('button', { name: 'Wake machine', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="Brew"][aria-pressed="true"]'));
  check(true, 'Wake action switches Standby to Brew');
  // Leaving the machine dashboard must not lose the arranged panel layout.
  await setView(page, 'custom');
  await waitFor(page.getByRole('heading', { name: 'Dashboard Settings', exact: true }));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#main button[aria-label="Brew"]'));
  check(await page.locator('[aria-label="Machine status"]').count() === 0, 'Customize keeps the arranged panel layout');
  await page.evaluate(() => localStorage.setItem('dashboardMode', 'simple')); await page.goto(base);
  await waitFor(page.locator('[aria-label="Machine status"]'));
  check(true, 'Simple returns to the machine dashboard');
  await telemetry(page);
  await page.getByRole('button', { name: 'Start shot', exact: true }).click();
  await waitFor(page.getByRole('button', { name: 'Stop shot', exact: true }).or(page.getByRole('button', { name: 'Start anyway', exact: true })));
  if (await page.getByRole('button', { name: 'Start anyway', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Start anyway', exact: true }).click();
  await waitFor(page.getByRole('button', { name: 'Stop shot', exact: true }));
  await waitFor(page.locator('[aria-label="Live chart"]'));
  check(true, 'Simple charts a running shot');
  const shotDial = await dialText(page);
  check(/\d:\d\d/.test(shotDial) && /\d+°/.test(shotDial) && /bar/.test(shotDial), `Shot: the dial shows the timer, temperature and pressure (${shotDial.replaceAll('\n', ' ')})`);
  check(await dialFits(page), 'Shot: dial text fits inside the ring');
  check(/flow/i.test(await readings.innerText()), 'Readings add flow during a shot');
  check(await page.locator('[aria-label="Shot setup"]').count() === 0, 'Setup leaves the screen during a shot');
  await page.getByRole('button', { name: 'Stop shot', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Stop shot"]'));
  const simpleDone = page.getByRole('button', { name: 'Done', exact: true });
  if (await simpleDone.count()) await simpleDone.click();
  await waitFor(page.getByRole('button', { name: 'Start shot', exact: true }));
  await page.waitForFunction(() => !document.querySelector('[aria-label="Live chart"]'));
  check(true, 'The chart leaves with the shot');
  // A shot left to end on its own: the dial keeps the time and the results card only adds to it.
  await page.getByRole('button', { name: 'Start shot', exact: true }).click();
  await waitFor(page.getByRole('button', { name: 'Stop shot', exact: true }).or(page.getByRole('button', { name: 'Start anyway', exact: true })));
  if (await page.getByRole('button', { name: 'Start anyway', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Start anyway', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).waitFor({ timeout: 90000 });
  check(/\d:\d\d/.test(await dialText(page)), 'Finished: the dial keeps the shot time');
  await waitFor(page.locator('[aria-label="Shot result"]'));
  check(!/weight/i.test(await readings.innerText()), 'Finished: the readings do not repeat the yield');
  check(!/time/i.test(await page.locator('[aria-label="Shot result"]').innerText()), 'Finished: the results card does not repeat the time');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await waitFor(page.getByRole('button', { name: 'Start shot', exact: true }));
  await page.getByRole('button', { name: 'Flush water' }).click();
  await waitFor(page.getByRole('button', { name: 'Stop flush', exact: true }));
  check(/\d:\d\d/.test(await dialText(page)), 'Flush: the dial shows how long it has run');
  check(await page.locator('[aria-label="Shot setup"]').isVisible() && await page.locator('[aria-label="Live chart"]').count() === 0, 'A flush keeps the setup on screen and does not chart');
  check(await page.getByRole('button', { name: 'Second', exact: true }).isDisabled(), 'Profiles lock while the flush runs');
  await page.getByRole('button', { name: 'Stop flush', exact: true }).click();
  await waitFor(page.getByRole('button', { name: 'Start shot', exact: true }));
  check(true, 'Flush starts and stops from the machine card');
  for (const [route, heading] of routes) {
    await navigate(page, route, heading);
    if (route === 'profiles') await waitFor(page.getByRole('link', { name: 'Edit First profile' }));
    if (route === 'settings') await waitFor(page.getByRole('combobox', { name: 'Theme', exact: true }));
    if (route === 'history') await waitFor(page.getByRole('link', { name: 'Open in Analyzer' }).first());
    if (route === 'analyzer' || route === 'statistics') check(await page.locator('.sidebar a[aria-current="page"]').textContent() === 'History', `${route}: the menu shows it under History`);
    const name = route.replaceAll('/', '-'); await capture(page, name); await validate(page, name);
    if (route === 'profiles/first') {
      check(await page.getByRole('navigation', { name: 'Machine mode' }).count() === 0, 'Desktop profile editor swaps the floating bar for its pinned actions');
    } else {
      check(await clearsDock(page), `${name}: end of page scrolls clear of the floating bar`);
    }
  }
  // Opening Dashboard Settings selected Customize, so return to the machine dashboard.
  await page.evaluate(() => localStorage.setItem('dashboardMode', 'simple'));
  await navigate(page, 'settings', 'Settings');
  const settingsSave = page.getByRole('button', { name: 'Save Settings', exact: true });
  await waitFor(settingsSave);
  check(await settingsSave.evaluate(e => {
    const r = e.getBoundingClientRect();
    return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) && r.bottom <= window.innerHeight;
  }), 'Settings Save stays reachable');
  check(await page.getByRole('navigation', { name: 'Machine mode' }).count() === 0, 'Settings swaps the floating bar for its pinned actions');
  // Things that moved off the main screens must still be one step away.
  await navigate(page, 'profiles', 'Profiles');
  await waitFor(page.getByRole('link', { name: 'Edit First profile' }));
  check(await page.getByRole('link', { name: 'New profile' }).isVisible(), 'Profiles: New profile is on the page');
  await page.locator('summary[aria-label="More profile actions"]').click();
  for (const label of ['Export all', 'Delete all']) check(await page.getByRole('button', { name: label, exact: true }).isVisible(), `Profiles: ${label} is in the menu`);
  check(await page.locator('label[for="profileImport"]').isVisible(), 'Profiles: Import is in the menu');
  await page.locator('summary[aria-label="More profile actions"]').click();
  await page.getByRole('button', { name: 'Select Second profile' }).click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="Select Second profile"]')?.getAttribute('aria-pressed') === 'true');
  check(true, 'Profiles: tapping a row selects it');
  await page.getByRole('button', { name: 'Select First profile' }).click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="Select First profile"]')?.getAttribute('aria-pressed') === 'true');
  await page.getByRole('button', { name: 'Open actions menu for Bloom profile' }).click();
  for (const label of ['Show details for Bloom', 'Remove Bloom from favorites', 'View statistics for Bloom profile', 'Export Bloom profile', 'Duplicate Bloom profile', 'Delete Bloom profile'])
    check(await page.getByRole('menuitem', { name: label }).isVisible(), `Profiles: "${label}" is in the row menu`);
  await page.getByRole('menuitem', { name: 'Show details for Bloom' }).click();
  await waitFor(page.getByRole('button', { name: 'Move Bloom to top' }));
  check(true, 'Profiles: details and reordering open from the row menu');
  await navigate(page, 'history', 'Shot History');
  for (const label of ['Analyzer', 'Statistics']) check(await page.getByRole('link', { name: label, exact: true }).isVisible(), `History links to ${label}`);
  await waitFor(page.getByRole('link', { name: 'Open in Analyzer' }).first());
  await page.locator('summary[aria-label^="More actions for"]').first().click();
  for (const label of ['Export shot data', 'Upload to visualizer.coffee', 'Delete shot']) check(await page.getByRole('button', { name: label }).first().isVisible(), `History: "${label}" is in the row menu`);
  await page.locator('summary[aria-label^="More actions for"]').first().click();
  await page.getByRole('button', { name: /^Show details for/ }).first().click();
  await waitFor(page.locator('canvas').first());
  await waitFor(page.getByRole('heading', { name: 'Shot notes', exact: true }));
  check(await page.locator('main input').count() <= 1, 'History: reading a shot shows no empty note fields');
  await page.getByRole('button', { name: /^(Add notes|Edit)$/ }).first().click();
  await waitFor(page.getByRole('button', { name: 'Save', exact: true }));
  check(await page.getByPlaceholder('e.g., Single Origin, Blend').isVisible(), 'History: the full notes form opens on demand');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await navigate(page, 'settings/system', 'Settings');
  await page.locator('[role="tab"][aria-selected="true"]').waitFor();
  for (const label of ['GitHub', 'Discord']) { await waitFor(page.getByRole('link', { name: label, exact: true })); check(true, `Settings links to the project's ${label}`); }
  await navigate(page, 'profiles', 'Profiles');
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  await waitFor(page.getByRole('button', { name: 'Start water', exact: true }));
  check(new URL(page.url()).pathname === '/', 'Floating bar switches mode and returns to the dashboard from any page');
  await mode(page, 'Brew');
  await navigate(page, 'settings', 'Settings');
  await waitFor(page.getByRole('combobox', { name: 'Display Theme', exact: true }));
  const displayTheme = await page.evaluate(async () => (await (await fetch('/api/settings')).json()).themeMode);
  check(await page.getByRole('combobox', { name: 'Display Theme', exact: true }).inputValue() === String(displayTheme), 'Display theme current value is represented');
  await page.getByRole('button', { name: 'Show Password', exact: true }).first().click();
  check(await page.getByRole('button', { name: 'Hide Password', exact: true }).count() === 1, 'Password visibility has distinct state');
  await page.getByRole('button', { name: 'Hide Password', exact: true }).click();
  await navigate(page, 'profiles/first', 'Edit First');
  await page.getByRole('spinbutton', { name: 'Coffee dose in grams', exact: true }).fill('18.5');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await waitFor(page.getByRole('heading', { name: 'Profiles', exact: true }));
  await navigate(page, 'profiles/first', 'Edit First');
  check(await page.getByRole('spinbutton', { name: 'Coffee dose in grams', exact: true }).inputValue() === '18.5', 'Coffee dose survives profile save/reload');
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
  // Opening Dashboard Settings selects Customize, so return to the machine dashboard for this capture.
  await page.evaluate(() => localStorage.setItem('dashboardMode', 'simple'));
  await page.goto(base); await waitFor(page.getByRole('button', { name: 'Brew', exact: true })); await telemetry(page);
  await capture(page, 'dashboard-dark'); await validate(page, 'dashboard-dark');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await mobile.addInitScript(() => localStorage.setItem('gaggimate.desktopNavCollapsed', 'true'));
  const phone = await mobile.newPage(); watch(phone);
  await phone.goto(base); await waitFor(phone.getByRole('button', { name: 'Brew', exact: true })); await telemetry(phone);
  await capture(phone, 'phone-dashboard'); await validate(phone, 'phone-dashboard');
  check(await phone.getByRole('link', { name: /active warning/ }).count() === 0, 'Phone dashboard does not repeat its warnings in the top bar');
  const bar = phone.getByRole('navigation', { name: 'Machine mode' });
  check(JSON.stringify(await bar.getByRole('button').allTextContents()) === JSON.stringify(['Standby', 'Brew', 'Steam', 'Water', 'Grind']), 'Phone bottom nav holds the machine modes');
  const barBox = await bar.boundingBox();
  check(barBox.y + barBox.height <= 844 && barBox.width === 390, 'Phone bottom nav is pinned to the bottom edge');
  check(await bar.getByRole('button').evaluateAll(items => items.every(b => b.getBoundingClientRect().height >= 44)), 'Phone bottom nav targets are at least 44 px');
  const action = await phone.getByRole('button', { name: 'Start shot', exact: true }).boundingBox();
  check(action.y + action.height <= barBox.y, 'Phone primary action is on screen without scrolling');
  await phone.getByRole('button', { name: 'Open navigation' }).click();
  await waitFor(phone.getByRole('link', { name: 'Profiles', exact: true })); await capture(phone, 'phone-navigation');
  await phone.getByRole('link', { name: 'Profiles', exact: true }).click();
  await waitFor(phone.getByRole('heading', { name: 'Profiles', exact: true })); await waitFor(phone.getByRole('button', { name: 'Open navigation' }));
  check(true, 'Phone navigation opens and closes after routing');
  await phone.getByRole('button', { name: 'Water', exact: true }).click();
  await waitFor(phone.getByRole('button', { name: 'Start water', exact: true }));
  check(new URL(phone.url()).pathname === '/', 'Bottom nav switches mode and returns to the dashboard from any page');
  await phone.getByRole('button', { name: 'Brew', exact: true }).click();
  await waitFor(phone.getByRole('button', { name: 'Start shot', exact: true }));
  for (const [route, heading] of routes.filter(([r]) => r !== 'dashboard-settings')) {
    await navigate(phone, route, heading);
    if (route === 'settings') await waitFor(phone.getByRole('combobox', { name: 'Theme', exact: true }));
    if (route === 'profiles') {
      const names = await phone.locator('[id^="profile-"][id$="-title"]').evaluateAll(elements =>
        elements.map(e => ({ width: e.clientWidth, content: e.scrollWidth })));
      check(names.length >= 3 && names.every(n => n.width >= n.content), 'Phone profile names remain readable beside Edit and More');
    }
    if (route === 'settings') {
      const tabs = await phone.locator('[role="tab"]').evaluateAll(elements => elements.map(e => {
        const style = getComputedStyle(e), rect = e.getBoundingClientRect();
        return { height: rect.height, wrap: style.flexWrap, innerHeight: e.scrollHeight };
      }));
      check(tabs.every(t => t.height >= 44 && t.wrap === 'nowrap' && t.innerHeight <= t.height), 'Phone Settings tabs fit their content');
      const save = phone.getByRole('button', { name: 'Save Settings', exact: true });
      await save.scrollIntoViewIfNeeded();
      check(await save.evaluate(e => {
        const r = e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) && r.height >= 44;
      }), 'Phone Save is fully reachable and clear of navigation');
      check(await phone.getByRole('button', { name: 'Open navigation' }).evaluate(e => e.closest('header') !== null), 'Phone navigation lives in header');
    }

    if (route === 'profiles/first') {
      check(await phone.getByRole('navigation', { name: 'Machine mode' }).count() === 0, 'Profile editor swaps the mode bar for its pinned actions');
      const pinned = await phone.getByRole('button', { name: 'Save profile', exact: true }).boundingBox();
      check(pinned.y + pinned.height <= 844, 'Profile Save is pinned on screen');
      check(await phone.getByRole('link', { name: 'Back', exact: true }).first().isVisible(), 'Profile editor has a way back');
      const segments = await phone.locator('.join[role="group"]').evaluateAll(groups => groups.map(g => g.scrollWidth <= g.clientWidth + 1 && g.getBoundingClientRect().right <= window.innerWidth));
      check(segments.length > 0 && segments.every(Boolean), 'Profile segmented controls stay inside their card');
    }
    await capture(phone, `phone-${route.replaceAll('/', '-')}`); await validate(phone, `phone-${route}`);
  }
  await phone.setViewportSize({ width: 844, height: 390 }); await phone.goto(base);
  await waitFor(phone.getByRole('button', { name: 'Brew', exact: true })); await telemetry(phone);
  await capture(phone, 'phone-landscape'); await validate(phone, 'phone-landscape');
  check(await phone.locator('.bm-dock').isHidden() && await phone.locator('.sidebar button[aria-label="Brew"]').isVisible(), 'Phone landscape keeps the modes in its rail, with no floating bar');
  check(await phone.getByRole('button', { name: 'Start shot', exact: true }).evaluate(b => b.getBoundingClientRect().bottom <= window.innerHeight), 'Landscape primary action is on screen without scrolling');
  check(await dialFits(phone), 'Landscape: dial text fits inside the ring');
  await phone.setViewportSize({ width: 320, height: 568 }); await phone.goto(base);
  await waitFor(phone.locator('[aria-label="Machine status"]')); await validate(phone, 'phone-small');
  await telemetry(phone);
  check(await dialFits(phone), '320 px: dial text fits inside the ring');
  await mobile.close();
  // Whatever the window shape, there is exactly one set of mode controls: bar, floating bar or rail.
  const sizes = await browser.newContext({ colorScheme: 'light' });
  const sizePage = await sizes.newPage(); watch(sizePage);
  for (const [width, height] of [[1440, 1000], [1024, 768], [900, 1100], [768, 501], [768, 500], [700, 600], [600, 520], [844, 390], [667, 375], [390, 844], [320, 568]]) {
    await sizePage.setViewportSize({ width, height }); await sizePage.goto(base);
    await waitFor(sizePage.locator('[aria-label="Machine status"]'));
    check(await sizePage.getByRole('button', { name: 'Brew', exact: true }).count() === 1, `${width}x${height}: one set of mode controls`);
    check(await sizePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}x${height}: no page overflow`);
    if (width === 900) await capture(sizePage, 'tablet-dashboard');
  }
  await sizes.close();
  // Slow state arrives before telemetry: until a reading exists, nothing may claim the machine is ready.
  const heldBack = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  let holdTelemetry = true;
  await heldBack.routeWebSocket(/\/ws$/, ws => {
    const server = ws.connectToServer();
    ws.onMessage(message => server.send(message));
    server.onMessage(message => {
      if (!holdTelemetry || typeof message !== 'string') return ws.send(message);
      const frame = JSON.parse(message);
      if (frame.tp === 'evt:status') { delete frame.ct; delete frame.tt; }
      return ws.send(JSON.stringify(frame));
    });
  });
  const heldPage = await heldBack.newPage(); watch(heldPage); await heldPage.goto(base);
  await waitFor(heldPage.getByRole('button', { name: 'Brew', exact: true }).and(heldPage.locator('[aria-pressed="true"]')));
  await waitFor(heldPage.getByText('Reading the machine', { exact: true }).first());
  check(!(await heldPage.locator('[aria-label="Machine status"]').innerText()).includes('Ready'), 'No ready claim before the first temperature reading');
  check(await heldPage.getByRole('button', { name: 'Start shot', exact: true }).count() === 0, 'Start waits for the first temperature reading');
  check((await heldPage.locator('[aria-label="Live readings"]').innerText()).includes('—'), 'The dial stays blank until telemetry arrives');
  check(await heldPage.getByRole('button', { name: 'Increase temp target' }).isDisabled(), 'Temperature target waits for the first reading');
  holdTelemetry = false;
  await waitFor(heldPage.getByRole('button', { name: 'Start shot', exact: true })); await telemetry(heldPage);
  check(true, 'Dashboard continues once telemetry arrives');
  await heldBack.close();
  // Standby answers when the machine next wakes.
  const scheduled = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await scheduled.route('**/api/settings', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    return route.fulfill({ response, json: { ...(await response.json()), autowakeupEnabled: true, autowakeupSchedules: '07:00|1111111' } });
  });
  // Mode changes reach every open page, so read Standby here and then put Brew back.
  const scheduledPage = await scheduled.newPage(); watch(scheduledPage); await scheduledPage.goto(base);
  await scheduledPage.getByRole('button', { name: 'Standby', exact: true }).click();
  await scheduledPage.waitForFunction(() => /Wakes (today|tomorrow|[A-Z][a-z]{2}) at /.test(document.querySelector('[aria-label="Live readings"]')?.innerText ?? ''), null, { timeout: 20000 });
  check(true, 'Standby: the dial shows the next scheduled wake');
  check(await dialFits(scheduledPage), 'Standby: dial text fits inside the ring');
  await scheduledPage.getByRole('button', { name: 'Brew', exact: true }).click();
  await waitFor(scheduledPage.getByRole('button', { name: 'Start shot', exact: true }));
  await scheduled.close();
  // The simulator's mock controller always reports 0 ml pumped, so the count is injected here.
  const pumped = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await pumped.routeWebSocket(/\/ws$/, ws => {
    const server = ws.connectToServer();
    ws.onMessage(message => server.send(message));
    server.onMessage(message => {
      if (typeof message !== 'string') return ws.send(message);
      const frame = JSON.parse(message);
      if (frame.tp === 'evt:status' && frame.process) frame.wp = 120.4;
      return ws.send(JSON.stringify(frame));
    });
  });
  const pumpedPage = await pumped.newPage(); watch(pumpedPage); await pumpedPage.goto(base);
  await pumpedPage.getByRole('button', { name: 'Water', exact: true }).click();
  await pumpedPage.getByRole('button', { name: 'Start water', exact: true }).click();
  await waitFor(pumpedPage.getByRole('button', { name: 'Stop water', exact: true }));
  await pumpedPage.waitForFunction(() => /120 ml pumped/.test(document.querySelector('[aria-label="Live readings"]')?.innerText ?? ''), null, { timeout: 15000 });
  check(true, 'Water: the dial counts what has been pumped when the controller reports it');
  await pumpedPage.getByRole('button', { name: 'Stop water', exact: true }).click();
  await pumpedPage.waitForFunction(() => !document.querySelector('button[aria-label="Stop water"]'));
  const pumpedDone = pumpedPage.getByRole('button', { name: 'Done', exact: true });
  if (await pumpedDone.count()) await pumpedDone.click();
  await pumpedPage.getByRole('button', { name: 'Brew', exact: true }).click();
  await waitFor(pumpedPage.getByRole('button', { name: 'Start shot', exact: true }));
  await pumped.close();
  // A fresh phone opens on the page, not behind the navigation drawer.
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const freshPage = await fresh.newPage(); watch(freshPage); await freshPage.goto(base);
  await waitFor(freshPage.getByRole('button', { name: 'Open navigation' }));
  check(await freshPage.getByRole('link', { name: 'Profiles', exact: true }).count() === 0, 'Fresh phone load keeps the drawer closed');
  await fresh.close();
  // Setup is walked with the save mocked: a real save restarts the machine, which exits the simulator.
  const setup = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const setupPage = await setup.newPage(); watch(setupPage);
  let wifi = { wifiSsid: '', mdnsName: 'gaggimate', altRelayFunction: 1 }, saved = null;
  await setupPage.route('**/api/settings', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: wifi });
    saved = route.request().postData(); wifi = { ...wifi, wifiSsid: 'Home Network' };
    return route.abort();
  });
  await setupPage.goto(base);
  await waitFor(setupPage.getByRole('heading', { name: 'Welcome to BetterMate' })); check(true, 'Machine without Wi-Fi opens guided setup');
  await capture(setupPage, 'setup-welcome');
  await setupPage.getByRole('button', { name: 'Get started' }).click();
  check(await setupPage.getByRole('button', { name: 'Continue' }).isDisabled(), 'Setup needs a Wi-Fi name to continue');
  await capture(setupPage, 'setup-wifi');
  await setupPage.getByLabel('Wi-Fi name').fill('Home Network');
  await setupPage.getByLabel('Password', { exact: true }).fill('correct horse');
  await setupPage.getByRole('button', { name: 'Continue' }).click();
  await waitFor(setupPage.getByRole('heading', { name: 'Joining Home Network' }));
  check(['wifiSsid', 'wifiPassword', 'restart'].every(k => saved?.includes(`name="${k}"`)), 'Setup saves Wi-Fi name, password and restart');
  await setupPage.getByRole('button', { name: 'How to reconnect' }).click(); await capture(setupPage, 'setup-joining');
  await setupPage.getByRole('heading', { name: 'Your BetterMate is connected!' }).waitFor({ timeout: 20000 });
  await capture(setupPage, 'setup-connected'); check(true, 'Setup confirms once the machine answers on the new network');
  await setupPage.getByRole('button', { name: 'Finish setup' }).click();
  await waitFor(setupPage.locator('[aria-label="Machine status"]'));
  wifi = { ...wifi, wifiSsid: '' }; await setupPage.goto(base);
  await waitFor(setupPage.locator('[aria-label="Machine status"]')); await setupPage.waitForTimeout(1000);
  check(new URL(setupPage.url()).pathname === '/', 'Finished setup does not reopen');
  // Re-running setup on the same network with a blank password must keep the saved one.
  wifi = { ...wifi, wifiSsid: 'Home Network' }; saved = null;
  await setupPage.goto(new URL('setup', base).href);
  await setupPage.getByRole('button', { name: 'Get started' }).click();
  await setupPage.waitForFunction(() => document.querySelector('#setup-ssid')?.value === 'Home Network');
  await setupPage.getByRole('button', { name: 'Continue' }).click();
  await waitFor(setupPage.getByRole('heading', { name: 'Joining Home Network' }));
  check(saved?.includes('name="wifiSsid"') && !saved.includes('name="wifiPassword"'), 'Blank password on the same network keeps the saved one');
  await setup.close();
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
} catch (error) {
  errors.push({ verification: error.stack || String(error) }); process.exitCode = 1;
  const failedPage = browser.contexts()[0]?.pages()[0];
  if (failedPage) await capture(failedPage, 'failed-page').catch(() => {});
}
finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ assertions: checks.length, checks, errors }, null, 2));
  console.log(JSON.stringify({ output, assertions: checks.length, errors })); await browser.close();
}

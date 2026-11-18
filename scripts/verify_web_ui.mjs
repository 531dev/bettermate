#!/usr/bin/env node
// The committed check of the v2 web UI: the shell and its navigation, every page at phone and
// desktop size in both themes, and the core flows against a machine.
//
//   node scripts/verify_web_ui.mjs [base URL] [--output <dir>] [--only shell,pages,flows]
//                                  [--playwright-module <path to playwright/index.mjs>]
//
// The base URL is wherever the web UI is served with a machine behind it: Vite in front of a
// simulator (the default, http://127.0.0.1:5173/), or the simulator itself once it embeds the
// bundle (http://127.0.0.1:<SIM_HTTP_PORT>/). REST and the WebSocket are reached through the same
// origin. `--url <base URL>` is accepted as well.
//
// Run it only against a disposable simulator on the seeded state
// (`cp -R scripts/fixtures/web-seed/. <dir>/sim_data/`: profiles first, second and bloom, two
// shots). It changes the mode, the target temperature, the selected profile and one setting,
// pulls a short shot, and puts all but the shot back.
//
// With `--output` it also writes results.json and a picture of every page and state it visits.
// It prints one line per failure and a tally per part, and exits 1 if anything failed.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const FLAGS = ['--url', '--output', '--only', '--playwright-module'];
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const positional = args.filter((a, i) => !FLAGS.includes(a) && !FLAGS.includes(args[i - 1]));
const base = new URL(flag('--url', positional[0] || 'http://127.0.0.1:5173/'));
const output = flag('--output') ? resolve(flag('--output')) : null;
const only = flag('--only', 'shell,pages,flows').split(',');
const modulePath = flag('--playwright-module', process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = await import(
  modulePath.startsWith('/') ? pathToFileURL(modulePath).href : modulePath
);
if (output) await mkdir(output, { recursive: true });

const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 1000 } };
const THEMES = ['light', 'dark'];
const SETTINGS_TABS = ['general', 'machine', 'calibration', 'plugins', 'bluetooth', 'system'];
// Every route with the page title it shows.
const PAGES = [
  ['dashboard', '/', 'Dashboard'],
  ['dashboard-settings', '/dashboard-settings', 'Dashboard settings'],
  ['profiles', '/profiles', 'Profiles'],
  ['profile-edit', '/profiles/first', 'Edit First'],
  ['profile-new', '/profiles/new', 'New profile'],
  ...SETTINGS_TABS.map(tab => [`settings-${tab}`, `/settings/${tab}`, 'Settings']),
  ['history', '/history', 'Shot history'],
  ['analyzer', '/analyzer', 'Analyzer'],
  ['statistics', '/statistics', 'Statistics'],
  ['setup', '/setup', 'Welcome to BetterMate'],
  ['not-found', '/no-such-page', 'Page not found'],
];
const NAV = ['Dashboard', 'Profiles', 'History', 'Settings'];
// The profile editor and Settings pin their own action where the mode bar would be.
const hidesModeBar = path => path.startsWith('/profiles/') || path.startsWith('/settings');

// ── Checks ─────────────────────────────────────────────────────────────────────────────────
const results = [];
let part = '';
const check = (ok, label, detail = '') => {
  results.push({ part, ok: !!ok, label, detail: ok ? '' : String(detail) });
  if (!ok) console.log(`FAIL ${part}: ${label}${detail === '' ? '' : ` :: ${detail}`}`);
  return !!ok;
};
// A step that throws (a control that never appears) fails its check instead of ending the run.
const step = async (label, run) => {
  try {
    await run();
    return check(true, label);
  } catch (error) {
    return check(false, label, String(error.message || error).split('\n')[0]);
  }
};

// ── Browser ────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const url = path => new URL(path.replace(/^\//, ''), base).href;

/** A window at one size and theme, with what the page complains about collected. */
async function open(size, theme, { view = 'simple', setupDismissed = true } = {}) {
  const phone = size === 'phone';
  const context = await browser.newContext({
    viewport: SIZES[size],
    colorScheme: theme,
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
  });
  await context.addInitScript(
    ([theme, view, setupDismissed]) => {
      try {
        // The storage keys of the app, set before it starts.
        localStorage.setItem('gaggimate-daisyui-theme', theme);
        if (!sessionStorage.getItem('verify-seeded')) {
          sessionStorage.setItem('verify-seeded', '1');
          localStorage.setItem('dashboardMode', view);
          if (setupDismissed) localStorage.setItem('bettermate.setupDismissed', 'true');
        }
      } catch {
        // No storage: the app's defaults apply.
      }
    },
    [theme, view, setupDismissed],
  );
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    // A socket cut by leaving a page is the browser's report, not the page's fault.
    if (message.type() === 'error' && !message.text().includes('WebSocket'))
      problems.push(`console: ${message.text()}`);
  });
  return { context, page, problems, size, theme };
}

async function goto(page, path, title) {
  await page.goto(url(path), { waitUntil: 'networkidle' });
  if (title) await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

// The page scrolls inside <main>, so a picture of all of it needs a taller window.
async function capture(page, name) {
  if (!output) return;
  const viewport = page.viewportSize();
  const height = await page.evaluate(() => {
    const main = document.querySelector('#main');
    return main ? window.innerHeight - main.clientHeight + main.scrollHeight : 0;
  });
  if (height > viewport.height) {
    await page.setViewportSize({ width: viewport.width, height: Math.min(height, 6000) });
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: `${output}/${name}.png` });
  if (height > viewport.height) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
  }
}

/** The machine, through the same origin as the page: its status as it arrives, and requests. */
async function machine() {
  const socket = new WebSocket(url('/ws').replace(/^http/, 'ws'));
  const state = { status: null };
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.tp === 'evt:status') state.status = { ...state.status, ...message };
  };
  await new Promise((opened, failed) => {
    socket.onopen = opened;
    socket.onerror = () => failed(new Error(`no machine behind ${base.href}ws`));
  });
  return {
    get status() {
      return state.status;
    },
    send: message => socket.send(JSON.stringify(message)),
    async until(test, what, timeout = 15000) {
      const from = Date.now();
      while (Date.now() - from < timeout) {
        if (state.status && test(state.status)) return state.status;
        await new Promise(next => setTimeout(next, 100));
      }
      throw new Error(`the machine did not reach: ${what}`);
    },
    close: () => socket.close(),
  };
}
const settings = async () => (await fetch(url('/api/settings'))).json();

// ── The shell and its navigation ───────────────────────────────────────────────────────────
async function shell() {
  part = 'shell';
  const modeBar = page => page.getByRole('navigation', { name: 'Machine mode' });
  const current = page =>
    page
      .locator('.bm-nav__item[aria-current="page"]')
      .evaluateAll(l => l.map(e => e.innerText.trim()));

  // Desktop: the sidebar is the navigation.
  {
    const { context, page, problems } = await open('desktop', 'light');
    await goto(page, '/', 'Dashboard');
    check((await page.title()).includes('BetterMate'), 'the document title names BetterMate');
    const nav = page.getByRole('navigation', { name: 'Pages' });
    const links = (await nav.getByRole('link').allInnerTexts()).map(t => t.trim());
    check(links.join() === NAV.join(), 'desktop: the sidebar holds the four pages', links.join());
    check(await page.locator('.bm-topbar').isHidden(), 'desktop: no top bar beside the sidebar');
    const modes = (await modeBar(page).getByRole('button').allInnerTexts()).map(t => t.trim());
    check(
      modes.slice(0, 4).join() === 'Standby,Brew,Steam,Water' && modes.length <= 5,
      'the mode bar holds the machine modes',
      modes.join(),
    );
    check(
      await modeBar(page)
        .getByRole('button')
        .evaluateAll(l => l.every(b => b.getBoundingClientRect().height >= 44)),
      'every mode is at least 44 px tall',
    );
    check(
      (await modeBar(page).locator('[aria-pressed="true"]').count()) === 1,
      'one mode is selected',
    );
    for (const [name, heading, path] of [
      ['Profiles', 'Profiles', '/profiles'],
      ['History', 'Shot history', '/history'],
      ['Settings', 'Settings', '/settings'],
      ['Dashboard', 'Dashboard', '/'],
    ]) {
      await step(
        `desktop: ${name} in the sidebar opens ${heading} and is marked current`,
        async () => {
          await nav.getByRole('link', { name, exact: true }).click();
          await page.getByRole('heading', { level: 1, name: heading, exact: true }).waitFor();
          if (new URL(page.url()).pathname.replace(/\/general$/, '') !== path)
            throw new Error(`at ${page.url()}`);
          if ((await current(page)).join() !== name)
            throw new Error(`current: ${await current(page)}`);
        },
      );
    }
    await goto(page, '/analyzer', 'Analyzer');
    check(
      (await current(page)).join() === 'History',
      'the Analyzer belongs to History in the sidebar',
    );
    check((await modeBar(page).count()) === 1, 'the mode bar floats over the Analyzer');
    await goto(page, '/settings/general', 'Settings');
    check(
      (await modeBar(page).count()) === 0,
      'Settings has no mode bar: its Save is pinned there',
    );
    await goto(page, '/profiles/first', 'Edit First');
    check((await modeBar(page).count()) === 0, 'the profile editor has no mode bar');
    await step('the skip link is the first stop and leads to the page', async () => {
      await goto(page, '/', 'Dashboard');
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => document.activeElement?.textContent.trim());
      if (first !== 'Skip to content') throw new Error(`first stop: ${first}`);
    });
    check(problems.length === 0, 'desktop: no errors while navigating', problems.join(' | '));
    await context.close();
  }

  // Phone: the top bar opens the navigation as a menu.
  {
    const { context, page, problems } = await open('phone', 'light');
    await goto(page, '/', 'Dashboard');
    const panel = page.locator('#navigation');
    const openNav = page.getByRole('button', { name: 'Open navigation' });
    check(await page.locator('.bm-topbar').isVisible(), 'phone: the top bar is there');
    check(!(await panel.isVisible()), 'phone: the navigation is closed at rest');
    await step(
      'phone: the menu button opens the navigation with the current page focused',
      async () => {
        await openNav.click();
        await page.locator('#navigation.is-open').waitFor();
        await page.waitForTimeout(350);
        const focused = await page.evaluate(() => document.activeElement?.textContent.trim());
        if (focused !== 'Dashboard') throw new Error(`focus on: ${focused}`);
      },
    );
    await capture(page, 'phone-navigation');
    await step('phone: Escape closes it', async () => {
      await page.keyboard.press('Escape');
      await page.locator('#navigation:not(.is-open)').waitFor();
    });
    await step('phone: a page chosen from the menu opens and the menu closes', async () => {
      await openNav.click();
      await page.locator('#navigation.is-open').waitFor();
      await panel.getByRole('link', { name: 'Profiles', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Profiles', exact: true }).waitFor();
      await page.locator('#navigation:not(.is-open)').waitFor();
    });
    await step('phone: a detail page has Back in place of the menu', async () => {
      await goto(page, '/profiles/first', 'Edit First');
      if (await openNav.count()) throw new Error('the menu button is still there');
      await page.getByRole('link', { name: 'Back', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Profiles', exact: true }).waitFor();
    });
    await step('phone: Back on the Analyzer leads to Shot history', async () => {
      await goto(page, '/analyzer', 'Analyzer');
      await page.getByRole('link', { name: 'Back', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Shot history', exact: true }).waitFor();
    });
    const bar = await modeBar(page).boundingBox();
    check(
      bar &&
        bar.x >= 0 &&
        bar.x + bar.width <= SIZES.phone.width &&
        bar.y + bar.height <= SIZES.phone.height,
      'phone: the mode bar floats inside the window',
      JSON.stringify(bar),
    );
    check(problems.length === 0, 'phone: no errors while navigating', problems.join(' | '));
    await context.close();
  }

  // Setup is the whole window: the shell is not there to be reached.
  for (const size of ['phone', 'desktop']) {
    const { context, page } = await open(size, 'light', { setupDismissed: false });
    await goto(page, '/setup', 'Welcome to BetterMate');
    const chrome = await page
      .locator('#navigation, .bm-topbar, .bm-modebar, a[href="#main"]')
      .count();
    check(chrome === 0, `${size}, setup: no navigation, top bar, mode bar or skip link`, chrome);
    const stops = [];
    for (const key of [...Array(8).fill('Tab'), ...Array(8).fill('Shift+Tab')]) {
      await page.keyboard.press(key);
      stops.push(
        await page.evaluate(() => {
          const at = document.activeElement;
          if (!at || at === document.body) return 'the page';
          // Setup is the routed page, inside <main>; the shell's own controls sit outside it.
          return at.closest('#main') ? 'setup' : `outside: ${at.outerHTML.slice(0, 60)}`;
        }),
      );
    }
    check(
      stops.every(stop => !stop.startsWith('outside')) && stops.includes('setup'),
      `${size}, setup: Tab only visits the step's own controls`,
      stops.filter(stop => stop.startsWith('outside')).join(' | '),
    );
    await step(
      `${size}, setup: Skip for now leaves for the dashboard, and the shell is back`,
      async () => {
        await page.getByRole('button', { name: 'Skip for now' }).click();
        await page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true }).waitFor();
        await modeBar(page).waitFor();
      },
    );
    await context.close();
  }
}

// ── Every page, phone and desktop, light and dark ──────────────────────────────────────────
async function pages() {
  part = 'pages';
  for (const size of Object.keys(SIZES)) {
    for (const theme of THEMES) {
      const { context, page, problems } = await open(size, theme);
      for (const [name, path, title] of PAGES) {
        const id = `${name}, ${size} ${theme}`;
        problems.length = 0;
        const loaded = await step(`${id}: loads with its title`, async () => {
          await goto(page, path, title);
          if (path.startsWith('/settings/')) {
            const tab = path.split('/').pop();
            await page.locator(`#panel-${tab} .bm-tile`).first().waitFor();
            await page.waitForTimeout(300);
          }
        });
        if (!loaded) continue;
        const facts = await page.evaluate(() => {
          const root = document.documentElement;
          const main = document.querySelector('#main');
          const probe = document.createElement('i');
          probe.style.background = 'var(--surface-0)';
          document.body.append(probe);
          const ground = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const dressed = [...document.querySelectorAll('body *')].filter(element => {
            const style = getComputedStyle(element);
            return (
              style.boxShadow !== 'none' ||
              style.backdropFilter !== 'none' ||
              style.filter !== 'none' ||
              style.backgroundImage.includes('gradient')
            );
          });
          // A chart is never drawn in a cell: pressure is 2.6:1 on surface-2 in Dark.
          probe.style.background = 'var(--surface-2)';
          document.body.append(probe);
          const cell = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const groundOf = node => {
            for (; node; node = node.parentElement) {
              const fill = getComputedStyle(node).backgroundColor;
              if (fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent') return fill;
            }
            return '';
          };
          const charts = [...document.querySelectorAll('.bm-chartbox canvas')];
          return {
            chartsInCells: charts.filter(canvas => groundOf(canvas) === cell).length,
            chartsUnnamed: charts.filter(canvas => !canvas.getAttribute('aria-label')).length,
            h1: document.querySelectorAll('h1').length,
            sideways: Math.max(
              root.scrollWidth - window.innerWidth,
              main ? main.scrollWidth - main.clientWidth : 0,
            ),
            theme: root.dataset.theme,
            ground: getComputedStyle(document.body).backgroundColor === ground,
            font: getComputedStyle(document.body).fontFamily,
            faces:
              document.fonts.check('500 15px "Funnel Display"') &&
              document.fonts.check('500 12px "Geist Mono"'),
            dressed: dressed.slice(0, 3).map(element => element.outerHTML.slice(0, 80)),
            words: (main || document.body).innerText,
            sidebar: !!document.querySelector('#navigation'),
            modeBar: !!document.querySelector('.bm-modebar'),
          };
        });
        check(problems.length === 0, `${id}: no errors in the console`, problems.join(' | '));
        check(facts.h1 === 1, `${id}: one page title`, `${facts.h1} h1`);
        check(
          facts.chartsInCells === 0 && facts.chartsUnnamed === 0,
          `${id}: every chart is named and none is drawn on surface-2`,
          `${facts.chartsInCells} in cells, ${facts.chartsUnnamed} unnamed`,
        );
        check(facts.sideways <= 0, `${id}: nothing scrolls sideways`, `${facts.sideways}px`);
        check(
          facts.theme === theme && facts.ground,
          `${id}: the ${theme} theme is on the page`,
          facts.theme,
        );
        check(
          facts.font.includes('Funnel Display') && facts.faces,
          `${id}: the two bundled faces are loaded`,
          facts.font,
        );
        check(
          facts.dressed.length === 0,
          `${id}: no shadow, blur, filter or gradient`,
          facts.dressed.join(' | '),
        );
        check(
          !/\b(NaN|undefined|null)\b/.test(facts.words),
          `${id}: no reading says NaN or undefined`,
          facts.words.match(/.{0,20}\b(NaN|undefined|null)\b.{0,20}/)?.[0],
        );
        const shellExpected = path !== '/setup';
        check(
          facts.sidebar === shellExpected &&
            facts.modeBar === (shellExpected && !hidesModeBar(path)),
          `${id}: the shell is ${shellExpected ? 'around the page' : 'left out'}`,
          `navigation ${facts.sidebar}, mode bar ${facts.modeBar}`,
        );
        await capture(page, `${name}-${size}-${theme}`);
      }
      await context.close();
    }
  }
}

// ── The core flows, against the machine ────────────────────────────────────────────────────
async function flows() {
  part = 'flows';
  const m = await machine();
  // From rest: standby, the first profile, nothing running.
  m.send({ tp: 'req:process:deactivate' });
  m.send({ tp: 'req:process:clear' });
  m.send({ tp: 'req:profiles:select', id: 'first', rid: 'verify-first' });
  m.send({ tp: 'req:change-mode', mode: 0 });
  await m.until(s => s.m === 0 && !s.process, 'standby with nothing running');

  const { context, page, problems } = await open('desktop', 'light');
  const modeBar = page.getByRole('navigation', { name: 'Machine mode' });
  const mode = name => modeBar.getByRole('button', { name, exact: true });
  const banner = name => page.locator('#main button.bm-cta', { hasText: name });
  const dial = page.locator('section[aria-label="Machine"]');
  const chip = text =>
    page.waitForFunction(
      t =>
        document
          .querySelector('section[aria-label="Machine"] [role="status"]')
          ?.textContent.trim() === t,
      text,
      { timeout: 120000 },
    );
  const eyebrow = async () => (await dial.locator('.bm-tile__head .bm-eyebrow').innerText()).trim();

  await goto(page, '/', 'Dashboard');
  await capture(page, 'flow-standby');

  // Mode change: each mode of the bar, ending in Brew.
  const shown = (await modeBar.getByRole('button').allInnerTexts()).map(t => t.trim());
  const MODE_IDS = { Standby: 0, Brew: 1, Steam: 2, Water: 3, Grind: 4 };
  for (const name of [...shown.filter(n => !['Standby', 'Brew'].includes(n)), 'Brew']) {
    await step(`mode: ${name} is selected on the machine and on the page`, async () => {
      await mode(name).click();
      await m.until(s => s.m === MODE_IDS[name], `mode ${name}`);
      await page.waitForFunction(
        label =>
          [...document.querySelectorAll('.bm-modebar__item')].some(
            b => b.textContent.trim() === label && b.getAttribute('aria-pressed') === 'true',
          ),
        name,
      );
      await page.waitForFunction(
        label =>
          document
            .querySelector('section[aria-label="Machine"] .bm-tile__head .bm-eyebrow')
            ?.textContent.trim()
            .toLowerCase()
            .startsWith(label.toLowerCase()),
        name,
      );
      await page.waitForTimeout(1200);
      await capture(page, `flow-${name.toLowerCase()}`);
    });
  }
  check(
    /^brew · first$/i.test(await eyebrow()),
    'brew: the dial names the mode and the profile',
    await eyebrow(),
  );

  // Target change.
  await step(
    'target: Raise and Lower move the target temperature on the machine and on the page',
    async () => {
      const value = page.locator('section[aria-label="Shot setup"] .bm-stepper__value').first();
      const before = (await m.until(s => s.tt > 0, 'a target temperature')).tt;
      await page.getByRole('button', { name: 'Raise target temperature' }).click();
      await m.until(s => s.tt === before + 1, 'target + 1');
      await page.waitForFunction(
        v =>
          document
            .querySelector('section[aria-label="Shot setup"] .bm-stepper__value')
            ?.textContent.trim() === v,
        `${before + 1}°`,
      );
      await page.getByRole('button', { name: 'Lower target temperature' }).click();
      await m.until(s => s.tt === before, 'target back');
      await page.waitForFunction(
        v =>
          document
            .querySelector('section[aria-label="Shot setup"] .bm-stepper__value')
            ?.textContent.trim() === v,
        `${before}°`,
      );
      if ((await value.innerText()).trim() !== `${before}°`)
        throw new Error(await value.innerText());
    },
  );

  // Start and stop a shot.
  await step('shot: Start shot starts one', async () => {
    await chip('Ready');
    await capture(page, 'flow-brew-ready');
    await banner('Start shot').click();
    // The controller may ask first; the sheet's own action starts the shot.
    const sheet = page.getByRole('dialog');
    const asked = await Promise.race([
      sheet.waitFor({ timeout: 2500 }).then(
        () => true,
        () => false,
      ),
      m
        .until(s => s.process?.a, 'a running shot', 2500)
        .then(
          () => false,
          () => false,
        ),
    ]);
    if (asked && !m.status.process?.a)
      await sheet.getByRole('button', { name: 'Start anyway' }).click();
    await m.until(s => s.process?.a, 'a running shot');
    await chip('Brewing');
  });
  await step(
    'shot: while it runs the banner is Stop shot with its progress, and the other modes lock',
    async () => {
      await m.until(s => s.process?.e > 3000, '3 s of shot', 20000);
      const stop = banner('Stop shot');
      if (
        !(await stop.evaluate(
          el => el.classList.contains('bm-cta--stop') && !!el.querySelector('.bm-segbar'),
        ))
      )
        throw new Error('the banner is not the ink Stop form with segments');
      // Locked, not disabled (the 2026-11-16 design; Steam locks too, as the user decided): every
      // other mode is aria-disabled, stays focusable, reads its reason, is drawn in ink-faint at
      // full opacity, and a press answers in words without changing the mode.
      const locked = (
        await page.locator('.bm-modebar__item[aria-disabled="true"]').allInnerTexts()
      ).map(t => t.trim());
      if (locked.length !== shown.length - 1 || locked.includes('Brew'))
        throw new Error(`locked: ${locked}`);
      const look = await page.evaluate(() => {
        const item = document.querySelector('.bm-modebar__item[aria-disabled="true"]');
        const probe = document.createElement('i');
        probe.style.color = 'var(--ink-faint)';
        document.body.append(probe);
        const faint = getComputedStyle(probe).color;
        probe.remove();
        const reason = document.getElementById(item.getAttribute('aria-describedby') || '');
        return {
          disabled: item.disabled,
          faint: getComputedStyle(item).color === faint,
          opacity: getComputedStyle(item).opacity,
          reason: reason?.textContent.trim(),
        };
      });
      if (look.disabled || !look.faint || look.opacity !== '1')
        throw new Error(`locked look: ${JSON.stringify(look)}`);
      if (look.reason !== 'Locked while a shot runs.') throw new Error(`reason: ${look.reason}`);
      // Reached with the keyboard: a locked mode is still a Tab stop.
      await mode('Steam').focus();
      await page.keyboard.press('Enter');
      await page
        .locator('.bm-toast', { hasText: 'Stop the shot to change mode.' })
        .waitFor({ timeout: 2000 });
      if (m.status.m !== 1 || !m.status.process?.a)
        throw new Error('a press on a locked mode changed the machine');
      if ((await page.locator('section[aria-label="Live chart"] canvas').count()) !== 1)
        throw new Error('no live chart');
      await capture(page, 'flow-brew-active');
    },
  );
  await step('shot: Stop shot stops it, and Start shot is back', async () => {
    await banner('Stop shot').click();
    await m.until(s => !s.process, 'no process');
    await chip('Ready');
    await banner('Start shot').waitFor();
  });

  // Select a profile.
  const row = name =>
    page
      .locator('.profile-card-container')
      .filter({ has: page.locator('.bm-item__title').getByText(name, { exact: true }) });
  const inUse = name =>
    page.waitForFunction(
      label =>
        document.querySelector('.bm-item[aria-current="true"] .bm-item__title')?.textContent ===
        label,
      name,
    );
  await step(
    'profile: a tap on a row selects it on the machine, and the In use Chip moves',
    async () => {
      await goto(page, '/profiles', 'Profiles');
      await inUse('First');
      await capture(page, 'flow-profiles');
      await row('Second').locator('.bm-item__main').click();
      await inUse('Second');
      await m.until(s => s.puid === 'second', 'profile second');
      if (
        (await row('Second').locator('.bm-chip--ink').count()) !== 1 ||
        (await row('First').locator('.bm-chip--ink').count()) !== 0
      )
        throw new Error('the In use Chip did not move');
    },
  );
  await step(
    'profile: the dashboard names the selected profile, and First is selected again',
    async () => {
      await goto(page, '/', 'Dashboard');
      await page.waitForFunction(() =>
        /second$/i.test(
          document
            .querySelector('section[aria-label="Machine"] .bm-tile__head .bm-eyebrow')
            ?.textContent.trim(),
        ),
      );
      await page
        .getByRole('group', { name: 'Favourite profiles' })
        .getByRole('button', { name: 'First' })
        .click();
      await m.until(s => s.puid === 'first', 'profile first');
    },
  );

  // Save a setting and read it back.
  await step(
    'setting: a changed standby timeout is saved, read back from the machine and from the page, and restored',
    async () => {
      const saved = (await settings()).standbyTimeout;
      const next = saved + 60;
      const save = async value => {
        await goto(page, '/settings/general', 'Settings');
        const field = page.locator('#standbyTimeout');
        await field.waitFor();
        await field.fill(String(value));
        const posted = page.waitForResponse(
          r => r.url().endsWith('/api/settings') && r.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await posted;
        await page
          .locator('.bm-pinned [role="status"]')
          .getByText('Saved', { exact: true })
          .waitFor();
        if ((await settings()).standbyTimeout !== value)
          throw new Error(`the machine holds ${(await settings()).standbyTimeout}, not ${value}`);
        await goto(page, '/settings/general', 'Settings');
        await page.locator('#standbyTimeout').waitFor();
        const shownValue = await page.locator('#standbyTimeout').inputValue();
        if (shownValue !== String(value))
          throw new Error(`the page shows ${shownValue}, not ${value}`);
      };
      await save(next);
      await capture(page, 'flow-settings-saved');
      await save(saved);
    },
  );

  // Open a shot in history.
  await step('history: a row opens its shot with the chart', async () => {
    await goto(page, '/history', 'Shot history');
    const rows = page.locator('button.bm-item');
    await rows.first().waitFor();
    await rows.first().click();
    await page.locator('#main canvas').first().waitFor({ timeout: 15000 });
    if ((await rows.first().getAttribute('aria-expanded')) !== 'true')
      throw new Error('the row is not open');
    // The Chart card: the canvas says its series, its span and its final values with units.
    const said = await page.locator('#main .bm-chartbox canvas').first().getAttribute('aria-label');
    if (!/^Shot \d+\. Pressure.* over \d+ seconds\. Final values: [\d.]+ bar/.test(said || ''))
      throw new Error(`the chart says: ${said}`);
    await page.waitForTimeout(500);
    await capture(page, 'flow-history-open');
  });

  // Load a shot in the Analyzer.
  await step('analyzer: a shot picked from the library is charted', async () => {
    await goto(page, '/analyzer', 'Analyzer');
    await page.locator('[data-slot="shot"] .an-slot__main').first().click();
    await page.locator('.an-lib.is-open').waitFor();
    const shots = page.locator('[data-library-section="shots"] [data-library-row="shot"]');
    await shots.first().waitFor();
    await shots.first().locator('.an-lib__name').click();
    await page.locator('[data-chart="shot-main"] canvas').waitFor({ timeout: 20000 });
    const name = (
      await page.locator('[data-slot="shot"] .an-slot__name').first().textContent()
    ).trim();
    if (!name) throw new Error('the slot does not name the shot');
    await page.waitForTimeout(800);
    await capture(page, 'flow-analyzer-loaded');
  });

  // Run a Statistics query.
  await step('statistics: a query runs and shows its summary', async () => {
    await goto(page, '/statistics', 'Statistics');
    await page.locator('[data-statistics-run]').click();
    await page.locator('[data-statistics-summary]').waitFor({ timeout: 30000 });
    const summary = await page.locator('[data-statistics-summary]').innerText();
    if (!/\d/.test(summary)) throw new Error(`summary: ${summary.slice(0, 80)}`);
    await page.waitForTimeout(500);
    await capture(page, 'flow-statistics-built');
  });

  // Back to rest.
  await step('mode: Standby puts the machine to rest', async () => {
    await goto(page, '/', 'Dashboard');
    await mode('Standby').click();
    await m.until(s => s.m === 0, 'standby');
  });
  check(problems.length === 0, 'no errors in the console through the flows', problems.join(' | '));
  await context.close();
  m.close();
}

// ── Run ────────────────────────────────────────────────────────────────────────────────────
const PARTS = { shell, pages, flows };
let crashed = null;
try {
  for (const name of Object.keys(PARTS)) if (only.includes(name)) await PARTS[name]();
} catch (error) {
  crashed = error;
  part = part || 'run';
  check(false, 'the run ended early', error.stack || error);
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`web UI at ${base.href}`);
for (const name of Object.keys(PARTS)) {
  const mine = results.filter(r => r.part === name);
  if (mine.length) console.log(`${name}: ${mine.filter(r => r.ok).length}/${mine.length} passed`);
}
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
if (output) {
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      { base: base.href, assertions: results.length, failed: failed.length, results },
      null,
      2,
    ),
  );
}
process.exit(failed.length || crashed ? 1 : 0);

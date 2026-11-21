#!/usr/bin/env node
// The committed check of the v2 web UI: the shell and its navigation, every page at phone and
// desktop size in both themes, the core flows against a machine, and the product states.
//
//   node scripts/verify_web_ui.mjs [base URL] [--output <dir>] [--only shell,pages,flows,states]
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
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const FLAGS = ["--url", "--output", "--only", "--playwright-module"];
const flag = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const positional = args.filter(
  (a, i) => !FLAGS.includes(a) && !FLAGS.includes(args[i - 1]),
);
const base = new URL(flag("--url", positional[0] || "http://127.0.0.1:5173/"));
const output = flag("--output") ? resolve(flag("--output")) : null;
const only = flag("--only", "shell,pages,flows,states").split(",");
const modulePath = flag(
  "--playwright-module",
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const { chromium } = await import(
  modulePath.startsWith("/") ? pathToFileURL(modulePath).href : modulePath
);
if (output) await mkdir(output, { recursive: true });

const SIZES = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 1000 },
  // The narrowest screen the design names: every page works there, in one theme.
  narrow: { width: 320, height: 700 },
};
const THEMES = ["light", "dark"];
const SETTINGS_TABS = [
  "general",
  "machine",
  "calibration",
  "plugins",
  "bluetooth",
  "system",
];
// Every route with the page title it shows.
const PAGES = [
  ["dashboard", "/", "Dashboard"],
  ["dashboard-settings", "/dashboard-settings", "Dashboard settings"],
  ["profiles", "/profiles", "Profiles"],
  ["profile-edit", "/profiles/first", "Edit First"],
  ["profile-new", "/profiles/new", "New profile"],
  ...SETTINGS_TABS.map((tab) => [
    `settings-${tab}`,
    `/settings/${tab}`,
    "Settings",
  ]),
  ["history", "/history", "Shot history"],
  ["analyzer", "/analyzer", "Analyzer"],
  ["statistics", "/statistics", "Statistics"],
  ["setup", "/setup", "Welcome to BetterMate"],
  ["not-found", "/no-such-page", "Page not found"],
];
const NAV = ["Dashboard", "Profiles", "History", "Settings"];
// The profile editor and Settings pin their own action where the mode bar would be.
const hidesModeBar = (path) =>
  path.startsWith("/profiles/") || path.startsWith("/settings");

// ── Checks ─────────────────────────────────────────────────────────────────────────────────
const results = [];
let part = "";
const check = (ok, label, detail = "") => {
  results.push({ part, ok: !!ok, label, detail: ok ? "" : String(detail) });
  if (!ok)
    console.log(
      `FAIL ${part}: ${label}${detail === "" ? "" : ` :: ${detail}`}`,
    );
  return !!ok;
};
// A step that throws (a control that never appears) fails its check instead of ending the run.
const step = async (label, run) => {
  try {
    await run();
    return check(true, label);
  } catch (error) {
    return check(false, label, String(error.message || error).split("\n")[0]);
  }
};

// ── Browser ────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const url = (path) => new URL(path.replace(/^\//, ""), base).href;

/** A window at one size and theme, with what the page complains about collected. */
async function open(
  size,
  theme,
  { view = "simple", setupDismissed = true } = {},
) {
  const phone = size !== "desktop";
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
        localStorage.setItem("gaggimate-daisyui-theme", theme);
        if (!sessionStorage.getItem("verify-seeded")) {
          sessionStorage.setItem("verify-seeded", "1");
          localStorage.setItem("dashboardMode", view);
          if (setupDismissed)
            localStorage.setItem("bettermate.setupDismissed", "true");
        }
      } catch {
        // No storage: the app's defaults apply.
      }
    },
    [theme, view, setupDismissed],
  );
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    // A socket cut by leaving a page is the browser's report, not the page's fault.
    if (message.type() === "error" && !message.text().includes("WebSocket"))
      problems.push(`console: ${message.text()}`);
  });
  return { context, page, problems, size, theme };
}

async function goto(page, path, title) {
  await page.goto(url(path), { waitUntil: "networkidle" });
  if (title)
    await page
      .getByRole("heading", { level: 1, name: title, exact: true })
      .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

// The page scrolls inside <main>, so a picture of all of it needs a taller window.
async function capture(page, name) {
  if (!output) return;
  const viewport = page.viewportSize();
  const height = await page.evaluate(() => {
    const main = document.querySelector("#main");
    return main
      ? window.innerHeight - main.clientHeight + main.scrollHeight
      : 0;
  });
  if (height > viewport.height) {
    await page.setViewportSize({
      width: viewport.width,
      height: Math.min(height, 6000),
    });
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
  const socket = new WebSocket(url("/ws").replace(/^http/, "ws"));
  const state = { status: null };
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.tp === "evt:status")
      state.status = { ...state.status, ...message };
  };
  await new Promise((opened, failed) => {
    socket.onopen = opened;
    socket.onerror = () =>
      failed(new Error(`no machine behind ${base.href}ws`));
  });
  return {
    get status() {
      return state.status;
    },
    send: (message) => socket.send(JSON.stringify(message)),
    async until(test, what, timeout = 15000) {
      const from = Date.now();
      while (Date.now() - from < timeout) {
        if (state.status && test(state.status)) return state.status;
        await new Promise((next) => setTimeout(next, 100));
      }
      throw new Error(`the machine did not reach: ${what}`);
    },
    close: () => socket.close(),
  };
}
const settings = async () => (await fetch(url("/api/settings"))).json();

// ── The shell and its navigation ───────────────────────────────────────────────────────────
async function shell() {
  part = "shell";
  const modeBar = (page) =>
    page.getByRole("navigation", { name: "Machine mode" });
  const current = (page) =>
    page
      .locator('.bm-nav__item[aria-current="page"]')
      .evaluateAll((l) => l.map((e) => e.innerText.trim()));

  // Desktop: the sidebar is the navigation.
  {
    const { context, page, problems } = await open("desktop", "light");
    await goto(page, "/", "Dashboard");
    check(
      (await page.title()).includes("BetterMate"),
      "the document title names BetterMate",
    );
    const nav = page.getByRole("navigation", { name: "Pages" });
    const links = (await nav.getByRole("link").allInnerTexts()).map((t) =>
      t.trim(),
    );
    check(
      links.join() === NAV.join(),
      "desktop: the sidebar holds the four pages",
      links.join(),
    );
    check(
      await page.locator(".bm-topbar").isHidden(),
      "desktop: no top bar beside the sidebar",
    );
    const modes = (await modeBar(page).getByRole("button").allInnerTexts()).map(
      (t) => t.trim(),
    );
    check(
      modes.slice(0, 4).join() === "Standby,Brew,Steam,Water" &&
        modes.length <= 5,
      "the mode bar holds the machine modes",
      modes.join(),
    );
    check(
      await modeBar(page)
        .getByRole("button")
        .evaluateAll((l) =>
          l.every((b) => b.getBoundingClientRect().height >= 44),
        ),
      "every mode is at least 44 px tall",
    );
    check(
      (await modeBar(page).locator('[aria-pressed="true"]').count()) === 1,
      "one mode is selected",
    );
    for (const [name, heading, path] of [
      ["Profiles", "Profiles", "/profiles"],
      ["History", "Shot history", "/history"],
      ["Settings", "Settings", "/settings"],
      ["Dashboard", "Dashboard", "/"],
    ]) {
      await step(
        `desktop: ${name} in the sidebar opens ${heading} and is marked current`,
        async () => {
          await nav.getByRole("link", { name, exact: true }).click();
          await page
            .getByRole("heading", { level: 1, name: heading, exact: true })
            .waitFor();
          if (new URL(page.url()).pathname.replace(/\/general$/, "") !== path)
            throw new Error(`at ${page.url()}`);
          if ((await current(page)).join() !== name)
            throw new Error(`current: ${await current(page)}`);
        },
      );
    }
    await goto(page, "/analyzer", "Analyzer");
    check(
      (await current(page)).join() === "History",
      "the Analyzer belongs to History in the sidebar",
    );
    check(
      (await modeBar(page).count()) === 1,
      "the mode bar floats over the Analyzer",
    );
    await goto(page, "/settings/general", "Settings");
    check(
      (await modeBar(page).count()) === 0,
      "Settings has no mode bar: its Save is pinned there",
    );
    await goto(page, "/profiles/first", "Edit First");
    check(
      (await modeBar(page).count()) === 0,
      "the profile editor has no mode bar",
    );
    await step(
      "the skip link is the first stop and leads to the page",
      async () => {
        await goto(page, "/", "Dashboard");
        await page.keyboard.press("Tab");
        const first = await page.evaluate(() =>
          document.activeElement?.textContent.trim(),
        );
        if (first !== "Skip to content")
          throw new Error(`first stop: ${first}`);
      },
    );
    check(
      problems.length === 0,
      "desktop: no errors while navigating",
      problems.join(" | "),
    );
    await context.close();
  }

  // Phone: the top bar opens the navigation as a menu.
  {
    const { context, page, problems } = await open("phone", "light");
    await goto(page, "/", "Dashboard");
    const panel = page.locator("#navigation");
    const openNav = page.getByRole("button", { name: "Menu", exact: true });
    check(
      await page.locator(".bm-topbar").isVisible(),
      "phone: the top bar is there",
    );
    check(
      !(await panel.isVisible()),
      "phone: the navigation is closed at rest",
    );
    await step(
      "phone: the menu button opens the navigation with the current page focused",
      async () => {
        await openNav.click();
        await page.locator("#navigation.is-open").waitFor();
        await page.waitForTimeout(350);
        const focused = await page.evaluate(() =>
          document.activeElement?.textContent.trim(),
        );
        if (focused !== "Dashboard") throw new Error(`focus on: ${focused}`);
      },
    );
    await capture(page, "phone-navigation");
    await step("phone: Escape closes it", async () => {
      await page.keyboard.press("Escape");
      await page.locator("#navigation:not(.is-open)").waitFor();
    });
    await step(
      "phone: a page chosen from the menu opens and the menu closes",
      async () => {
        await openNav.click();
        await page.locator("#navigation.is-open").waitFor();
        await panel
          .getByRole("link", { name: "Profiles", exact: true })
          .click();
        await page
          .getByRole("heading", { level: 1, name: "Profiles", exact: true })
          .waitFor();
        await page.locator("#navigation:not(.is-open)").waitFor();
      },
    );
    await step(
      "phone: a detail page has Back in place of the menu",
      async () => {
        await goto(page, "/profiles/first", "Edit First");
        if (await openNav.count())
          throw new Error("the menu button is still there");
        await page.getByRole("link", { name: "Back", exact: true }).click();
        await page
          .getByRole("heading", { level: 1, name: "Profiles", exact: true })
          .waitFor();
      },
    );
    await step(
      "phone: Back on the Analyzer leads to Shot history",
      async () => {
        await goto(page, "/analyzer", "Analyzer");
        await page.getByRole("link", { name: "Back", exact: true }).click();
        await page
          .getByRole("heading", { level: 1, name: "Shot history", exact: true })
          .waitFor();
      },
    );
    const bar = await modeBar(page).boundingBox();
    check(
      bar &&
        bar.x >= 0 &&
        bar.x + bar.width <= SIZES.phone.width &&
        bar.y + bar.height <= SIZES.phone.height,
      "phone: the mode bar floats inside the window",
      JSON.stringify(bar),
    );
    check(
      problems.length === 0,
      "phone: no errors while navigating",
      problems.join(" | "),
    );
    await context.close();
  }

  // Setup is the whole window: the shell is not there to be reached.
  for (const size of ["phone", "desktop"]) {
    const { context, page } = await open(size, "light", {
      setupDismissed: false,
    });
    await goto(page, "/setup", "Welcome to BetterMate");
    const chrome = await page
      .locator('#navigation, .bm-topbar, .bm-modebar, a[href="#main"]')
      .count();
    check(
      chrome === 0,
      `${size}, setup: no navigation, top bar, mode bar or skip link`,
      chrome,
    );
    const stops = [];
    for (const key of [
      ...Array(8).fill("Tab"),
      ...Array(8).fill("Shift+Tab"),
    ]) {
      await page.keyboard.press(key);
      stops.push(
        await page.evaluate(() => {
          const at = document.activeElement;
          if (!at || at === document.body) return "the page";
          // Setup is the routed page, inside <main>; the shell's own controls sit outside it.
          return at.closest("#main")
            ? "setup"
            : `outside: ${at.outerHTML.slice(0, 60)}`;
        }),
      );
    }
    check(
      stops.every((stop) => !stop.startsWith("outside")) &&
        stops.includes("setup"),
      `${size}, setup: Tab only visits the step's own controls`,
      stops.filter((stop) => stop.startsWith("outside")).join(" | "),
    );
    await step(
      `${size}, setup: Skip for now leaves for the dashboard, and the shell is back`,
      async () => {
        await page.getByRole("button", { name: "Skip for now" }).click();
        await page
          .getByRole("heading", { level: 1, name: "Dashboard", exact: true })
          .waitFor();
        await modeBar(page).waitFor();
      },
    );
    await context.close();
  }
}

// ── Every page, phone and desktop, light and dark ──────────────────────────────────────────
async function pages() {
  part = "pages";
  for (const size of Object.keys(SIZES)) {
    for (const theme of size === "narrow" ? ["light"] : THEMES) {
      const { context, page, problems } = await open(size, theme);
      for (const [name, path, title] of PAGES) {
        const id = `${name}, ${size} ${theme}`;
        problems.length = 0;
        const loaded = await step(`${id}: loads with its title`, async () => {
          await goto(page, path, title);
          if (path.startsWith("/settings/")) {
            const tab = path.split("/").pop();
            await page.locator(`#panel-${tab} .bm-tile`).first().waitFor();
            await page.waitForTimeout(300);
          }
        });
        if (!loaded) continue;
        const facts = await page.evaluate(() => {
          const root = document.documentElement;
          const main = document.querySelector("#main");
          const probe = document.createElement("i");
          probe.style.background = "var(--surface-0)";
          document.body.append(probe);
          const ground = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const dressed = [...document.querySelectorAll("body *")].filter(
            (element) => {
              const style = getComputedStyle(element);
              return (
                style.boxShadow !== "none" ||
                style.backdropFilter !== "none" ||
                style.filter !== "none" ||
                style.backgroundImage.includes("gradient")
              );
            },
          );
          // A chart is never drawn in a cell: pressure is 2.6:1 on surface-2 in Dark.
          probe.style.background = "var(--surface-2)";
          document.body.append(probe);
          const cell = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const groundOf = (node) => {
            for (; node; node = node.parentElement) {
              const fill = getComputedStyle(node).backgroundColor;
              if (fill !== "rgba(0, 0, 0, 0)" && fill !== "transparent")
                return fill;
            }
            return "";
          };
          const charts = [...document.querySelectorAll(".bm-chartbox canvas")];
          const favourites = document.querySelector(
            '[aria-label="Favourite profiles"]',
          );
          return {
            favouritesSqueezed:
              !!favourites && !favourites.classList.contains("bm-seg--scroll"),
            chartsInCells: charts.filter((canvas) => groundOf(canvas) === cell)
              .length,
            chartsUnnamed: charts.filter(
              (canvas) => !canvas.getAttribute("aria-label"),
            ).length,
            h1: document.querySelectorAll("h1").length,
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
            dressed: dressed
              .slice(0, 3)
              .map((element) => element.outerHTML.slice(0, 80)),
            words: (main || document.body).innerText,
            sidebar: !!document.querySelector("#navigation"),
            modeBar: !!document.querySelector(".bm-modebar"),
            // The design's Notice everywhere: a glyph, then the words; never the old paragraph.
            bareNotices: [...document.querySelectorAll(".bm-notice")].filter(
              (n) => !n.querySelector(":scope > .bm-notice__icon"),
            ).length,
            // One status region, one alert region and one Toast region, from page load on.
            regions: [
              document.querySelectorAll(
                '[role="status"][aria-live="polite"].bm-sr',
              ).length,
              document.querySelectorAll('[role="alert"].bm-sr').length,
              document.querySelectorAll(".bm-toasts").length,
            ].join(),
          };
        });
        check(
          problems.length === 0,
          `${id}: no errors in the console`,
          problems.join(" | "),
        );
        check(facts.h1 === 1, `${id}: one page title`, `${facts.h1} h1`);
        check(
          !facts.favouritesSqueezed,
          `${id}: favourites scroll instead of squeezing`,
        );
        check(
          facts.chartsInCells === 0 && facts.chartsUnnamed === 0,
          `${id}: every chart is named and none is drawn on surface-2`,
          `${facts.chartsInCells} in cells, ${facts.chartsUnnamed} unnamed`,
        );
        check(
          facts.sideways <= 0,
          `${id}: nothing scrolls sideways`,
          `${facts.sideways}px`,
        );
        check(
          facts.theme === theme && facts.ground,
          `${id}: the ${theme} theme is on the page`,
          facts.theme,
        );
        check(
          facts.font.includes("Funnel Display") && facts.faces,
          `${id}: the two bundled faces are loaded`,
          facts.font,
        );
        check(
          facts.dressed.length === 0,
          `${id}: no shadow, blur, filter or gradient`,
          facts.dressed.join(" | "),
        );
        check(
          !/\d\s?(AM|PM)\b/i.test(facts.words),
          `${id}: times are on the 24-hour clock`,
          facts.words.match(/.{0,12}\d\s?(AM|PM)\b/i)?.[0],
        );
        check(
          !/\b(NaN|undefined|null)\b/.test(facts.words),
          `${id}: no reading says NaN or undefined`,
          facts.words.match(/.{0,20}\b(NaN|undefined|null)\b.{0,20}/)?.[0],
        );
        check(
          facts.bareNotices === 0,
          `${id}: every Notice is the design's`,
          facts.bareNotices,
        );
        check(
          facts.regions === "1,1,1",
          `${id}: one status, one alert and one Toast region`,
          facts.regions,
        );
        const shellExpected = path !== "/setup";
        check(
          facts.sidebar === shellExpected &&
            facts.modeBar === (shellExpected && !hidesModeBar(path)),
          `${id}: the shell is ${shellExpected ? "around the page" : "left out"}`,
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
  part = "flows";
  const m = await machine();
  // From rest: standby, the first profile, nothing running.
  m.send({ tp: "req:process:deactivate" });
  m.send({ tp: "req:process:clear" });
  m.send({ tp: "req:profiles:select", id: "first", rid: "verify-first" });
  m.send({ tp: "req:change-mode", mode: 0 });
  await m.until((s) => s.m === 0 && !s.process, "standby with nothing running");

  const { context, page, problems } = await open("desktop", "light");
  const modeBar = page.getByRole("navigation", { name: "Machine mode" });
  const mode = (name) => modeBar.getByRole("button", { name, exact: true });
  const banner = (name) =>
    page.locator("#main button.bm-cta", { hasText: name });
  const dial = page.locator('section[aria-label="Machine"]');
  const chip = (text) =>
    page.waitForFunction(
      (t) =>
        document
          .querySelector('section[aria-label="Machine"] [role="status"]')
          ?.textContent.trim() === t,
      text,
      { timeout: 120000 },
    );
  const eyebrow = async () =>
    (await dial.locator(".bm-tile__head .bm-eyebrow").innerText()).trim();

  await goto(page, "/", "Dashboard");
  await capture(page, "flow-standby");

  // Mode change: each mode of the bar, ending in Brew.
  const shown = (await modeBar.getByRole("button").allInnerTexts()).map((t) =>
    t.trim(),
  );
  const MODE_IDS = { Standby: 0, Brew: 1, Steam: 2, Water: 3, Grind: 4 };
  for (const name of [
    ...shown.filter((n) => !["Standby", "Brew"].includes(n)),
    "Brew",
  ]) {
    await step(
      `mode: ${name} is selected on the machine and on the page`,
      async () => {
        await mode(name).click();
        await m.until((s) => s.m === MODE_IDS[name], `mode ${name}`);
        await page.waitForFunction(
          (label) =>
            [...document.querySelectorAll(".bm-modebar__item")].some(
              (b) =>
                b.textContent.trim() === label &&
                b.getAttribute("aria-pressed") === "true",
            ),
          name,
        );
        await page.waitForFunction(
          (label) =>
            document
              .querySelector(
                'section[aria-label="Machine"] .bm-tile__head .bm-eyebrow',
              )
              ?.textContent.trim()
              .toLowerCase()
              .startsWith(label.toLowerCase()),
          name,
        );
        await page.waitForTimeout(1200);
        await capture(page, `flow-${name.toLowerCase()}`);
      },
    );
  }
  check(
    /^brew · first$/i.test(await eyebrow()),
    "brew: the dial names the mode and the profile",
    await eyebrow(),
  );

  // Target change.
  await step(
    "target: Raise and Lower move the target temperature on the machine and on the page",
    async () => {
      const value = page
        .locator('section[aria-label="Shot setup"] .bm-stepper__value')
        .first();
      const before = (await m.until((s) => s.tt > 0, "a target temperature"))
        .tt;
      await page
        .getByRole("button", { name: "Raise target temperature" })
        .click();
      await m.until((s) => s.tt === before + 1, "target + 1");
      await page.waitForFunction(
        (v) =>
          document
            .querySelector(
              'section[aria-label="Shot setup"] .bm-stepper__value',
            )
            ?.textContent.trim() === v,
        `${before + 1}°`,
      );
      await page
        .getByRole("button", { name: "Lower target temperature" })
        .click();
      await m.until((s) => s.tt === before, "target back");
      await page.waitForFunction(
        (v) =>
          document
            .querySelector(
              'section[aria-label="Shot setup"] .bm-stepper__value',
            )
            ?.textContent.trim() === v,
        `${before}°`,
      );
      if ((await value.innerText()).trim() !== `${before}°`)
        throw new Error(await value.innerText());
    },
  );

  // Start and stop a shot.
  await step("shot: Start shot starts one", async () => {
    await chip("Ready");
    await capture(page, "flow-brew-ready");
    await banner("Start shot").click();
    // The controller may ask first; the sheet's own action starts the shot.
    const sheet = page.getByRole("dialog");
    const asked = await Promise.race([
      sheet.waitFor({ timeout: 2500 }).then(
        () => true,
        () => false,
      ),
      m
        .until((s) => s.process?.a, "a running shot", 2500)
        .then(
          () => false,
          () => false,
        ),
    ]);
    if (asked && !m.status.process?.a)
      await sheet.getByRole("button", { name: "Start anyway" }).click();
    await m.until((s) => s.process?.a, "a running shot");
    await chip("Brewing");
  });
  await step(
    "shot: while it runs the banner is Stop shot with its progress, and the other modes lock",
    async () => {
      await m.until((s) => s.process?.e > 3000, "3 s of shot", 20000);
      const stop = banner("Stop shot");
      if (
        !(await stop.evaluate(
          (el) =>
            el.classList.contains("bm-cta--stop") &&
            !!el.querySelector(".bm-segbar"),
        ))
      )
        throw new Error("the banner is not the ink Stop form with segments");
      // Locked, not disabled (the 2026-11-16 design; Steam locks too, as the user decided): every
      // other mode is aria-disabled, stays focusable, reads its reason, is drawn in ink-faint at
      // full opacity, and a press answers in words without changing the mode.
      const locked = (
        await page
          .locator('.bm-modebar__item[aria-disabled="true"]')
          .allInnerTexts()
      ).map((t) => t.trim());
      if (locked.length !== shown.length - 1 || locked.includes("Brew"))
        throw new Error(`locked: ${locked}`);
      const look = await page.evaluate(() => {
        const item = document.querySelector(
          '.bm-modebar__item[aria-disabled="true"]',
        );
        const probe = document.createElement("i");
        probe.style.color = "var(--ink-faint)";
        document.body.append(probe);
        const faint = getComputedStyle(probe).color;
        probe.remove();
        const reason = document.getElementById(
          item.getAttribute("aria-describedby") || "",
        );
        return {
          disabled: item.disabled,
          faint: getComputedStyle(item).color === faint,
          opacity: getComputedStyle(item).opacity,
          reason: reason?.textContent.trim(),
        };
      });
      if (look.disabled || !look.faint || look.opacity !== "1")
        throw new Error(`locked look: ${JSON.stringify(look)}`);
      if (look.reason !== "Locked while a shot runs.")
        throw new Error(`reason: ${look.reason}`);
      // Reached with the keyboard: a locked mode is still a Tab stop.
      await mode("Steam").focus();
      await page.keyboard.press("Enter");
      await page
        .locator(".bm-toast", { hasText: "Stop the shot to change mode." })
        .waitFor({ timeout: 2000 });
      if (m.status.m !== 1 || !m.status.process?.a)
        throw new Error("a press on a locked mode changed the machine");
      if (
        (await page
          .locator('section[aria-label="Live chart"] canvas')
          .count()) !== 1
      )
        throw new Error("no live chart");
      await capture(page, "flow-brew-active");
    },
  );
  await step("shot: Stop shot stops it, and Start shot is back", async () => {
    await banner("Stop shot").click();
    await m.until((s) => !s.process, "no process");
    await chip("Ready");
    await banner("Start shot").waitFor();
  });

  // Select a profile.
  const row = (name) =>
    page.locator(".profile-card-container").filter({
      has: page.locator(".bm-item__title").getByText(name, { exact: true }),
    });
  const inUse = (name) =>
    page.waitForFunction(
      (label) =>
        document.querySelector('.bm-item[aria-current="true"] .bm-item__title')
          ?.textContent === label,
      name,
    );
  await step(
    "profile: a tap on a row selects it on the machine, and the In use Chip moves",
    async () => {
      await goto(page, "/profiles", "Profiles");
      await inUse("First");
      await capture(page, "flow-profiles");
      await row("Second").locator(".bm-item__main").click();
      await inUse("Second");
      await m.until((s) => s.puid === "second", "profile second");
      if (
        (await row("Second").locator(".bm-chip--ink").count()) !== 1 ||
        (await row("First").locator(".bm-chip--ink").count()) !== 0
      )
        throw new Error("the In use Chip did not move");
    },
  );
  await step(
    "profile: the dashboard names the selected profile, and First is selected again",
    async () => {
      await goto(page, "/", "Dashboard");
      await page.waitForFunction(() =>
        /second$/i.test(
          document
            .querySelector(
              'section[aria-label="Machine"] .bm-tile__head .bm-eyebrow',
            )
            ?.textContent.trim(),
        ),
      );
      await page
        .getByRole("group", { name: "Favourite profiles" })
        .getByRole("button", { name: "First" })
        .click();
      await m.until((s) => s.puid === "first", "profile first");
    },
  );

  // Save a setting and read it back.
  await step(
    "setting: a changed standby timeout is saved, read back from the machine and from the page, and restored",
    async () => {
      const saved = (await settings()).standbyTimeout;
      const next = saved + 60;
      const save = async (value) => {
        await goto(page, "/settings/general", "Settings");
        const field = page.locator("#standbyTimeout");
        await field.waitFor();
        await field.fill(String(value));
        const posted = page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/settings") &&
            r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await posted;
        // Saving ends in a Toast, whose words also reach the status region.
        await page
          .locator(".bm-toast", { hasText: "Settings saved" })
          .waitFor();
        if ((await settings()).standbyTimeout !== value)
          throw new Error(
            `the machine holds ${(await settings()).standbyTimeout}, not ${value}`,
          );
        await goto(page, "/settings/general", "Settings");
        await page.locator("#standbyTimeout").waitFor();
        const shownValue = await page.locator("#standbyTimeout").inputValue();
        if (shownValue !== String(value))
          throw new Error(`the page shows ${shownValue}, not ${value}`);
      };
      await save(next);
      await capture(page, "flow-settings-saved");
      await save(saved);
    },
  );

  // The machine's clock setting is the web's too: off, every time of day reads 2:41 PM.
  await step(
    "clock: with the 24-hour setting off History reads 2:41 PM; on again it reads 14:41",
    async () => {
      const TWELVE = /\b(1[0-2]|[1-9]):[0-5]\d (AM|PM)\b/;
      const save = async (on) => {
        await goto(page, "/settings/general", "Settings");
        const toggle = page.locator("#clock24hFormat");
        await toggle.waitFor();
        await toggle.click();
        const posted = page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/settings") &&
            r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await posted;
        await page
          .locator(".bm-toast", { hasText: "Settings saved" })
          .waitFor();
        if ((await settings()).clock24hFormat !== on)
          throw new Error(`the machine did not take 24-hour ${on}`);
      };
      const history = async () => {
        await goto(page, "/history", "Shot history");
        await page.locator("button.bm-item").first().waitFor();
        return page.locator("#main").innerText();
      };
      if (!(await settings()).clock24hFormat)
        throw new Error("the seeded machine is not on the 24-hour clock");
      await save(false);
      try {
        const words = await history();
        if (!TWELVE.test(words))
          throw new Error(`no 12-hour time on History: ${words.slice(0, 160)}`);
        await capture(page, "flow-clock-12h");
      } finally {
        await save(true);
      }
      const words = await history();
      if (/\d\s?(AM|PM)\b/.test(words))
        throw new Error(
          `still 12-hour: ${words.match(/.{0,12}\d\s?(AM|PM)\b/)?.[0]}`,
        );
    },
  );

  // Open a shot in history.
  await step("history: a row opens its shot with the chart", async () => {
    await goto(page, "/history", "Shot history");
    const rows = page.locator("button.bm-item");
    await rows.first().waitFor();
    await rows.first().click();
    await page.locator("#main canvas").first().waitFor({ timeout: 15000 });
    if ((await rows.first().getAttribute("aria-expanded")) !== "true")
      throw new Error("the row is not open");
    // The Chart card: the canvas says its series, its span and its final values with units.
    const said = await page
      .locator("#main .bm-chartbox canvas")
      .first()
      .getAttribute("aria-label");
    if (
      !/^Shot \d+\. Pressure.* over \d+ seconds\. Final values: [\d.]+ bar/.test(
        said || "",
      )
    )
      throw new Error(`the chart says: ${said}`);
    await page.waitForTimeout(500);
    await capture(page, "flow-history-open");
  });

  // Load a shot in the Analyzer.
  await step(
    "analyzer: a shot picked from the library is charted",
    async () => {
      await goto(page, "/analyzer", "Analyzer");
      await page.locator('[data-slot="shot"] .an-slot__main').first().click();
      await page.locator(".an-lib.is-open").waitFor();
      const shots = page.locator(
        '[data-library-section="shots"] [data-library-row="shot"]',
      );
      await shots.first().waitFor();
      await shots.first().locator(".an-lib__name").click();
      await page
        .locator('[data-chart="shot-main"] canvas')
        .waitFor({ timeout: 20000 });
      const name = (
        await page
          .locator('[data-slot="shot"] .an-slot__name')
          .first()
          .textContent()
      ).trim();
      if (!name) throw new Error("the slot does not name the shot");
      await page.waitForTimeout(800);
      await capture(page, "flow-analyzer-loaded");
    },
  );

  // Run a Statistics query.
  await step("statistics: a query runs and shows its summary", async () => {
    await goto(page, "/statistics", "Statistics");
    await page.locator("[data-statistics-run]").click();
    await page.locator("[data-statistics-summary]").waitFor({ timeout: 30000 });
    const summary = await page.locator("[data-statistics-summary]").innerText();
    if (!/\d/.test(summary))
      throw new Error(`summary: ${summary.slice(0, 80)}`);
    await page.waitForTimeout(500);
    await capture(page, "flow-statistics-built");
  });

  // Back to rest.
  await step("mode: Standby puts the machine to rest", async () => {
    await goto(page, "/", "Dashboard");
    await mode("Standby").click();
    await m.until((s) => s.m === 0, "standby");
  });
  check(
    problems.length === 0,
    "no errors in the console through the flows",
    problems.join(" | "),
  );
  await context.close();
  m.close();
}

// ── Product states and the shared components ───────────────────────────────────────────────
// States the simulator cannot produce on demand are injected into the page's own WebSocket with
// Playwright's routeWebSocket: offline (the socket is refused), a fault (`sys` added to status
// frames), update ready (`up` and a res:ota-settings answer), updating (evt:ota-progress), and a
// command the machine never answers (req:process:activate held back). Nothing reaches the machine
// that a person could not send.
async function states() {
  part = "states";
  const STATUS = (page) => page.locator("#bm-status");
  const ALERT = (page) => page.locator("#bm-alert");
  const modeBar = (page) =>
    page.getByRole("navigation", { name: "Machine mode" });
  const dialChip = (page) =>
    page.locator('section[aria-label="Machine"] .bm-tile__head .bm-chip');
  const dialValue = (page) =>
    page.locator('section[aria-label="Machine"] .bm-dial__value');
  const banner = (page) => page.locator("#main button.bm-cta").first();
  const noticeTitled = (page, title) =>
    page.locator(".bm-notice", {
      has: page.locator(".bm-notice__title", { hasText: title }),
    });

  /** Through the machine, with `edit(message)` on what it says and `hold(message)` on what it hears. */
  async function relay(
    page,
    { edit = (m) => m, hold = () => false, refuse = false } = {},
  ) {
    const sockets = [];
    let attempts = 0;
    await page.routeWebSocket(/\/ws$/, (ws) => {
      attempts += 1;
      if (refuse) {
        ws.close();
        return;
      }
      const server = ws.connectToServer();
      sockets.push(ws);
      server.onMessage((raw) => {
        let message;
        try {
          message = JSON.parse(raw);
        } catch {
          ws.send(raw);
          return;
        }
        const out = edit(message);
        if (out) ws.send(JSON.stringify(out));
      });
      ws.onMessage((raw) => {
        let message;
        try {
          message = JSON.parse(raw);
        } catch {
          server.send(raw);
          return;
        }
        const answer = hold(message);
        if (answer === true) return;
        if (answer) {
          ws.send(JSON.stringify(answer));
          return;
        }
        server.send(raw);
      });
    });
    return {
      say: (message) =>
        sockets.forEach((ws) => ws.send(JSON.stringify(message))),
      get attempts() {
        return attempts;
      },
    };
  }

  const m = await machine();
  m.send({ tp: "req:process:deactivate" });
  m.send({ tp: "req:process:clear" });
  m.send({ tp: "req:change-mode", mode: 0 });
  await m.until((s) => s.m === 0 && !s.process, "standby with nothing running");

  // First reading: the page and every tile at once, a dash for each reading, no skeleton.
  {
    const { context, page } = await open("phone", "light");
    await relay(page, {
      edit: (msg) => (msg.tp === "evt:status" ? null : msg),
    });
    await goto(page, "/", "Dashboard");
    await step(
      "first reading: the Dial shows a dash and unlit ticks, and no skeleton",
      async () => {
        const value = (await dialValue(page).innerText()).trim();
        if (value !== "—") throw new Error(`the dial reads ${value}`);
        const lit = await page
          .locator('section[aria-label="Machine"] .bmf-tick.on')
          .count();
        const dressed = await page
          .locator('section[aria-label="Machine"] .bm-skeleton, .bm-loader')
          .count();
        if (lit || dressed)
          throw new Error(`${lit} lit ticks, ${dressed} skeletons or loaders`);
      },
    );
    check(
      (await STATUS(page).innerText()) === "" &&
        (await ALERT(page).innerText()) === "",
      "first reading: the status and alert regions are there and quiet",
    );
    await capture(page, "state-first-reading");
    await context.close();
  }

  // Connecting, then Offline after 5 s.
  {
    const { context, page } = await open("phone", "light");
    const link = await relay(page, { refuse: true });
    await page.goto(url("/"), { waitUntil: "domcontentloaded" });
    await step("connecting: a neutral Notice with a Loader", async () => {
      const notice = noticeTitled(page, "Connecting to the machine");
      await notice.waitFor({ timeout: 4000 });
      if (!(await notice.locator(".bm-loader").count()))
        throw new Error("no Loader");
      if (await notice.evaluate((n) => /--(danger|warning)/.test(n.className)))
        throw new Error("not neutral");
    });
    await capture(page, "state-connecting");
    await step(
      "offline: after 5 s a danger Notice that interrupts, without a TRY AGAIN of its own on the Dashboard",
      async () => {
        const notice = noticeTitled(page, "The machine is offline");
        await notice.waitFor({ timeout: 6000 });
        if ((await notice.getAttribute("role")) !== "alert")
          throw new Error("not role=alert");
        if (
          !(await notice.evaluate((n) =>
            n.classList.contains("bm-notice--danger"),
          ))
        )
          throw new Error("not danger");
        const buttons = await notice.getByRole("button").count();
        if (buttons) throw new Error(`${buttons} buttons in the Notice`);
      },
    );
    await step(
      "offline: OFFLINE Chip, a dash in the Dial, TRY AGAIN on the banner",
      async () => {
        const chip = (await dialChip(page).innerText()).trim().toLowerCase();
        const value = (await dialValue(page).innerText()).trim();
        const label = (await banner(page).locator(".bm-cta__label").innerText())
          .trim()
          .toLowerCase();
        if (chip !== "offline" || value !== "—" || label !== "try again")
          throw new Error(`chip ${chip}, dial ${value}, banner ${label}`);
      },
    );
    await step("offline: every mode is locked and says why", async () => {
      const items = await modeBar(page)
        .locator(".bm-modebar__item")
        .evaluateAll((l) =>
          l.map((b) => ({
            pressed: b.getAttribute("aria-pressed"),
            locked: b.getAttribute("aria-disabled"),
          })),
        );
      if (items.some((i) => i.pressed !== "true" && i.locked !== "true"))
        throw new Error(JSON.stringify(items));
      const reason = await page.locator("#modebar-lock").innerText();
      if (reason !== "Locked while the machine is offline.")
        throw new Error(reason);
    });
    await step(
      "offline: TRY AGAIN opens a new connection at once",
      async () => {
        const before = link.attempts;
        await banner(page).click();
        await page.waitForTimeout(400);
        if (link.attempts <= before) throw new Error("no new attempt");
      },
    );
    await capture(page, "state-offline");
    await step(
      "offline: in Settings the Notice says TRY AGAIN, and Save is disabled and says why",
      async () => {
        await page.goto(url("/settings/general"), {
          waitUntil: "domcontentloaded",
        });
        const notice = noticeTitled(page, "The machine is offline");
        await notice.waitFor({ timeout: 8000 });
        // No ActionBanner here, so the Notice carries TRY AGAIN.
        await notice.getByRole("button", { name: "Try again" }).waitFor();
        const save = page.locator(".bm-pinned button");
        await save.waitFor();
        if (!(await save.isDisabled())) throw new Error("Save is enabled");
        await page
          .locator(".bm-pinned")
          .getByText("The machine is offline. Save once it is back.")
          .waitFor();
      },
    );
    await context.close();
  }

  // A blocking fault: the controller reports a temperature runaway.
  {
    const { context, page } = await open("phone", "dark");
    await relay(page, {
      edit: (msg) =>
        msg.tp === "evt:status"
          ? {
              ...msg,
              sys: { s: "error", m: "Temperature error, restart...", c: 4 },
            }
          : msg,
    });
    await goto(page, "/", "Dashboard");
    await step(
      "fault: a danger Notice first, a FAULT Chip, the banner disabled and saying why",
      async () => {
        const notice = noticeTitled(page, "Boiler temperature runaway");
        await notice.waitFor();
        const first = await page.evaluate(() =>
          document
            .querySelector("#main .bm-page > div > div > *")
            ?.classList.contains("bm-notice"),
        );
        if (!first) throw new Error("the Notice is not first on the page");
        const chip = (await dialChip(page).innerText()).trim().toLowerCase();
        const sub = (
          await banner(page).locator(".bm-cta__sub").innerText()
        ).trim();
        if (
          chip !== "fault" ||
          !(await banner(page).isDisabled()) ||
          sub !== "Fix the fault to brew"
        )
          throw new Error(`chip ${chip}, banner ${sub}`);
      },
    );
    await step(
      "fault: only Standby is left, the rest locked until the fault is fixed",
      async () => {
        const locked = (
          await modeBar(page).locator('[aria-disabled="true"]').allInnerTexts()
        ).map((t) => t.trim());
        const pressed = (
          await modeBar(page).locator('[aria-pressed="true"]').innerText()
        ).trim();
        const reason = await page.locator("#modebar-lock").innerText();
        if (
          pressed !== "Standby" ||
          locked.includes("Standby") ||
          reason !== "Locked until the fault is fixed."
        )
          throw new Error(`pressed ${pressed}, locked ${locked}, ${reason}`);
      },
    );
    await capture(page, "state-fault");
    await context.close();
  }

  // The controller is not on the one release BetterMate works with. A newer controller names the
  // release and offers no way out through Settings; an older one links to the update.
  for (const [side, message, title, text, linked] of [
    [
      "newer",
      "Version mismatch, update display",
      "The controller is newer than BetterMate supports",
      "Put the controller back on GaggiMate v1.9.0.",
      false,
    ],
    [
      "older",
      "Version mismatch, update controller",
      "The controller needs an update",
      "Brewing is off until the controller is on v1.9.0.",
      true,
    ],
  ]) {
    const { context, page } = await open("phone", "dark");
    await relay(page, {
      edit: (msg) =>
        msg.tp === "evt:status"
          ? { ...msg, sys: { s: "mismatch", m: message, c: 0 } }
          : msg,
    });
    await goto(page, "/", "Dashboard");
    await step(
      `mismatch, ${side} controller: the Notice names v1.9.0${linked ? " and opens updates" : " and has no link"}`,
      async () => {
        const notice = noticeTitled(page, title);
        await notice.waitFor();
        const words = await notice.innerText();
        const links = await notice.getByRole("link").allInnerTexts();
        if (!words.includes(text)) throw new Error(words);
        if (linked !== links.some((l) => /open updates/i.test(l)))
          throw new Error(`links: ${links.join() || "none"}`);
      },
    );
    await capture(page, `state-mismatch-${side}`);
    await context.close();
  }

  // Hardware not present: no scale (`bta` false). Simple leaves the weight out; Advanced keeps its
  // tile with an EmptyState; the choice of stopping by weight shows Time, disabled, with the reason.
  for (const size of ["phone", "desktop"]) {
    const { context, page, problems } = await open(size, "light", {
      view: "advanced",
    });
    await relay(page, {
      edit: (msg) => (msg.tp === "evt:status" ? { ...msg, bta: false } : msg),
    });
    m.send({ tp: "req:change-mode", mode: 1 });
    await m.until((s) => s.m === 1, "brew");
    await goto(page, "/", "Dashboard");
    await step(
      `no scale: the Weight tile keeps its title and says what is missing, with one button (${size})`,
      async () => {
        const tile = page.locator(".bm-tile", {
          has: page.locator(".bm-empty__title", {
            hasText: "No scale connected",
          }),
        });
        await tile.waitFor({ timeout: 4000 });
        const title = (await tile.locator(".bm-tile__head").innerText()).trim();
        if (title.toLowerCase() !== "weight")
          throw new Error(`titled ${title}`);
        const link = tile.getByRole("link", { name: "Pair a scale" });
        if ((await link.getAttribute("href")) !== "/settings/bluetooth")
          throw new Error("no link to pair a scale");
      },
    );
    await step(
      `no scale: stop shot by shows Time, disabled, and says why (${size})`,
      async () => {
        const group = page.getByRole("group", { name: "Stop shot by" });
        const time = group.getByRole("button", { name: "Time" });
        const weight = group.getByRole("button", { name: "Weight" });
        if ((await time.getAttribute("aria-pressed")) !== "true")
          throw new Error("Time is not chosen");
        if (!(await weight.isDisabled()))
          throw new Error("Weight can be chosen");
        const help = await group.getAttribute("aria-describedby");
        const reason =
          help && (await page.locator(`[id="${help}"]`).innerText());
        if (reason !== "Connect a scale to use this.")
          throw new Error(`help: ${reason}`);
      },
    );
    await capture(page, `state-no-scale-${size}`);
    await page.evaluate(() => localStorage.setItem("dashboardMode", "simple"));
    await goto(page, "/", "Dashboard");
    await step(`no scale: Simple leaves the weight out (${size})`, async () => {
      await page.locator(".home-reading").first().waitFor();
      const empty = await page
        .locator(".bm-empty", {
          hasText: "No scale connected",
        })
        .count();
      const weight = await page
        .locator(".home-reading", {
          hasText: /^Weight/i,
        })
        .count();
      if (empty || weight) throw new Error(`${empty} empty, ${weight} weight`);
    });
    m.send({ tp: "req:change-mode", mode: 0 });
    await m.until((s) => s.m === 0, "standby");
    check(
      problems.length === 0,
      `no scale: no errors in the console (${size})`,
      problems.join(" | "),
    );
    await context.close();
  }

  // A command the machine does not confirm: STARTING, then the banner returns and a Toast says so.
  {
    const { context, page, problems } = await open("phone", "light");
    await relay(page, { hold: (msg) => msg.tp === "req:process:activate" });
    await goto(page, "/", "Dashboard");
    m.send({ tp: "req:change-mode", mode: 1 });
    await m.until((s) => s.m === 1, "brew");
    await page
      .locator("#main button.bm-cta", { hasText: "Start shot" })
      .waitFor();
    await page.waitForTimeout(600);
    await banner(page).click();
    await step(
      "command pending: STARTING with a Loader in the disc and aria-busy, modes locked",
      async () => {
        const label = (await banner(page).locator(".bm-cta__label").innerText())
          .trim()
          .toLowerCase();
        const busy = await banner(page).getAttribute("aria-busy");
        const loader = await banner(page)
          .locator(".bm-cta__disc .bm-loader")
          .count();
        const locked = await modeBar(page)
          .locator('[aria-disabled="true"]')
          .count();
        if (label !== "starting" || busy !== "true" || !loader || !locked)
          throw new Error(
            `${label}, busy ${busy}, loader ${loader}, locked ${locked}`,
          );
      },
    );
    await capture(page, "state-starting");
    await step(
      "command pending: after 2 s the banner returns and a Toast says the machine did not answer",
      async () => {
        await page
          .locator(".bm-toast", {
            hasText: "The machine did not answer. Try again.",
          })
          .waitFor({ timeout: 3000 });
        await page
          .locator("#main button.bm-cta", { hasText: "Start shot" })
          .waitFor({ timeout: 1000 });
        if (
          (await ALERT(page).innerText()) !==
          "The machine did not answer. Try again."
        )
          throw new Error(`alert region: ${await ALERT(page).innerText()}`);
        if (m.status.process?.a) throw new Error("a shot started");
      },
    );
    await capture(page, "state-no-answer");
    await step("the status region names a mode change", async () => {
      await modeBar(page)
        .getByRole("button", { name: "Steam", exact: true })
        .click();
      await m.until((s) => s.m === 2, "steam");
      await page.waitForFunction(
        () => document.querySelector("#bm-status")?.textContent === "Steam.",
        null,
        {
          timeout: 4000,
        },
      );
    });
    m.send({ tp: "req:change-mode", mode: 0 });
    await m.until((s) => s.m === 0, "standby");
    check(
      problems.length === 0,
      "command pending: no errors in the console",
      problems.join(" | "),
    );
    await context.close();
  }

  // Update ready, at the top of Settings and nowhere else; then updating takes the window.
  {
    const { context, page } = await open("desktop", "light");
    const link = await relay(page, {
      edit: (msg) => (msg.tp === "evt:status" ? { ...msg, up: true } : msg),
      hold: (msg) =>
        msg.tp === "req:ota-settings"
          ? {
              tp: "res:ota-settings",
              latestVersion: "1.8.0",
              displayVersion: "1.7.2",
              controllerVersion: "1.7.2",
              displayUpdateAvailable: true,
              controllerUpdateAvailable: false,
              channel: "latest",
            }
          : msg.tp === "req:ota-start",
    });
    await goto(page, "/", "Dashboard");
    check(
      (await page.locator(".bm-notice--info").count()) === 0,
      "update ready: nothing on the Dashboard",
    );
    await goto(page, "/settings/general", "Settings");
    await step(
      "update ready: an info Notice names the version with INSTALL",
      async () => {
        const notice = noticeTitled(page, "Version 1.8.0 is ready");
        await notice.waitFor();
        if (
          !(await notice.evaluate((n) =>
            n.classList.contains("bm-notice--info"),
          ))
        )
          throw new Error("not info");
        await notice.getByRole("button", { name: "Install" }).waitFor();
      },
    );
    await capture(page, "state-update-ready");
    await step(
      "updating: one tile takes the window, with its percentage and no way out",
      async () => {
        await noticeTitled(page, "Version 1.8.0 is ready")
          .getByRole("button", { name: "Install" })
          .click();
        link.say({ tp: "evt:ota-progress", phase: 1, progress: 42 });
        await page
          .getByRole("heading", { level: 1, name: "Updating" })
          .waitFor();
        const chrome = await page
          .locator('#navigation, .bm-topbar, .bm-modebar, a[href="#main"]')
          .count();
        const text = await page.locator("#main").innerText();
        if (chrome) throw new Error(`${chrome} shell controls`);
        if (
          !/42/.test(text) ||
          !/Keep the machine on/.test(text) ||
          !/1\.8\.0/.test(text)
        )
          throw new Error(text);
      },
    );
    await capture(page, "state-updating");
    await step(
      "update failed: the shell is back with a danger Notice",
      async () => {
        link.say({ tp: "evt:ota-progress", phase: 5, progress: 0 });
        await noticeTitled(page, "The update failed").waitFor();
        await page.locator("#navigation").waitFor();
      },
    );
    await context.close();
  }

  // Nothing to list, a Dialog, a NumberField.
  {
    const { context, page, problems } = await open("phone", "light");
    await goto(page, "/profiles", "Profiles");
    await step(
      "nothing to list: a search with no match is an EmptyState with one Button",
      async () => {
        await page.getByLabel("Search profiles").fill("zzz");
        const empty = page.locator(".bm-empty");
        await empty.waitFor();
        const title = (
          await empty.locator(".bm-empty__title").innerText()
        ).trim();
        if (title !== "No profiles match “zzz”") throw new Error(title);
        if ((await empty.locator(".bm-btn").count()) !== 1)
          throw new Error("not one Button");
        await capture(page, "state-nothing-to-list");
        await empty.getByRole("button", { name: "Clear search" }).click();
      },
    );
    await step(
      "dialog: deleting a profile asks first, focus on Keep, Escape keeps it",
      async () => {
        const opener = page.getByRole("button", { name: "Actions for Second" });
        await opener.click();
        await page.getByRole("menuitem", { name: "Delete profile" }).click();
        const dialog = page.getByRole("alertdialog", {
          name: "Delete Second?",
        });
        await dialog.waitFor();
        await page.waitForTimeout(300);
        const focused = await page.evaluate(() =>
          document.activeElement?.textContent.trim(),
        );
        if (focused !== "Keep") throw new Error(`focus on ${focused}`);
        if (!(await page.locator("#app").evaluate((app) => app.inert)))
          throw new Error("the page is not inert");
        await capture(page, "state-dialog");
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
        await page.locator(".bm-item__title", { hasText: "Second" }).waitFor();
      },
    );
    await step(
      "number field: decimal keyboard, the unit said in words, a range said on leaving",
      async () => {
        await goto(page, "/profiles/first", "Edit First");
        const field = page.locator("#temperature");
        const facts = await field.evaluate((input) => ({
          type: input.type,
          mode: input.inputMode,
          unit: [...(input.getAttribute("aria-describedby") || "").split(" ")]
            .map((id) => document.getElementById(id)?.textContent)
            .join(" "),
        }));
        if (
          facts.type !== "text" ||
          facts.mode !== "decimal" ||
          !/degrees Celsius/.test(facts.unit)
        )
          throw new Error(JSON.stringify(facts));
        const was = await field.inputValue();
        await field.focus();
        await page.keyboard.press("ArrowUp");
        // One step up: the field's step, 0.1 or 1.
        const by =
          Math.round((Number(await field.inputValue()) - Number(was)) * 10) /
          10;
        if (by !== 0.1 && by !== 1)
          throw new Error(`Up made ${await field.inputValue()} of ${was}`);
        await field.fill("400");
        await page.keyboard.press("Tab");
        await page
          .locator("#temperature-error")
          .getByText(/^Enter .* to .*°C\.$/)
          .waitFor();
        if ((await field.getAttribute("aria-invalid")) !== "true")
          throw new Error("not invalid");
      },
    );
    check(
      problems.length === 0,
      "components: no errors in the console",
      problems.join(" | "),
    );
    await context.close();
  }
  m.close();
}

// ── Run ────────────────────────────────────────────────────────────────────────────────────
const PARTS = { shell, pages, flows, states };
let crashed = null;
try {
  for (const name of Object.keys(PARTS))
    if (only.includes(name)) await PARTS[name]();
} catch (error) {
  crashed = error;
  part = part || "run";
  check(false, "the run ended early", error.stack || error);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`web UI at ${base.href}`);
for (const name of Object.keys(PARTS)) {
  const mine = results.filter((r) => r.part === name);
  if (mine.length)
    console.log(
      `${name}: ${mine.filter((r) => r.ok).length}/${mine.length} passed`,
    );
}
console.log(
  `${results.length - failed.length} passed, ${failed.length} failed`,
);
if (output) {
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        base: base.href,
        assertions: results.length,
        failed: failed.length,
        results,
      },
      null,
      2,
    ),
  );
}
process.exit(failed.length || crashed ? 1 : 0);

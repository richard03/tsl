/**
 * Loads every HTML component listed in components.yaml / widgets.yaml through the real runtime and fails on the
 * first one that doesn't parse, compile or execute.
 *
 * These files are no longer covered by `tsc`, so this is the gate that replaces it: it catches
 * template syntax errors, the HTML-parser traps, missing `watch` on effects, and broken `<script>`
 * blocks — before a broken file reaches a respondent.
 *
 * Usage: node scripts/check-html-components.cjs [port]
 * Requires the dev server (or a preview server) to be running on that port.
 */
const { chromium } = require("playwright");

const port = process.argv[2] || "5200";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("[html-komponenta]")) failures.push(m.text());
  });
  page.on("pageerror", (e) => failures.push(String(e)));

  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(1500);

  // Every component is registered by now; a failed one is registered as an error placeholder.
  const report = await page.evaluate(async () => {
    const base = document.querySelector("base")?.href ?? location.href;
    const read = async (file) => {
      const res = await fetch(new URL(file, base), { cache: "no-store" });
      if (!res.ok) return [];
      return [...(await res.text()).matchAll(/^\s*-\s*(\S+)\s*$/gm)].map((m) => m[1]);
    };
    const components = await read("components.yaml");
    const widgets = await read("widgets.yaml");
    return { components: components.length, widgets: widgets.length };
  });

  if (failures.length > 0) {
    console.error(`\n${failures.length} HTML komponent se nenačetlo:\n`);
    for (const f of failures) console.error(`  ${f}`);
    console.error("");
    await browser.close();
    process.exit(1);
  }

  console.log(
    `OK — ${report.components} komponent a ${report.widgets} widgetů se načetlo a zkompilovalo bez chyby.`,
  );
  await browser.close();
})();

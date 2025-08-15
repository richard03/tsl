/**
 * Ověří, že příklady v dokumentaci odpovídají ukázkovému prototypu.
 *
 * Dokumentace vysvětluje engine na projektu `demo`. Nic ji ale nenutí s ním držet krok — a když se
 * rozejde, čtenář se řídí něčím, co neexistuje. (Přesně to se stalo s README ve složce resources,
 * které roky ukazovalo konfiguraci obrazovky v JSON, dávno po přechodu na YAML.)
 *
 * Kontroluje se:
 *  - názvy komponent a widgetů v ukázkách proti components.yaml / widgets.yaml
 *  - id obrazovek proti public/screens/
 *  - cesty `public/...` proti souborům na disku
 *  - že se nikde nemluví o prototypu konsolidace
 *
 *   node scripts/check-docs.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEMO = path.join(ROOT, "projects", "demo", "public");
const DOCS = [path.join(ROOT, "README.md"), ...fs.readdirSync(path.join(ROOT, "docs")).map((f) => path.join(ROOT, "docs", f))];

let fail = 0;
const problem = (file, msg) => {
  fail++;
  console.log(`  FAIL ${path.relative(ROOT, file)}: ${msg}`);
};

const listOf = (file) =>
  new Set(
    fs
      .readFileSync(path.join(DEMO, file), "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim().startsWith("- "))
      .map((l) => l.trim().slice(2).trim()),
  );

const components = listOf("components.yaml");
const widgets = listOf("widgets.yaml");
const screens = new Set(fs.readdirSync(path.join(DEMO, "screens")).map((f) => f.replace(/\.yaml$/, "")));

/** Jména, která nejsou komponenty ani widgety, ale v ukázkách se legitimně objeví. */
const NOT_COMPONENTS = new Set(["Widget", "AppShell", "StrictMode"]);

for (const file of DOCS) {
  const text = fs.readFileSync(file, "utf8");

  if (/konsolidac[ei]|ČSOB/i.test(text)) {
    problem(file, "zmiňuje prototyp konsolidace — dokumentace má vysvětlovat engine na demu");
  }

  /**
   * Jména prvků se hledají jen uvnitř bloků ```yaml — v běžném textu je odrážka větou
   * („- Uzel struktury má tvar…") a velké písmeno na jejím začátku není název komponenty.
   */
  const yamlBlocks = [...text.matchAll(/```yaml\r?\n([\s\S]*?)```/g)].map((m) => m[1]).join("\n");

  for (const m of yamlBlocks.matchAll(/^\s*-\s+(Widget\s+)?([A-Z][A-Za-z0-9]*)\b/gm)) {
    const [, isWidget, name] = m;
    if (NOT_COMPONENTS.has(name)) continue;
    if (isWidget) {
      if (!widgets.has(name)) problem(file, `widget "${name}" není ve widgets.yaml dema`);
    } else if (!components.has(name) && !widgets.has(name)) {
      problem(file, `komponenta "${name}" není v components.yaml dema`);
    } else if (widgets.has(name)) {
      problem(file, `"${name}" je widget — v ukázce musí být s prefixem "Widget"`);
    }
  }

  // Odkazy na obrazovky: `01-intro`, `04-products`…
  for (const m of text.matchAll(/`(\d\d-[a-z-]+)`/g)) {
    if (!screens.has(m[1])) problem(file, `obrazovka "${m[1]}" v demu neexistuje`);
  }

  // Cesty do public/ musí existovat (bez zástupných znaků).
  for (const m of text.matchAll(/`(public\/[A-Za-z0-9_./-]+)`/g)) {
    const rel = m[1];
    if (rel.includes("*") || rel.endsWith("/")) continue;
    if (!fs.existsSync(path.join(DEMO, rel.slice("public/".length)))) {
      problem(file, `cesta "${rel}" v demu neexistuje`);
    }
  }
}

console.log(
  fail === 0
    ? `\n=== ALL PASS (${DOCS.length} souborů, ${components.size} komponent, ${widgets.size} widgetů, ${screens.size} obrazovek) ===`
    : `\n=== ${fail} PROBLÉMŮ ===`,
);
process.exit(fail === 0 ? 0 : 1);

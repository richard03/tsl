/**
 * Průchod celou výukovou trasou ukázkového prototypu.
 *
 * Demo je učebnice enginu a zároveň jediný zdroj příkladů v dokumentaci — když se rozbije, začne
 * dokumentace lhát. Test proto projde obrazovky tak, jak jimi jde čtenář, a na každé ověří, že se
 * vlastnost, kterou má předvádět, opravdu projevila.
 *
 *   node projects/demo/scripts/check-flow.cjs [port]
 */
const { chromium } = require("playwright");

const port = process.argv[2] || "5320";

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

/** Respondent, jakého by moderátor zadal ve formuláři. */
const RESPONDENT = {
  name: "Jan Novák",
  segment: "premium",
  creditLimit: 120000,
  showTransactions: true,
  products: [
    { id: "p1", type: "ucet", name: "Běžný účet", balance: 34120, active: true },
    { id: "p2", type: "pojisteni", name: "Životní pojištění", balance: 780, active: true },
    { id: "p4", type: "karta", name: "Kreditní karta", balance: -12400, active: true },
    { id: "p3", type: "uver", name: "Spotřebitelský úvěr", balance: -240000, active: false },
  ],
};

async function open(browser, screenId, respondent = RESPONDENT) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    // Varování o kolizi názvu `Button` s HTML značkou je očekávané a popsané v dokumentaci.
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(
    ({ respondent, screenId }) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("prototyper.demo.respondent", JSON.stringify(respondent));
      localStorage.setItem("prototyper.demo.currentScreenId", screenId);
    },
    { respondent, screenId },
  );
  await page.goto(`http://localhost:${port}/${screenId}`);
  await page
    .waitForFunction(() => {
      const el = document.querySelector(".phone");
      return el && el.innerText.trim() && !el.innerText.trim().startsWith("Načítání");
    }, { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

const textOf = (page) => page.locator(".phone").innerText();

(async () => {
  const browser = await chromium.launch();

  console.log("01-intro — struktura, atributy, překlady");
  {
    const { ctx, page, errors } = await open(browser, "01-intro");
    const text = await textOf(page);
    check("nadpis z translations.properties", text.includes("Ukázkový prototyp"), text.slice(0, 60));
    check("tlačítko má popisek", text.includes("Začít"));
    check("bez chyb v konzoli", errors.length === 0, errors[0]);
    await ctx.close();
  }

  console.log("\n02-login — pole, validace, zablokované odeslání");
  {
    const { ctx, page, errors } = await open(browser, "02-login");
    check("dvě vstupní pole", (await page.locator(".co-field__input").count()) === 2);
    check("popisek vysvětluje validaci a ukládání", (await textOf(page)).includes("validac"), (await textOf(page)).slice(0, 80));

    await page.locator('button:has-text("Přihlásit se")').click();
    await page.waitForTimeout(500);
    check("prázdný formulář nepustí dál", (await page.url()).endsWith("/02-login"));
    check("ukáže chyby u polí", (await page.locator(".co-field__error").count()) === 2);

    await page.locator(".co-field__input").nth(0).fill("jan@example.com");
    await page.locator(".co-field__input").nth(1).fill("tajne");
    await page.waitForTimeout(300);
    check("po vyplnění chyby zmizí", (await page.locator(".co-field__error").count()) === 0);
    check("bez chyb v konzoli", errors.length === 0, errors[0]);
    await ctx.close();
  }

  console.log("\n03-dashboard — vnořování, $bind, $visibleIf, rozcestník");
  {
    const { ctx, page, errors } = await open(browser, "03-dashboard");
    const text = await textOf(page);
    check("pozdrav se navázal na jméno respondenta", text.includes("Jan Novák"), text.slice(0, 60));
    check("dlaždice mají vnořený obsah", (await page.locator(".co-tile .co-text").count()) >= 4);
    check("dlaždice transakcí je vidět", text.includes("Transakce"));

    await page.locator(".co-tile").first().click();
    await page.waitForTimeout(2000);
    check("klik na dlaždici vede na produkty", (await page.url()).endsWith("/04-products"));
    check("bez chyb v konzoli", errors.length === 0, errors[0]);
    await ctx.close();
  }

  console.log("\n03-dashboard — $visibleIf skryje dlaždici");
  {
    const { ctx, page } = await open(browser, "03-dashboard", { ...RESPONDENT, showTransactions: false });
    const text = await textOf(page);
    check("bez showTransactions se dlaždice neukáže", !text.includes("Posledních pár pohybů"), text.slice(0, 80));
    await ctx.close();
  }

  console.log("\n04-products — widget nad respondentem a filtr where");
  {
    const { ctx, page, errors } = await open(browser, "04-products");
    const rows = await page.locator(".co-data-row__label").allTextContents();
    check("aktivní služby se vypsaly", rows.includes("Běžný účet") && rows.includes("Životní pojištění"), JSON.stringify(rows));
    check("neaktivní je v druhé skupině", rows.includes("Spotřebitelský úvěr"), JSON.stringify(rows));
    const values = await page.locator(".co-data-row__value").allTextContents();
    check("částky prošly přes business.js", values.some((v) => v.replace(/ /g, " ") === "34 120 Kč"), JSON.stringify(values));
    check("záporný zůstatek je zvýrazněný", (await page.locator(".co-data-row__value--negative").count()) >= 1);
    check("bez chyb v konzoli", errors.length === 0, errors[0]);
    await ctx.close();
  }

  console.log("\n05-transactions — widget nad datovým souborem");
  {
    const { ctx, page, errors } = await open(browser, "05-transactions");
    await page.waitForSelector(".co-data-row", { timeout: 10000 });
    const rows = await page.locator(".co-data-row__label").allTextContents();
    check("položky přišly z data/transactions.yaml", rows.some((r) => r.includes("Nákup potravin")), JSON.stringify(rows.slice(0, 2)));
    check("limit ořízl seznam na 5", rows.length === 5, String(rows.length));
    check("datum je naformátované", rows[0].startsWith("14. 3. 2026"), rows[0]);
    check("příjem je zvýrazněný jinak než výdaj", (await page.locator(".co-data-row__value--positive").count()) >= 1);
    check("bez chyb v konzoli", errors.length === 0, errors[0]);
    await ctx.close();
  }

  console.log("\n06-settings — setData, $visibleIf, $disabledIf");
  {
    const { ctx, page, errors } = await open(browser, "06-settings");
    check("nápověda je vidět, dokud není vybráno", (await textOf(page)).includes("Nejdřív si vyberte"));
    check("potvrzení je zakázané", await page.locator('button:has-text("Uložit nastavení")').isDisabled());

    await page.locator(".co-select-field__select").selectOption("sms");
    await page.waitForTimeout(400);
    check("po výběru nápověda zmizí", !(await textOf(page)).includes("Nejdřív si vyberte"));
    check("a potvrzení se povolí", !(await page.locator('button:has-text("Uložit nastavení")').isDisabled()));

    await page.locator('button:has-text("Uložit nastavení")').click();
    await page.waitForTimeout(400);
    check("setData zobrazí potvrzení", (await textOf(page)).includes("Nastavení bylo uloženo"));
    check("bez chyb v konzoli", errors.length === 0, errors[0]);
    await ctx.close();
  }

  console.log("\nPřihlášení vede vždy na rozcestník");
  {
    const { ctx, page } = await open(browser, "02-login");
    await page.locator(".co-field__input").nth(0).fill("jan@example.com");
    await page.locator(".co-field__input").nth(1).fill("tajne");
    await page.locator('button:has-text("Přihlásit se")').click();
    await page.waitForTimeout(2000);
    check("po přihlášení následuje přehled", (await page.url()).endsWith("/03-dashboard"), await page.url());
    await ctx.close();
  }

  console.log("\nVětvení flow podle nastavení respondenta");
  {
    const { ctx, page } = await open(browser, "04-products");
    await page.locator('button:has-text("Pokračovat")').click();
    await page.waitForTimeout(2000);
    check("se zapnutými transakcemi vede dál na ně", (await page.url()).endsWith("/05-transactions"), await page.url());
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, "04-products", { ...RESPONDENT, showTransactions: false });
    await page.locator('button:has-text("Pokračovat")').click();
    await page.waitForTimeout(2000);
    check("bez nich se transakce přeskočí", (await page.url()).endsWith("/06-settings"), await page.url());
    await ctx.close();
  }

  console.log("\nDlaždice produktů podle podmínky some:");
  {
    const { ctx, page } = await open(browser, "03-dashboard", { ...RESPONDENT, products: [] });
    check("bez aktivní služby se dlaždice neukáže", !(await textOf(page)).includes("Moje produkty"), (await textOf(page)).slice(0, 80));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${fail === 0 ? `=== ALL PASS (${pass} ok) ===` : `=== ${fail} FAILED (${pass} ok) ===`}`);
  process.exit(fail === 0 ? 0 : 1);
})();

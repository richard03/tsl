/*
 * BYZNYS PRAVIDLA UKÁZKOVÉHO PROTOTYPU
 * ====================================
 *
 * Jediné místo, kde je popsáno, jak se prototyp rozhoduje a jak zobrazuje hodnoty.
 *
 * Soubor se načítá za běhu — stejně jako `flow.yaml`, obrazovky nebo `translations.properties`.
 * Změna pravidla je tedy úprava tohoto souboru a nahrání na server; **žádný build.**
 *
 * Vše, co je odsud vyexportované, je v komponentách a widgetech dostupné jako `lib.<jméno>`
 * (např. `lib.formatMoney(...)`). Engine k tomu přidává vlastní obecné pomocníky:
 *   matchesItem, getValidationError, onlyDigits, formatThousands, fillTemplate, loadDataFile
 *
 * Pozor: je to samostatný modul. Nemůže nic importovat — všechno, co potřebuje, musí být tady.
 */

// ---------------------------------------------------------------------------
// ZOBRAZENÍ HODNOT
// ---------------------------------------------------------------------------

/** Částka v korunách, zaokrouhlená na celé koruny — např. 12345.6 → "12 346 Kč". */
export function formatMoney(amount) {
  return `${Math.round(amount).toLocaleString("cs-CZ")} Kč`;
}

/**
 * Částka i se znaménkem, jak se hodí do výpisu transakcí.
 *
 * Příjem se odlišuje plusem, výdaj má minus už v samotném čísle — proto se přidává jen u kladných.
 */
export function formatAmount(amount) {
  return amount > 0 ? `+${formatMoney(amount)}` : formatMoney(amount);
}

/** Datum ve tvaru, na který je klient zvyklý z výpisu — z "2026-03-14" udělá "14. 3. 2026". */
export function formatDate(iso) {
  const [year, month, day] = String(iso).split("-");
  return `${Number(day)}. ${Number(month)}. ${year}`;
}

// ---------------------------------------------------------------------------
// PRODUKTY KLIENTA
// ---------------------------------------------------------------------------

/**
 * Jak se produkt jmenuje na obrazovce.
 *
 * Název je odvozený z typu, aby byl ve všech výpisech stejný bez ohledu na to, co moderátor napsal
 * do volného pole „název". Vlastní název se použije jen tehdy, když je vyplněný.
 */
const TYPE_LABELS = {
  ucet: "Běžný účet",
  sporeni: "Spoření",
  investice: "Investiční portfolio",
  pojisteni: "Životní pojištění",
  karta: "Kreditní karta",
  uver: "Úvěr",
};

export function productLabel(product) {
  return product.name || TYPE_LABELS[product.type] || "Produkt";
}

/**
 * Pořadí služeb ve výpisu: nejdřív účty a spoření, pak investice a pojištění, nakonec karty a úvěry.
 *
 * Řazení je stabilní, takže produkty stejného typu si zachovají pořadí z konfigurace respondenta.
 */
const TYPE_ORDER = { ucet: 0, sporeni: 1, investice: 2, pojisteni: 3, karta: 4, uver: 5 };

export function sortProducts(products) {
  return [...products].sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));
}

/**
 * Doplní respondentovi údaje, které se v konfiguraci nemusí psát.
 *
 * Spouští se jednou, když respondent vstupuje do testu — ať už ho moderátor zadal ve formuláři, nebo
 * se načetl z připravené konfigurace. Produkt bez uvedeného příznaku se počítá jako aktivní; jinak
 * by se filtry v obrazovkách musely zabývat tím, že hodnota chybí.
 */
export function normalizeRespondent(respondent) {
  return {
    ...respondent,
    products: (respondent.products ?? []).map((product) => ({
      ...product,
      active: product.active !== false,
    })),
  };
}

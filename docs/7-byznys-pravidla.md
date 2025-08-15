# 7. Byznys pravidla (`business.js`)

Všechna pravidla, podle kterých se prototyp rozhoduje, žijí v jednom souboru: `public/business.js`. Jak se formátují částky a data, jak se produkt jmenuje na obrazovce, v jakém pořadí se položky vypisují, co se doplní respondentovi, který to nemá vyplněné. Načítá se za běhu jako `flow.yaml` nebo `translations.properties`, takže **změna pravidla je úprava souboru a nahrání na server — žádný build**.

Smysl je dvojí: pravidlo se dá změnit bez vývojáře a existuje jedno místo, kam ukázat, když se někdo zeptá „kde se tohle rozhoduje".

## Tvar souboru

Obyčejný ES modul. Každý `export` je jedno pravidlo a nad ním komentář, který popisuje **co pravidlo dělá z pohledu byznysu**, ne jak je naprogramované.

```js
/**
 * Jak se produkt jmenuje na obrazovce.
 *
 * Název je odvozený z typu, aby byl ve všech výpisech stejný bez ohledu na to, co moderátor napsal
 * do volného pole „název". Vlastní název se použije jen tehdy, když je vyplněný.
 */
export function productLabel(product) {
  return product.name || TYPE_LABELS[product.type] || "Produkt";
}
```

Exportovat jde funkce i konstanty:

```js
/** Pořadí typů produktů ve výpisu: nejdřív účty, pak spoření, karty a nakonec úvěry. */
export const TYPE_ORDER = { ucet: 0, sporeni: 1, karta: 2, uver: 3 };
```

## Jak se pravidla používají

Všechno vyexportované je v komponentách a widgetech dostupné jako `lib.<jméno>` — v šabloně i v `<script>`:

```html
<DataRowValue :value="lib.formatKc(p.balance ?? 0)"></DataRowValue>
```

Engine k tomu přidává vlastní obecné pomocníky, které nejsou doménové a jsou k dispozici vždy:

| | |
|---|---|
| `matchesItem` | vyhodnotí `where` podmínku proti položce |
| `getValidationError` | spustí validátory pole |
| `onlyDigits`, `formatThousands` | práce s číselnými vstupy |
| `fillTemplate` | dosadí `{jmeno}` do přeloženého textu |
| `loadDataFile` | načte a rozparsuje YAML soubor z `public/` |

Když projekt vyexportuje pravidlo se stejným jménem, přebije to enginové.

## Dvě omezení, o kterých je dobré vědět

**Soubor nemůže nic importovat.** Spouští se jako samostatný modul, takže relativní `import` v něm nefunguje. Všechno, co pravidlo potřebuje, musí být v souboru — nebo to musí přijít z enginu přes `lib` do komponenty, která pravidlo volá. Proto je třeba čtení YAML souborů v `loadDataFile` na straně enginu, ne tady.

**Neplatí tu typová kontrola.** `tsc` na tenhle soubor nesahá, stejně jako nesahá na HTML komponenty. Je to cena za to, že jde měnit bez buildu. Chybu odhalí až testy — proto u pravidel, na kterých závisí čísla na obrazovce, stojí za to mít kontrolu ve `scripts/` daného projektu.

## Kde je co

| | |
|---|---|
| `public/business.js` | pravidla |
| `public/data/*.yaml` | referenční data (tabulky, číselníky), na která pravidla odkazují |
| `engine/src/business.ts` | načtení souboru, `loadDataFile` |

Rozdělení mezi `business.js` a `public/data/` je záměrné: v `business.js` patří *rozhodnutí*, do `data/` *tabulky*. Seznam 43 bank by soubor s pravidly utopil, takže `business.js` říká jen to, který soubor platí pro který typ produktu.

## `normalizeRespondent`

Zvláštní role. Když respondent vstupuje do testu — ať už ho moderátor zadal ve formuláři, nebo se načetl z `?respondentId=` — engine na něj pustí `normalizeRespondent`, pokud ho `business.js` exportuje. Je to jediné místo, kde se doplňují údaje, které konfigurace neumí říct: dopočítaná pole, výchozí hodnoty závislé na jiných hodnotách.

Projekt, který si tohle pravidlo chce nechat typované a zabudované, ho může místo toho předat do `AppShell` jako prop `normalizeRespondent` — ten má přednost.

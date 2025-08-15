# HTML komponenty (bez buildu)

Komponenty a widgety se píšou jako **jeden HTML soubor**. Načítají se za běhu z `public/`, takže
**přidání i změna nevyžaduje build** — stačí nahrát soubor přes FTP a obnovit stránku.

| Soubor | Co obsahuje |
| --- | --- |
| `public/components/<Nazev>.html` | univerzální komponenta, v obrazovce `Nazev id` |
| `public/components.yaml` | seznam komponent, které se mají načíst |
| `public/widgets/<Nazev>.html` | doménový widget, v obrazovce `Widget Nazev id` |
| `public/widgets.yaml` | seznam widgetů, které se mají načíst |

Oba seznamy jsou prostý výčet názvů, každý na svém řádku:

```yaml
- DataRow
- Text
```

Název souboru = název komponenty = název v obrazovce. **To, ve kterém seznamu je název uvedený, dělá
z prvku widget** — engine pak u něj v obrazovkách vynucuje prefix `Widget`. Komponenta uvedená
v seznamu přebije stejnojmennou vestavěnou komponentu z buildu.

Oba soubory musí existovat, i kdyby byly prázdné (např. projekt bez widgetů má `widgets.yaml` jen
s komentářem). Kdyby chybějící soubor znamenal „žádné widgety", selhal by místo něj každý odkaz
`Widget …` v obrazovkách a chyba by ukazovala na úplně špatné místo.

## Tvar souboru

```html
<template>
  <div class="alert-message alert-message--{{intent}}">
    <p class="alert-message__text">{{text}}</p>
  </div>
</template>

<style>
  .alert-message { display: flex; gap: 8px; }
</style>

<script>
  export default { defaults: { intent: "info", text: "" } };
</script>
```

Vzhled komponenty patří do jejího `<style>` — ne do sdíleného stylopisu projektu. Nahrává se pak
i maže spolu s komponentou a nezůstávají po ní osiřelá pravidla. Do `public/styles/components.css`
patří jen to, co sdílí víc komponent; barvy a písmo do `tokens.css`.

`<style>` i `<script>` jsou nepovinné. `<style>` se vloží do stránky jednou, do kaskádové vrstvy
`components`. Vkládá se až za běhu, tedy za všechny stylopisy stránky, ale díky vrstvě na pozici
nezáleží: pořadí určuje deklarace v `public/styles/main.css`, takže `widgets.css` i `screens.css`
mají pořád poslední slovo. Tokeny (`tokens.css`) se naopak uplatní dřív, takže se na ně `<style>`
uvnitř komponenty může odkazovat.

## Šablona

`{{ výraz }}` je **běžný JavaScript** (v textu i uvnitř atributů). Pozor: není to totéž `{{ }}` jako
v YAML obrazovek — tam jde o cestu k datům, která se navíc automaticky formátuje (oddělovače tisíců).
Tady se nic neformátuje.

| Zápis | Význam |
| --- | --- |
| `{{ výraz }}` | dosazení hodnoty |
| `:prop="výraz"` | předání jiné hodnoty než textu (číslo, objekt, funkce). Píše se s pomlčkami: `:sheet-options`, `:tab-index` |
| `data-if` / `data-else-if` / `data-else` | podmíněné zobrazení (na sousedních prvcích) |
| `data-for="p in seznam"` + `data-key="p.id"` | opakování; taky `(p, i) in seznam` |
| `data-let-<jmeno>="výraz"` | pomocná proměnná pro podstrom (`data-let-selected-bank` → `selectedBank`) |
| `data-on-<událost>="výraz"` | obsluha (`data-on-click`, `data-on-pointerdown`, …) |
| `data-ref="jmeno"` | přístup k DOM prvku přes `refs.jmeno` |
| `data-tag="výraz"` | změna značky za běhu (např. `h1`/`h2`/`h3`) |
| `<slot></slot>` | sem se vloží vnořené prvky z obrazovky |
| `<template data-if/data-for>` | seskupení bez obalového prvku |

Jinou komponentu použiješ její značkou: `<DataRowValue :label="label" :value="value"></DataRowValue>`.
Funguje i pro komponenty, které ještě nejsou přepsané do HTML.

## Dvě věci, které dělá prohlížeč jinak, než by člověk čekal

Soubor komponenty čte přímo prohlížeč, ne překladač. Jeho pravidla pro HTML se ve dvou bodech liší
od toho, na co jsi zvyklý z Reactu. Runtime obojí pozná a **odmítne soubor s hláškou, co přesně
opravit** — takže se ti to nemůže tiše rozbít. Ale je dobré vědět proč.

### 1. Komponentu musíš vždy uzavřít párovou značkou

Zápis `<Neco />` v HTML neexistuje. Prohlížeč ho přečte jako **otevírací** značku a všechno, co
následuje, do ní vloží jako obsah.

```html
<!-- ŠPATNĚ -->
<template>
  <DataRowValue :label="'První'" />
  <DataRowValue :label="'Druhá'" />
  <Divider />
</template>
```

Prohlížeč z toho udělá tohle — druhý řádek i oddělovač skončí *uvnitř* prvního řádku a nezobrazí se:

```html
<DataRowValue :label="'První'">
  <DataRowValue :label="'Druhá'">
    <Divider></Divider>
  </DataRowValue>
</DataRowValue>
```

```html
<!-- SPRÁVNĚ -->
<template>
  <DataRowValue :label="'První'"></DataRowValue>
  <DataRowValue :label="'Druhá'"></DataRowValue>
  <Divider></Divider>
</template>
```

Běžných HTML značek jako `<img />`, `<hr />`, `<br />` nebo `<input />` se to **netýká** — ty se
samy uzavírají odjakživa a psát je takhle je v pořádku.

### 2. Víceslovné názvy atributů se píšou s pomlčkami

Prohlížeč převádí názvy atributů na malá písmena. `:sheetOptions` se tím změní na `:sheetoptions`
a vlastnost by dorazila pod špatným názvem (nebo vůbec). Proto se víceslovné názvy píšou
s pomlčkami — runtime je převede zpět na velká písmena.

```html
<!-- ŠPATNĚ: z :sheetOptions se stane :sheetoptions -->
<ValueSlider :sheetOptions="moznosti"></ValueSlider>

<!-- SPRÁVNĚ -->
<ValueSlider :sheet-options="moznosti"></ValueSlider>
```

Totéž platí pro `data-let-*`:

```html
<!-- ŠPATNĚ -->  <div data-let-selectedBank="banky[0]">
<!-- SPRÁVNĚ --> <div data-let-selected-bank="banky[0]">   <!-- v šabloně: selectedBank -->
```

Týká se to **jen názvů atributů**, ne jejich hodnot. Uvnitř uvozovek klidně piš velká písmena:
`:label="p.otherBankName"` je v pořádku. A stejně tak **názvy značek** — `<DataRowValue>` funguje,
runtime si je spáruje bez ohledu na velikost písmen. Jednoslovné názvy (`:label`, `:value`) řešit
nemusíš vůbec.

## `<script>`

```js
export default {
  field: true, action: true, gated: true, validatable: true,   // chování v obrazovkách
  defaults: { intent: "info" },        // výchozí hodnoty vlastností
  state: { otevreno: false },          // lokální stav
  compute(ctx) { return { … } },       // odvozené hodnoty, dostupné v šabloně
  on: { nazev(ctx, ...args) { } },     // obsluhy pro data-on-* a :on-*
  effects: [{ watch: (ctx) => [ctx.props.x], run(ctx) { return úklid } }],
  layoutEffects: [ /* stejné, ale před vykreslením */ ],
};
```

`ctx` = `{ props, state, setState, derived, engine, t, lib, self, refs, uid, base }`.
V šabloně jsou přímo k dispozici `props`, `state`, výstup `compute`, obsluhy z `on`, a dále
`t`, `lib`, `engine`, `uid`, `base`.

- **`lib`** — sdílené funkce (výpočty splátek, formátování částek, práce s produkty). Komponenty
  nemohou používat `import`, takže tudy se k nim dostanou. Obsah viz `src/componentLib.ts`.
- **`t(klíč, záložní text)`** — texty z `translations.properties` (viz [4-preklady.md](4-preklady.md)).
- **`self`** — proměnné, které nemají vyvolat překreslení (např. rozpracované tažení myší).
- **`watch` u efektů je povinný.** Bez seznamu závislostí by se efekt, který zapisuje data, spouštěl
  donekonečna. Runtime takový soubor odmítne rovnou při načtení.

## Kontrola před nasazením

```
npm run dev                      # v jednom terminálu
npm run check:components         # v druhém — načte a zkompiluje všechny komponenty
npm run check:interactions       #           — proklikání: navigace, formuláře, posuvníky, přepočty
```

`check:components` spadne na první komponentě, která se nenačte nebo nezkompiluje. `check:interactions`
ověří, že komponenty i **fungují** (ne jen vykreslí). Dohromady nahrazují typovou kontrolu, kterou
u HTML souborů nemáme — pusť obojí, než nahraješ změny na server.

## Kde co leží

| | |
| --- | --- |
| `public/components/*.html`, `public/widgets/*.html` | komponenty prototypu — mění se nahráním, bez buildu |
| `public/components.yaml`, `public/widgets.yaml` | seznamy, co se má načíst |
| `src/componentLib.ts` | sdílené funkce dostupné jako `lib` (typované, v buildu) |
| `src/moderator/ui/*.tsx` | komponenty **moderátorské** obrazovky — ty v prototypu nefigurují |

Moderátorská obrazovka (nastavení respondenta) zůstává v Reactu záměrně: vykresluje se dřív, než se
knihovna komponent stihne načíst, a mimo kontext běhu prototypu. Testovaný člověk ji nikdy nevidí.

## Když se něco pokazí

Chyba v jednom souboru shodí **jen tu jednu komponentu** — na jejím místě se zobrazí červený rámeček
s popisem chyby a zbytek prototypu běží dál. Totéž při chybějícím souboru. Podrobnosti jsou v konzoli
prohlížeče; díky `sourceURL` se soubor objeví i v DevTools → Sources pod svým jménem.

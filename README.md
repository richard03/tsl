# Prototyper – engine pro interaktivní statické prototypy

Framework pro tvorbu statických, konfigurací řízených prototypů mobilních aplikací (bez serveru a databáze) pro moderované uživatelské testy. Data respondenta se ukládají do `localStorage`, obrazovky a flow jsou definované v YAML konfiguraci.

Repozitář je rozdělený na dvě plně oddělené části:

- **`engine/`** – znovupoužitelné jádro nezávislé na konkrétním projektu (parser konfigurace, vykreslování obrazovek, vyhodnocování podmínek, postup flow, správa stavu, aplikační shell). Nezná žádný konkrétní projekt – pracuje jen proti *kontraktu* (registr komponent + rozšiřovací body).
- **`projects/<název>/`** – jeden konkrétní prototyp: jeho obrazovky, flow, respondenti, komponenty, styly a assety. Vedle sebe může existovat libovolný počet projektů a každý se builduje samostatně.

```
prototyper/
├── engine/                     # znovupoužitelný framework (viz engine/README.md)
│   └── src/
│       ├── index.ts            # veřejné API (importuje se přes alias @engine)
│       ├── AppShell.tsx        # generický shell (rám telefonu, moderátor, ?respondentId=)
│       ├── FlowEngine.tsx      # načtení konfigurace + postup mezi obrazovkami
│       ├── ScreenRenderer.tsx  # vykreslení jedné obrazovky proti registru
│       ├── screenYaml.ts       # parser YAML konfigurace
│       ├── conditions.ts, bindings.ts, path.ts   # $bind / $visibleIf / {{…}}
│       ├── validation.ts, format.ts, state.ts
│       ├── engine.css        # rám telefonu + moderátorské obrazovky (vrstva @layer prototyper)
│       └── types/              # typy obrazovek a flow
│
└── projects/
    ├── demo/                   # ukázkový prototyp — učebnice enginu, zdroj všech příkladů
    └── <projekt>/              # další prototypy; vedle sebe jich může být libovolně
        ├── index.html
        ├── vite.config.ts      # base './', alias @engine → ../../engine/src
        ├── tsconfig*.json
        ├── src/main.tsx        # vstupní bod – jediný TypeScript v projektu
        ├── scripts/            # testy tohoto prototypu (Playwright)
        └── public/             # VŠE OSTATNÍ – mění se bez buildu, stačí nahrát soubor
            ├── flow.yaml           # posloupnost obrazovek
            ├── screens/            # definice obrazovek (<id>.yaml)
            ├── components.yaml     # seznam univerzálních komponent
            ├── components/         # jejich .html soubory
            ├── widgets.yaml        # seznam doménových widgetů
            ├── widgets/            # jejich .html soubory
            ├── business.js         # byznys pravidla (výpočty, názvy, řazení)
            ├── setup.yaml          # co moderátor zadává před testem
            ├── translations.properties  # všechny texty
            ├── respondents/        # připravené konfigurace respondentů
            ├── data/               # referenční data (tabulky, číselníky)
            ├── styles/             # CSS prototypu; main.css určuje pořadí vrstev a importuje zbytek
            └── resources/          # obrázky
```

Celý projekt je tedy **jeden TypeScriptový soubor a složka konfigurace**. Obrazovky, komponenty, texty, byznys pravidla i styly se mění nahráním souboru přes FTP — bez buildu a bez vývojáře.

## Dokumentace podle role

- [1. Sestavení flow z existujících komponent](docs/1-sestaveni-flow.md) – pro autora průchodu, který jen skládá obrazovky v YAML (bez kódu).
- [2. Vlastní komponenty a widgety](docs/2-vlastni-komponenty-a-widgety.md) – pro programátora, který přidává nové stavební prvky.
- [3. Úprava enginu](docs/3-uprava-enginu.md) – pro programátora, který mění samotný framework.
- [4. Překlady](docs/4-preklady.md) – kde žijí všechny texty a jak se mění bez buildu.
- [5. HTML komponenty](docs/5-html-komponenty.md) – formát `.html` souborů komponent a widgetů.
- [6. Nastavení testu](docs/6-nastaveni-testu.md) – jak se v `setup.yaml` konfigurují proměnné, které moderátor zadává před testem.
- [7. Byznys pravidla](docs/7-byznys-pravidla.md) – jediný soubor s pravidly, podle kterých se prototyp rozhoduje.

Referenční přehled API a interní architektura enginu jsou v [`engine/README.md`](engine/README.md).

## Vývoj a build

Ukázkový prototyp, na kterém stojí celá dokumentace:

```bash
npm install
npm run dev:demo     # dev server
npm run build:demo   # typecheck + build do projects/demo/dist
```

Skripty bez přípony (`npm run dev`, `build`, `preview`) cílí na výchozí projekt repozitáře; každý
další má vlastní dvojici `dev:<název>` / `build:<název>`. Projekt lze zvolit i přímo jeho složkou:

```bash
npx vite projects/demo                     # dev
npx tsc -b projects/demo                   # typecheck
npx vite build projects/demo               # build → projects/demo/dist
```

Build vytvoří statickou složku `projects/<název>/dist/`, kterou lze nahrát na libovolný hosting. Celý obsah `public/` se do ní kopíruje beze změny a načítá se za běhu přes `fetch()` – **úprava kterékoli konfigurace po buildu nevyžaduje nový build**, stačí nahrát soubor a obnovit stránku. (Cachování je vypnuté – viz `public/.htaccess` a meta tagy v `index.html`.)

## Jak prototyp funguje

1. **Moderátor** na úvodní obrazovce (rozšiřovací bod `Setup`) zadá jméno a finanční produkty respondenta, nebo se konfigurace načte z URL parametru `?respondentId=<id>` (soubor `public/respondents/<id>.yaml`).
2. **Respondent** prochází flow definované v `public/flow.yaml`, které se větví podle jeho odpovědí a zobrazuje moderátorem zadaná data.
3. Malé tlačítko (⚙) otevře moderátorský panel (rozšiřovací bod `Overlay`) s možností **restartovat flow** nebo **ukončit test a smazat data**.

## Kontrakt mezi enginem a projektem

Engine je zcela agnostický a všechno si najde v `public/` sám, takže `src/main.tsx` je celý tenhle:

```tsx
import { AppShell } from "@engine";

createRoot(document.getElementById("root")!).render(<AppShell />);
```

Rozšiřovací body existují dál, ale jsou **nepovinné** – projekt přebije jen to, co konfigurace říct neumí:

| prop | výchozí chování |
|---|---|
| `Setup` | moderátorský formulář poskládaný z `public/setup.yaml` |
| `Overlay` | moderátorský panel podle sekce `overlay:` tamtéž |
| `loadRespondentConfig` | načtení `public/respondents/<id>.yaml` |
| `normalizeRespondent` | pravidlo stejného jména z `public/business.js` |
| `registry` | prázdný – komponenty se načítají z `public/components/*.html` |
| `lib` | pomocníci enginu + vše z `business.js` |

Engine se dostane ke svým službám (navigace, mutace stavu) uvnitř komponent přes `useEngine()`; doménové funkce dostanou komponenty jako `lib`.

## Přidání nového projektu

1. Vytvoř `projects/<nový-název>/` s kostrou: `index.html`, `vite.config.ts`, `tsconfig*.json`, `src/main.tsx`, `public/`. Ty čtyři první jsou ve všech projektech stejné – zkopíruj je. V `index.html` uprav `<title>` a `<meta name="prototyper-project">` (podle něj se oddělují klíče v `localStorage`, aby si dva prototypy na stejném hostu nesahaly do jednoho úložiště).
2. Ponech `vite.config.ts` i `tsconfig.app.json` beze změny – alias `@engine` ukazuje relativně na `../../engine/src`, takže funguje z libovolného projektu pod `projects/`.
3. Naplň `public/`: `flow.yaml`, `screens/`, `components.yaml` + `components/`, volitelně `setup.yaml`, `translations.properties` a `business.js`.
4. Chceš-li `routing: path` (hezké URL typu `…/01-intro`), zkopíruj do `public/` i `.htaccess` a `rewrite-ok.txt`. Bez nich server takovou adresu neumí obsloužit a vrátí 404 – viz „Routing" níže.
5. Přidej si do kořenového `package.json` skripty, např. `"dev:<název>": "vite projects/<název>"`, `"build:<název>": "tsc -b projects/<název> && vite build projects/<název>"`.

Projekty se navzájem neovlivňují a buildují se nezávisle.

## Routing (podoba URL obrazovek)

`flow.yaml` má klíč `routing`:

- **`query`** – `…/prototyp/?screen=01-intro`. Funguje na jakémkoli hostingu, nic se nenastavuje.
- **`path`** – `…/prototyp/01-intro`. Hezčí, ale takové cesty na disku neexistují, takže je musí server přesměrovat na `index.html`. To zařídí `.htaccess` v `public/`.

Přechod mezi obrazovkami je v obou případech skutečné načtení stránky s vlastním záznamem v historii prohlížeče (kvůli nástrojům, které neumí měřit SPA).

**Když `path` vrací 404**, server `.htaccess` nepoužívá. Otevři `…/prototyp/__rewrite-test`:

- zobrazí se `rewrite-ok` → přesměrování funguje, chyba je jinde
- 404 → soubor se nenahrál (FTP klienti tečkové soubory často skrývají) nebo server nemá `mod_rewrite`; přepni `routing: query`

Obě podoby URL engine rozpoznává vždy, bez ohledu na nastavení – přepnutí `routing` tedy neshodí odkaz, který už někdo má.

## Formát definice obrazovky

Definice obrazovky má dvě části: `structure` (jen kostra – typy komponent, id instancí a jejich zanoření) a `attributes` (ploché atributy instancí podle id):

```yaml
id: example
title: Ukázková obrazovka
structure:
  header:
    - ScreenHeader pageheader
  content:
    - Text h1
    - Tile tile-products:             # zanoření = odsazený seznam za dvojtečkou
        - Text tile-title
        - DataRow tile-balance
  footer:
    - Button btn1
attributes:
  pageheader:
    title: { $bind: respondent.name }
  h1:
    size: heading
  tile-products:
    $visibleIf: { field: data.loggedIn, truthy: true }   # podmínky mají prefix $
    action: { goto: 04-products }
  tile-balance: { label: Zůstatek, value: "34 120 Kč" }
  btn1: { type: primary, action: { next: true } }
```

- Uzel struktury má tvar `TypKomponenty idInstance`, u doménových widgetů `Widget TypWidgetu idInstance` (viz „Komponenty vs. widgety" níže). Typ musí být uvedený v `public/components.yaml`, resp. `public/widgets.yaml`.
- Struktura má tři sekce: `header`, `content` a `footer`. Hlavička a patička drží svoje místo nahoře a dole, obsah roluje mezi nimi. O to se stará engine — sám měří jejich výšku a odsadí obsah tak, aby pod nimi nic nezapadlo; ve stylech prototypu se to řešit nemusí.
- V `attributes` jsou props komponenty; rezervované klíče `$visibleIf` a `$disabledIf` řídí viditelnost/zákaz instance.
- Instance bez atributů (např. `Divider`) v `attributes` být nemusí. Id v `attributes`, které není ve struktuře, engine nahlásí jako chybu (ochrana proti překlepům).
- Hodnoty lze svázat s daty přes `{ $bind: respondent.name }` / `{ $bind: data.nazevPole }`, nebo interpolovat v textu přes `"{{data.nazevPole}} Kč"` (čísla se automaticky oddělují po tisících).

### Podmínky (`$visibleIf`, `when`, `where`)

Podmínka má tvar `{ field: <cesta>, <operátor> }`. Operátory: `equals`, `notEquals`, `in: [...]` (hodnota je jedna z uvedených), `includes` (pole obsahuje hodnotu), `truthy: true|false`, a `some: [...]` (pole má aspoň jeden prvek splňující všechny vnořené podmínky – `field` se u nich vyhodnocuje proti prvku pole).

### Komponenty vs. widgety

V YAML se rozlišují dva druhy stavebních prvků a z jejich zápisu je hned patrné, o který jde:

- **Komponenta** – univerzální primitivum z `public/components/` (design-system: `Text`, `DataRow`, `Button`, `Divider`…). Zapisuje se `TypKomponenty id`.
- **Widget** – doménový (projektově specifický) blok z `public/widgets/` (`ProductList`, `TransactionList`…). Zapisuje se s prefixem `Widget TypWidgetu id`.

```yaml
content:
  - Text h1                          # komponenta
  - Widget ProductList produkty      # widget
```

Rozdíl **vynucuje engine**: napsat widget bez prefixu `Widget` (nebo naopak prefixovat komponentu) skončí chybou při načtení. Které typy jsou widgety, určuje `public/widgets.yaml`.

Filtrování a agregace nad seznamem položek (kdo patří do skupiny, součet, „zobraz když součet ≥ práh") si widget řeší uvnitř sebe – dostane data + konfigurační `where` (pole podmínek) a použije `lib.matchesItem`. Samotná pravidla (jak se položka jmenuje, co je „zahrnuté") jsou v `public/business.js`, ne v kódu widgetu.

## Úprava flow

Novou obrazovku je potřeba zapojit do `public/flow.yaml` (jinak se nenačte). Uzel obrazovky má `next`: buď rovnou ID další obrazovky, nebo seznam pravidel `{ when: [...], goto }` vyhodnocovaných v pořadí (pravidlo bez `when`, jen s `default: true`, je výchozí větev). `flow.yaml` je zároveň jediné místo, které vyjmenovává všechna platná ID obrazovek – `FlowEngine` podle něj zjišťuje, které `screens/<id>.yaml` soubory načíst.

## Veřejné API enginu

Vše, co projekt z enginu potřebuje, se importuje z aliasu `@engine` (nikdy ne z jednotlivých souborů enginu). Přehled exportů a interní architektura jsou v [`engine/README.md`](engine/README.md).

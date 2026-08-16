# 1. Sestavení flow z existujících komponent

Pro toho, kdo chce **poskládat průchod prototypem** z hotových stavebních prvků, aniž by psal React. Vše se dělá úpravou YAML souborů ve složce `projects/demo/public/` – žádný kód, žádný build (soubory se načítají za běhu, stačí uložit a obnovit stránku).

## Ukázkový prototyp jako učebnice

Projekt `demo` je stavěný tak, že **každá obrazovka přidá jednu novou vlastnost enginu**. Když si nejsi jistý, jak něco zapsat, otevři si příslušný soubor — je to funkční příklad, ne úryvek.

| Obrazovka | Co se na ní naučíš |
| --- | --- |
| `01-intro` | `structure` vs. `attributes`, sekce, texty v překladech |
| `02-login` | vstupní pole, validace, ukládání do `data.*`, odeslání blokované chybami |
| `03-dashboard` | vnořování prvků, `$bind`, `$visibleIf`, rozcestník |
| `04-products` | widget nad daty respondenta, filtr `where`, větvení flow |
| `05-transactions` | widget nad datovým souborem |
| `06-settings` | `setData`, `$visibleIf` a `$disabledIf` nad `data.*` |
| `07-urok` | hodnota dopočítaná z víc polí — widget dostane víc `$bind` props a spočítá odvozenou hodnotu |
| `08-novy-produkt` | modální okno; widget si klik obslouží sám (`engine.updateRespondent`, `engine.runAction`) místo `action:` v YAML |

Spuštění: `npm run dev:demo` → otevře se moderátorská obrazovka, kde zadáš respondenta a spustíš test.

## Kde co je

```
projects/demo/public/
├── flow.yaml            # posloupnost a větvení obrazovek
├── screens/             # jedna obrazovka = jeden soubor <id>.yaml
├── components/          # univerzální komponenty (.html)
├── widgets/             # doménové widgety (.html)
├── setup.yaml           # co moderátor zadává před testem
├── business.js          # byznys pravidla (výpočty, formátování)
├── translations.properties  # všechny texty
├── respondents/         # předpřipravení testovací respondenti <id>.yaml
├── data/                # datové soubory (tabulky, číselníky)
└── resources/           # obrázky
```

## Anatomie obrazovky

Každá obrazovka má dvě části: **`structure`** (jen kostra – co je kde vnořené) a **`attributes`** (vlastnosti prvků podle jejich `id`).

```yaml
id: ukazka                       # musí odpovídat názvu souboru: screens/ukazka.yaml
title: Ukázková obrazovka
structure:
  header:                        # plovoucí lišta nahoře
    - ScreenHeader hlavicka
  content:                       # rolovatelný obsah
    - Text nadpis
    - Tile dlazdice:             # vnoření = odsazený seznam za dvojtečkou
        - Text popisek
        - DataRow radek
  footer:                        # plovoucí lišta dole
    - Button dal
attributes:
  hlavicka: { showBackButton: true }
  nadpis: { size: heading }
  radek: { label: Zůstatek, value: "34 120 Kč" }
  dal: { action: { next: true } }
```

Pravidla:
- Uzel struktury má tvar **`Typ id`** u komponent, nebo **`Widget Typ id`** u doménových widgetů (viz níže).
- `header`/`footer` jsou nepovinné plovoucí lišty, `content` je rolovatelný obsah. O to, aby obsah nezapadl pod ně, se stará engine sám.
- Prvek bez vlastností (např. `Divider`) v `attributes` být nemusí. Naopak `id` v `attributes`, které není ve `structure`, engine nahlásí jako chybu (ochrana proti překlepům).
- `id` lze u prvku, na který nic neodkazuje (žádné vlastnosti, žádné `$visibleIf`/`$disabledIf`) vynechat úplně — stačí napsat jen `Typ` (`Widget Typ` u widgetu), typicky `Divider`. Engine mu přidělí interní id sám.
- **Texty se do `attributes` obvykle nepíšou** — patří do `translations.properties` pod klíč `screen.<obrazovka>.<id prvku>.<atribut>`. Viz [4. Překlady](4-preklady.md).

## Komponenty vs. widgety

- **Komponenta** = univerzální primitivum (nadpis, tlačítko, řádek…). Píše se `Typ id`.
- **Widget** = doménový (projektově specifický) blok. Píše se **`Widget Typ id`**.

O tom, co je co, rozhoduje `components.yaml` / `widgets.yaml`. Když prefix napíšeš špatně, engine to při načtení odmítne s jasnou hláškou.

## Katalog komponent

Komponenty ukázkového prototypu. Vlastní si přidáš podle [2. Vlastní komponenty a widgety](2-vlastni-komponenty-a-widgety.md).

| Typ | K čemu | Hlavní vlastnosti |
| --- | --- | --- |
| `Text` | Text libovolné velikosti | `text`, `size: heading\|subheading\|paragraph\|muted` |
| `DataRow` | Řádek „popisek → hodnota" | `label`, `value`, `tone: neutral\|positive\|negative` |
| `Tile` | Dlaždice; pojme vnořené prvky | `type`, `action` (pak je klikací) |
| `Divider` | Vodorovná linka | – |
| `Button` | Tlačítko | `label`, `type: primary\|secondary`, `action` |
| `InputField` | Textové pole | `label`, `placeholder`, `inputType: text\|email\|password`, `field`, `validators` |
| `SelectField` | Výběr z možností | `label`, `options`, `field`, `validators` |
| `Image` | Obrázek (i klikací) | `image` (soubor z `resources/`), `alt`, `action` |
| `ScreenHeader` | Horní lišta obrazovky | `title`, `showBackButton` |
| `Modal` | Modální okno přes celou obrazovku; pojme vnořené prvky | `open`, `title`; zavření přes `onClose` (backdrop i „×") |

### Doménové widgety (píší se `Widget Typ id`)

| Typ | K čemu | Hlavní vlastnosti |
| --- | --- | --- |
| `ProductList` | Vypíše produkty respondenta | `products` (přes `$bind`), `where`, `empty` |
| `TransactionList` | Vypíše položky z datového souboru | `file`, `limit`, `empty` |
| `InterestResult` | Dopočítá a zobrazí složené úročení | `principal`, `ratePercent`, `years` (typicky přes `$bind`) |
| `NewProductForm` | Formulář nového produktu + potvrzovací `Modal` před zápisem | – (řídí se sám vlastním stavem) |

## Vázání dat

Do vlastností lze místo pevné hodnoty vložit odkaz na data:

- **`$bind`** – celá hodnota z dat: `{ $bind: respondent.name }` nebo `{ $bind: data.mojePole }`.
- **`{{…}}`** – vložení do textu: `"Dobrý den, {{respondent.name}}"` (čísla se automaticky oddělují po tisících).

Dva jmenné prostory:
- `respondent.*` – co zadal moderátor před testem (viz [6. Nastavení testu](6-nastaveni-testu.md)).
- `data.*` – co uživatel během testu navyplňoval (hodnoty polí, výběry…).

Pozor: je-li hodnota `$bind`, překlad se na ni neuplatní — vazba je wiring, ne text.

## Akce tlačítek (`action`)

Vlastnost `action` má každý prvek, který je klikací (`Button`, `Image`, `Tile` s akcí):

```yaml
dlazdice:
  action:
    setData: { vybranaSekce: produkty }   # nejdřív zapiš do data.*
    goto: 04-products                     # skoč na konkrétní obrazovku
```

Možnosti `action`:
- `setData: { klic: hodnota }` – zapíše do `data.*` (spustí se první).
- `goto: <id-obrazovky>` – skok na danou obrazovku.
- `back: true` – zpět (jako šipka v hlavičce).
- `next: true` – posune flow podle pravidel `next` v `flow.yaml` (viz níže).

## Podmíněné zobrazení (`$visibleIf`)

Kterýkoli prvek lze podmínit:

```yaml
dlazdice-produkty:
  $visibleIf:
    field: respondent.products
    some:
      - { field: active, notEquals: false }
```

Operátory podmínky: `equals`, `notEquals`, `in: [...]` (hodnota je jedna z uvedených), `includes` (pole obsahuje hodnotu), `truthy: true|false`, `some: [...]` (pole má aspoň jeden prvek splňující vnořené podmínky). Obdoba `$disabledIf` prvek zakáže místo skrytí — viz `06-settings`.

## Flow – posloupnost obrazovek (`flow.yaml`)

`flow.yaml` říká, v jakém pořadí obrazovky jdou, a je to **jediné místo, které vyjmenovává platná ID obrazovek** (co tu není, se nenačte).

```yaml
routing: path                  # nebo query, viz README
start: 01-intro                # první obrazovka
nodes:
  - screenId: 01-intro
    next: 02-login             # pevně další obrazovka
  - screenId: 02-login
    next: 03-dashboard
  - screenId: 04-products
    next:                      # větvení – pravidla se zkoušejí shora dolů
      - when:
          - { field: respondent.showTransactions, truthy: true }
        goto: 05-transactions
      - default: true          # když nic výše nesedí
        goto: 06-settings
  - screenId: 06-settings
    next: null                 # konec flow
```

Uzel může mít i `autoAdvanceMs: 3000` — obrazovka se sama posune dál po zadané době (hodí se na čekací mezikroky).

## Respondenti a vzdálené testování

Respondenta zadá moderátor ručně, nebo se předpřipraví soubor `public/respondents/<id>.yaml` a otevře se odkaz `…/?respondentId=<id>`. Tvar odpovídá polím ze `setup.yaml`; vygenerovat ho umí tlačítko „Stáhnout konfiguraci" v moderátorském nastavení. Vzor je v `public/respondents/jan-novak.yaml`.

## Validace polí

Pole (`InputField`, `SelectField`) mohou mít `validators`:

```yaml
login-email:
  field: email
  inputType: email
  validators:
    - { type: mandatory, message: "Vyplňte prosím e-mail." }
    - { type: email }
```

Dostupné typy: `mandatory`, `email`, `positiveNumber`, `positiveAmount`. Chyba se ukáže, jakmile z pole odejdeš, nebo při pokusu o odeslání; první neúspěšný validátor zobrazí hlášku a nahoře se objeví banner. Odesílací tlačítko je blokované, dokud jsou na obrazovce chyby.

---

Chceš vytvořit **nový typ prvku** (komponentu nebo widget)? Pokračuj dokumentem [2. Vlastní komponenty a widgety](2-vlastni-komponenty-a-widgety.md).

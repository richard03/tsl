# 6. Nastavení testu (`setup.yaml`)

Obrazovka, kterou moderátor vidí před spuštěním testu, je popsaná v `public/setup.yaml`. Každá položka ve `fields` je jedna **proměnná testu**: uloží se do respondenta pod svým `name` a je rovnou dostupná v obrazovkách jako `$bind: respondent.<name>`. Soubor se načítá za běhu (stejně jako `flow.yaml` nebo `translations.properties`), takže **přidání proměnné nevyžaduje rebuild** — stačí nahrát soubor.

Popisky se píší přímo sem, ne do `translations.properties` — `setup.yaml` je stejně editovatelný bez buildu a popisek u definice pole je čitelnější než odkaz na klíč jinam.

## Kostra souboru

```yaml
title: Nastavení respondenta
submitText: Spustit test
downloadText: Stáhnout konfiguraci   # nepovinné; bez něj se tlačítko nezobrazí
fileNameFrom: name                   # podle kterého pole se pojmenuje stažený soubor

fields:
  - name: name
    label: Jméno respondenta
    type: text
    validators:
      - type: mandatory
```

## Moderátorský panel (`overlay`)

Plovoucí panel s ozubeným kolem, který je vidět během testu, se popisuje tady — engine tak nemusí
předpokládat, že respondent má jméno, úroveň nebo nějaký seznam.

```yaml
overlay:
  toggleLabel: Moderátorské ovládání
  title: { field: name }             # tučně nahoře
  lines:
    - field: level
      map:                           # hodnota → co se zobrazí
        beginner: Začátečník
        advanced: Pokročilý
    - { field: courses, count: true, suffix: kurzů }   # count = délka seznamu
  restartText: Restartovat flow (stejný respondent)
  endText: Ukončit test a smazat data
```

Celá sekce je nepovinná; bez ní panel ukáže jen svá dvě tlačítka.

## Typy polí

| `type` | Co to je | Užitečné klíče |
|---|---|---|
| `text` | Textový vstup | `defaultFrom` |
| `number` | Číselný vstup, ukládá se jako číslo | `suffix` |
| `boolean` | Zaškrtávátko | — |
| `choice` | Výběr z hodnot | `options`, `control` |
| `objectList` | Seznam složených objektů | viz níže |

Společné klíče: `label`, `default`, `suffix`, `validators`, `showWhen`, `labelWhen`.

### `choice`

`options` je seznam `{ value, label }`. `value` je to, co se uloží (může být i `true`/`false`), `label` to, co moderátor čte. `control: radio` udělá přepínače místo rozbalovacího seznamu.

```yaml
- name: level
  label: Úroveň
  type: choice
  control: radio
  default: beginner
  options:
    - { value: beginner, label: Začátečník }
    - { value: advanced, label: Pokročilý }
```

## Podmínky

`showWhen`, `labelWhen` a `where` používají **stejný zápis podmínek jako `flow.yaml`**: `equals`, `notEquals`, `in`, `includes`, `truthy`, `some`. Vyhodnocují se proti objektu, který se právě vyplňuje.

**`showWhen`** — pole se zobrazí jen když podmínky platí. Co se nezobrazuje, se také **neuloží** — položka si tak neodnese hodnotu z doby, kdy byla jiného typu.

**`labelWhen`** — mění popisek. Vyhrává první vyhovující položka, jinak platí `label`.

```yaml
- name: price
  label: Cena kurzu
  type: number
  suffix: Kč
  labelWhen:
    - when:
        - { field: kind, in: [trial, workshop] }
      label: Poplatek
```

## Složené objekty (`objectList`)

Seznam objektů, každý s vlastními poli. Konfigurovatelný je i **výpis**: rozdělení do skupin, souhrnný řádek i podoba jednoho řádku.

```yaml
- name: courses
  label: Kurzy respondenta
  type: objectList

  addText: + Přidat kurz           # tlačítko pod seznamem
  modalTitle: Přidat kurz          # nadpis modálního okna
  saveText: Přidat
  cancelText: Zrušit
  removeText: Odebrat              # u každé položky
  emptyText: Žádné kurzy.          # v prázdné skupině

  # Součet jednoho číselného pole přes položky skupiny.
  summary: { label: Součet, sum: price, suffix: Kč }

  # Položka spadne do PRVNÍ skupiny, jejíž `where` splní.
  groups:
    - title: Probíhající
      where:
        - { field: finished, notEquals: true }
    - title: Dokončené
      where:
        - { field: finished, equals: true }

  # Jak vypadá jeden řádek ve výpisu.
  item:
    label: { field: name }                  # nadpis řádku
    value: { field: price, suffix: Kč }     # hodnota vpravo
    meta:                                   # doplňkové údaje; prázdné se vynechají
      - { label: Lekcí, field: lessons }
      - { label: Hodnocení, field: rating }

  # Formulář v modálním okně — stejný slovník polí jako nahoře.
  fields:
    - name: language
      label: Jazyk
      type: choice
      default: en
      options:
        - { value: en, label: Angličtina }
        - { value: de, label: Němčina }
```

Každá položka dostane při uložení vygenerované `id`.

Položka, která neodpovídá žádné skupině, se **nezahodí** — objeví se ve skupině „Nezařazeno". Je to signál, že `where` má chybu; data by jinak tiše zmizela z obrazovky, ale zůstala v testu.

### `defaultFrom`

Předvyplní textové pole podle hodnoty jiného pole — a přestane, jakmile do něj moderátor sáhne.

```yaml
- name: name
  label: Název
  type: text
  defaultFrom:
    field: kind
    map:
      trial: Ukázková lekce
      workshop: Workshop
```

## Jak se přidá nová proměnná

1. Přidat položku do `fields` v `setup.yaml`.
2. Nahrát soubor, obnovit stránku — pole je ve formuláři.
3. V obrazovce ji použít přes `$bind: respondent.<name>`.

Vazba vyhrává nad překladem: pokud je hodnota atributu `$bind`, klíč v `translations.properties` se neuplatní (viz [4. Překlady](4-preklady.md)). Text, který má mít proměnnou uvnitř, se píše jako přeložený řetězec s `{{respondent.neco}}`.

Respondent je pro engine neprůhledný objekt — nemá pevný tvar. Cokoli přidaného do `setup.yaml` se v něm veze pod svým jménem.

## Když `setup.yaml` chybí

Je to legitimní stav — prototyp, ve kterém moderátor nic nenastavuje. Formulář se přeskočí a test
skočí rovnou na první obrazovku toku. Moderátorský panel zůstává dostupný (jen bez souhrnu o
respondentovi) a obrazovky, které se váží na `respondent.*`, prostě nedostanou hodnotu.

Rozlišuje se **chybějící** a **rozbitý** soubor: chybějící znamená "nic se nenastavuje", rozbitý je
chyba, kterou se moderátor musí dozvědět.

## Chyby ve schématu

Neplatné schéma se **nenačte** a moderátor uvidí chybovou hlášku s názvem pole — místo formuláře, kterému tiše chybí proměnná, a testu, který by běžel se špatnými daty. Kontroluje se chybějící `name`/`label`, neznámý `type`, duplicitní jméno pole, `choice` bez `options`, `objectList` bez `item.label.field` a zanoření `objectList` do `objectList` (nepodporuje se).

## Co z toho musí projekt dodat

Nic — moderátorské obrazovky i načítání konfigurací respondentů jsou v enginu výchozí. `main.tsx`
nového projektu vypadá takhle:

```tsx
<AppShell />
```

Jediné, co konfigurace říct neumí, jsou implicitní výchozí hodnoty, které dokáže doplnit jen pravidlo
znalé domény — třeba dopočítat pole ze dvou jiných. Na to slouží `normalizeRespondent`
exportovaný z [`public/business.js`](7-byznys-pravidla.md); engine ho pustí na respondenta v obou
případech, kdy vstupuje do běhu — z formuláře i z `?respondentId=` — takže se na něj nedá zapomenout.

Když projekt potřebuje víc, může do `AppShell` předat vlastní `Setup`, `Overlay` nebo
`loadRespondentConfig`; to už je ale výjimka, ne výchozí stav.

## Kde to žije

- `public/setup.yaml` — schéma
- `engine/src/setup/schema.ts` — typy, načtení, validace, pravidla podmínek
- `engine/src/setup/SchemaForm.tsx` — vykreslení polí
- `engine/src/setup/ObjectListField.tsx` — seznam složených objektů a jeho modál
- `engine/src/setup/ModeratorSetup.tsx` — výchozí obrazovka nastavení
- `engine/src/setup/ModeratorOverlay.tsx` — výchozí moderátorský panel
- `engine/src/setup/respondentConfig.ts` — čtení a zápis `public/respondents/*.yaml`
- `engine/src/setup/ui/` — formulářové prvky

Testy jsou u projektu, který je používá — ve `scripts/` dané složky projektu.

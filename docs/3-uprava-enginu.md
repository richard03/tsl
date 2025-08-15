# 3. Úprava enginu

Pro programátora, který chce měnit **samotný framework** – jak se konfigurace parsuje, vyhodnocuje a vykresluje. Předpokládá znalost [tvorby komponent](2-vlastni-komponenty-a-widgety.md).

## Rozdělení repa

```
engine/            # znovupoužitelný framework, nezná žádný konkrétní projekt
  src/…            # importuje se přes alias @engine (barrel engine/src/index.ts)
projects/
  demo/            # jeden konkrétní projekt; vedle sebe může být víc projektů
```

Projekt konzumuje engine **jen přes barrel `@engine`** (alias na `engine/src/index.ts`, nastavený v `projects/<p>/vite.config.ts` a `tsconfig.app.json`). Alias míří přímo na TypeScript zdroj – engine se nebuilduje zvlášť, zkompiluje se jako součást buildu projektu. Build/dev: `vite build projects/demo` / `vite projects/demo`.

**Železné pravidlo: engine je doménově agnostický.** Nikdy nejmenuje konkrétní komponentu ani doménový pojem – pracuje jen proti kontraktu (registr + rozšiřovací body). Cokoli specifické pro konkrétní projekt (jeho produkty, jeho pojmy, jeho vzhled) patří do `projects/<projekt>/`, ne do enginu.

## Mapa modulů (`engine/src/`)

| Modul | Odpovědnost |
| --- | --- |
| `index.ts` | Veřejné API (co smí projekt importovat přes `@engine`). |
| `AppShell.tsx` | Shell: rám telefonu, škálování, moderátorský overlay, `?respondentId=`. Parametrizovaný rozšiřovacími body. |
| `FlowEngine.tsx` | Načte `flow.yaml` + `screens/*`, parsuje, drží session data/historii/pozici, řídí přechody podle `next`. |
| `ScreenRenderer.tsx` | Vykreslí jednu obrazovku proti registru (`renderInstance`), řeší props/podmínky/validaci. |
| `screenYaml.ts` | Parser YAML (`parseScreenYaml`, `parseFlowYaml`) + vynucení prefixu `Widget`. |
| `bindings.ts` | Vyřeší `$bind` a `{{…}}` ve vlastnostech proti stavu. |
| `conditions.ts` | Vyhodnocení podmínek (`evaluateCondition`, `matchesItem`) + `EvalState`. |
| `path.ts` | `resolvePath` – čtení `respondent.*` / `data.*` podle cesty. |
| `state.ts` | Persistence do `localStorage` (respondent, data, pozice, historie). |
| `validation.ts` | Registr validátorů + `getValidationError`. |
| `format.ts` | `onlyDigits`, `formatThousands`. |
| `registry.ts` | Typy `RegistryEntry` / `ComponentRegistry`. |
| `EngineContext.tsx` | React kontext `useEngine()` (API pro komponenty). |
| `types/` | Typy obrazovek a flow (`ScreenDefinition`, `Condition`, `ButtonAction`, `FlowConfig`…). |

## Životní cyklus

1. **`AppShell`** drží respondenta a režim (setup/running/loading), vyřeší `?respondentId=`, spočítá `--phone-scale` a předá vše `FlowEngine`.
2. **`FlowEngine.load()`**: načte `flow.yaml`, z registru spočítá množinu widget-typů, načte a naparsuje všechny `screens/<id>.yaml` (`parseScreenYaml` – parsuje strukturu + vynucuje prefix `Widget`), sestaví mapu obrazovek.
3. **Navigace**: `runButtonAction` provede `setData` → pak `back`/`goto`/`next`. `next` se počítá z pravidel flow proti aktuálnímu stavu (`resolveNext` + `evaluateAll`).
4. **`ScreenRenderer.renderInstance`** pro každý uzel: vyhodnotí `$visibleIf`; vyřeší props (`resolveProps`); podle příznaků registru buď zapojí `action` (onClick), nebo `field` (value+onChange), nebo vykreslí prostou komponentu s `children`.

## Časté úpravy

### Nový operátor podmínky
Podmínky jsou v `conditions.ts` (funkce `evaluateAgainst`). Přidej větev pro nový klíč do `Condition` (v `types/screen.ts`) i do vyhodnocení. Vzor: operátor `some`.

```ts
// types/screen.ts
export interface Condition { field: string; equals?: unknown; /* … */ startsWith?: string; }
// conditions.ts, uvnitř evaluateAgainst:
if (condition.startsWith !== undefined) return typeof value === "string" && value.startsWith(condition.startsWith);
```

### Nový typ validátoru
Přidej záznam do `VALIDATOR_DEFINITIONS` v `validation.ts` – okamžitě je dostupný v YAML přes `validators: [{ type: "…" }]`:

```ts
minLength3: { defaultMessage: "Aspoň 3 znaky.", isValid: (v) => v.trim() === "" || v.trim().length >= 3 },
```

### Nová vlastnost/konvence komponent
Rozšiř `RegistryEntry` (`registry.ts`) o příznak a obsluž ho v `ScreenRenderer.renderInstance`. Drž se vzoru stávajících příznaků (`field`/`action`/`gated`/`validatable`/`widget`). Pozor: příznak musí zůstat doménově neutrální (obecná mechanika, ne konkrétní pojem z tohoto projektu).

### Nový binding/šablonovací tvar
Rozpoznání `$bind` a `{{…}}` je v `bindings.ts` (`resolveValue`/`interpolate`), čtení cest v `path.ts`. Jmenné prostory (`respondent`/`data`) jsou jen klíče v `EvalState` – přidání dalšího znamená rozšířit `EvalState` a naplnit ho v `ScreenRenderer`.

### Nový rozšiřovací bod shellu
`AppShell` přijímá `registry`, `Setup`, `Overlay`, `loadRespondentConfig`, `renderValidationError`. Další věc, kterou má dodávat projekt (a ne engine), přidej jako prop `AppShellProps` a proraž ji do `FlowEngine`/`ScreenRenderer`. Vzor: `renderValidationError` (banner validace – text i komponentu dodává projekt, engine zůstává bez doménových textů).

### Vynucení prefixu `Widget`
`parseScreenYaml` dostává `widgetTypes: Set<string>` (z `FlowEngine`, spočtené z registru jako typy s `widget: true`) a v `parseNode` kontroluje soulad `Widget Typ id` ↔ příznak. Chování ladíš tady.

## Persistence

Rozvržení obrazovky drží engine: `.screen__header` a `.screen__footer` jsou pozicované absolutně vůči `.screen-frame`, takže zůstávají nahoře a dole bez ohledu na množství obsahu. Rolovací plocha `.screen` je přes celý rám a odsazuje obsah o jejich výšku — tu nelze napsat natvrdo (hlavička někdy chybí, patička má jednou jedno tlačítko, jindy tři), takže ji `ScreenRenderer` měří přes `ResizeObserver` a zapisuje do `--screen-header-height` a `--screen-footer-height`.

`engine.css` si engine importuje sám v `AppShell.tsx`, takže ho projekt nemusí nijak zapojovat. Obsahuje jen to, co vykresluje engine: rám telefonu, rozvržení obrazovky, moderátorský formulář a panel a formulářové prvky, ze kterých je poskládaný. Celý soubor je v kaskádové vrstvě `@layer prototyper` — nezařazená pravidla mají v CSS vždy přednost, takže projektové `public/styles/` engine přebije nezávisle na pořadí načtení. Vzhled vlastních komponent prototypu do `engine.css` nepatří — ten je v jeho `public/styles/`.

Pořadí je řízené kaskádovými vrstvami, deklarovanými v `public/styles/main.css`:

```css
@layer prototyper, tokens, components, widgets, screens;
```

`prototyper` je engine, `tokens` barvy a písmo prototypu, `components` a `widgets` vzhled stavebních prvků, `screens` rozvržení konkrétních obrazovek. O pořadí rozhoduje tahle deklarace, **ne pořadí načtení souborů** — proto do vrstvy `components` patří i `<style>` bloky uvnitř `public/components/*.html`, které `loadComponentLibrary` vkládá do `<head>` až za běhu. Bez toho by skončily za všemi stylopisy stránky a tiše přebily i vzhled obrazovek.

Změny v `engine.css` (na rozdíl od `public/styles/`) vyžadují build — je to kód enginu.

`state.ts` ukládá do `localStorage` pod klíči `prototyper.<projekt>.respondent`, `.data` a `.currentScreenId`. Jméno projektu se bere z `<meta name="prototyper-project">` v `index.html` — bez něj by si dva prototypy na stejném hostu a portu sahaly do jednoho úložiště a jeden by startoval uprostřed flow toho druhého. `clearDataAndPosition` maže průběh (nový běh), `clearAll` i respondenta a zbytky po starších buildech.

## Přidání nového projektu

Engine je stavěný na víc projektů vedle sebe. Postup (zkopírovat kostru existujícího projektu a naplnit `public/`) je v [kořenovém README](../README.md#přidání-nového-projektu). Alias `@engine` je relativní, funguje z libovolného projektu beze změny.

## Ověření změn enginu

- `npx tsc -b projects/demo` – typová kontrola (engine se typuje jako součást projektu).
- `npx vite build projects/demo` – build.
- `FlowEngine` parsuje všechny obrazovky naráz, takže **jedno načtení appky ověří, že celá konfigurace prošla** (parser i vynucení prefixů). Chyba se ukáže jako „Nepodařilo se načíst konfiguraci: …".
- Pro chování za běhu je zavedený postup Playwright (dev server + seed `localStorage` + kontrola vykreslení). Detaily viz historie v repu.

# Engine – znovupoužitelné jádro prototyperu

Framework nezávislý na konkrétním projektu. Neobsahuje žádné doménové komponenty ani konkrétní obrazovky – řídí se pouze *kontraktem*: dostane registr komponent a rozšiřovací body, a proti nim vykresluje YAML-konfigurací řízené flow.

Projekt engine **nikdy neimportuje po jednotlivých souborech** – vše konzumuje přes barrel `engine/src/index.ts`, který se v každém projektu mapuje na alias `@engine` (viz `vite.config.ts` a `tsconfig.app.json` daného projektu). Alias ukazuje přímo na TypeScript zdroj enginu, takže engine se nebuilduje zvlášť – zkompiluje se jako součást buildu každého projektu.

## Veřejné API (`@engine`)

Běhové exporty:

| Export | Popis |
| --- | --- |
| `AppShell` | Generický shell: rám telefonu, škálování na velkých obrazovkách, moderátorský overlay, načtení `?respondentId=`. Napojí se na rozšiřovací body projektu. |
| `FlowEngine` | Načte flow + obrazovky a řídí navigaci (obvykle ho použije jen `AppShell`). |
| `useEngine()` | Hook pro komponenty projektu – přístup k `data`, `respondent`, `setData`, `updateRespondent`, `runAction`, `goBack`, `validationAttempted`. |
| `getValidationError` | Vyhodnotí pole proti seznamu validátorů (`mandatory`, `email`, `positiveNumber`, `positiveAmount`). |
| `matchesItem` | Vyhodnotí seznam podmínek proti jednomu prvku pole (root = prvek). Umožňuje widgetům filtrovat pole podle konfiguračního `where`, ne v kódu. |
| `onlyDigits`, `formatThousands` | Pomocné funkce pro číselné vstupy. |
| `loadRespondent`, `saveRespondent`, `clearAll`, `clearDataAndPosition` | Práce s persistovaným stavem (`localStorage`). |

Typové exporty: `AppShellProps`, `SetupProps`, `OverlayProps`, `EngineApi`, `ComponentRegistry`, `RegistryEntry`, `ValidatorConfig`, `Data`, `ButtonAction`, `Condition`, `ComponentInstance`, `ScreenDefinition`, `FlowConfig`, `FlowNode`.

## Registr komponent

Engine je doménově agnostický: nikdy nejmenuje konkrétní typ komponenty, jen čte příznaky z registru (`RegistryEntry`). Projekt registr naplní a sloučí univerzální i doménové komponenty.

```ts
export interface RegistryEntry {
  component: ComponentType<any>;
  field?: boolean;       // hodnota se čte/zapisuje přes field/variable (engine dodá value + onChange)
  action?: boolean;      // klik spouští ButtonAction (engine dodá onClick z resolved `action` prop)
  gated?: boolean;       // akční tlačítko blokované, dokud má obrazovka validační chyby (submit)
  validatable?: boolean; // podporuje validators/forceShowError (jen spolu s field)
  widget?: boolean;      // doménový widget – v YAML se píše "Widget <Typ> <id>" (vynuceno parserem)
}
```

Komponenty, které potřebují navigaci nebo mutaci stavu, si je berou samy přes `useEngine()` – v registru pak nemají žádný příznak.

### Komponenty vs. widgety

Registr rozlišuje **komponenty** (univerzální primitiva, bez příznaku) a **widgety** (`widget: true` – doménové složené bloky). V YAML se widget zapisuje `Widget <Typ> <id>`, komponenta `<Typ> <id>`; `parseScreenYaml` dostane množinu widget-typů (z registru) a nesoulad odmítne s chybou. Je to čistě čitelnostní kontrakt – engine jinak s oběma zachází stejně.

## Rozšiřovací body (co dodává projekt)

`AppShell` přijímá:

- `registry: ComponentRegistry` – sloučený registr (univerzální + doménové komponenty).
- `Setup: ComponentType<SetupProps>` – moderátorský formulář respondenta (před testem / při chybě načtení).
- `Overlay: ComponentType<OverlayProps>` – plovoucí moderátorské ovládání během testu.
- `loadRespondentConfig: (id) => Promise<unknown>` – načtení respondenta podle `?respondentId=`.
- `renderValidationError?: () => ReactNode` – banner zobrazený při pokusu o odeslání s chybami (projekt dodá vlastní komponentu i text; engine tak zůstává bez doménových textů).

## Datové namespacy v konfiguraci

- `respondent.*` – neprůhledný kontext běhu (co zadal moderátor / co je v `respondents/<id>.yaml`).
- `data.*` – session data zapisovaná poli a akcemi (`setData`).

Engine mezi ně nerozhoduje sémanticky – jen podle prefixu cesty vybírá kořen při vyhodnocení `$bind`, `{{…}}` a podmínek (`resolvePath` v `path.ts`).

## Toky dat

1. `AppShell` udržuje `respondent` a režim (setup / running / loading), řeší `?respondentId=`, škálování telefonu a předá vše `FlowEngine`.
2. `FlowEngine` načte `flow.yaml` a příslušné `screens/screen-<id>.yaml` (z kořene `public/`), drží session `data`, historii a aktuální obrazovku; postup řídí podle `next` pravidel flow.
3. `ScreenRenderer` vykreslí jednu obrazovku proti registru: vyřeší props (`bindings.ts`), vyhodnotí `$visibleIf`/`$disabledIf` (`conditions.ts`), zapojí pole a akce podle příznaků registru a hlídá validaci (`validation.ts`).

## Přidání validátoru

Nový typ validátoru stačí přidat do `VALIDATOR_DEFINITIONS` v `validation.ts`; okamžitě je dostupný v konfiguraci přes `validators: [{ type: "…", message?: "…" }]` na jakémkoli `validatable` poli.

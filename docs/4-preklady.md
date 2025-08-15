# Překlady

Veškerý uživatelsky viditelný text žije v `public/translations.properties` — plochý soubor `klíč=hodnota`, jeden řádek na text, `#` na začátku řádku = komentář. Načítá se za běhu (stejně jako `flow.yaml` a soubory obrazovek), takže **úprava textu nevyžaduje rebuild** — stačí uložit soubor a obnovit stránku. Chybějící soubor appku nespadne, jen se přestane řídit překlady (viz níže).

## Formát klíčů

- `screen.<screenId>.<elementId>.<atribut>` — texty obrazovek. Konvence, žádná nová YAML syntax: pokud tenhle klíč v souboru existuje, engine ho použije MÍSTO hodnoty z `attributes` v souboru obrazovky (typicky tam po extrakci vůbec není). U `options: [{value, label}]` (výběrové seznamy) je klíč `screen.<screenId>.<elementId>.options.<value>.label`.
- `component.<Typ>.<klíč>` — texty zapsané přímo v univerzálních komponentách (`public/components/*.html`).
- `widget.<Typ>.<klíč>` — texty zapsané přímo v doménových widgetech (`public/widgets/*.html`).

Podporované "textové" atributy na obrazovkách: `text, title, label, description, alt, suffix, empty, value` (+ `options[].label`). Ostatní stringové atributy (`type`, `field`, `variable`, `unit`, `image`, `action.*`) jsou config/enum hodnoty, ne jazykový text, a překladem se neřídí.

**Vazba (`$bind`) vyhrává nad překladem.** Je-li hodnota atributu `{ $bind: ... }`, překlad se neuplatní, i když klíč existuje — vazba je wiring, ne text, a překlad by ji tiše nahradil konstantou. Text s dosazenou hodnotou se dělá opačně: přeložený řetězec obsahuje `{{respondent.name}}` a engine ho dosadí až po překladu.

## Komponenty a widgety

V HTML komponentě je `t(klíč, záložní text)` k dispozici přímo v šabloně i v `<script>`. Záložní text
je vždy původní český — chybějící nebo přejmenovaný soubor s překlady tedy nikdy nezobrazí syrový klíč,
jen se přestane řídit souborem.

```html
<TitleText :title="t('widget.CalculatorPanel.durationLabel', 'Jak dlouho chcete půjčku splácet?')"></TitleText>
```

Věty s dosazovanou hodnotou (např. částka uprostřed textu) používají vlastní `{jméno}` placeholdery —
ne `{{...}}`, to je vyhrazené pro dosazování v šabloně — a `lib.fillTemplate`:

```html
:text="lib.fillTemplate(t('widget.LoanGroupEdit.thresholdHintText', '…aspoň {amount}.'), { amount: lib.formatKc(threshold) })"
```

## Co se NEřeší

- Víc jazyků / přepínání locale — jde jen o jeden soubor s texty, ne o i18n.
- Pluralizace (`yearsWord` v `domain/loanMath.ts` generuje "rok/roky/let" dynamicky) — zůstává v kódu.

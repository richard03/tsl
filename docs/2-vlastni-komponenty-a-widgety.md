# 2. Vlastní komponenty a widgety

Pro toho, kdo chce přidat **nový stavební prvek**. Předpokládá znalost [sestavení flow](1-sestaveni-flow.md).

> Prvky se píšou jako HTML soubory a mění se nahráním přes FTP, bez buildu.
> **Formát souboru, direktivy a `<script>` popisuje [5-html-komponenty.md](5-html-komponenty.md)** — tady je jen
> rozdíl mezi komponentou a widgetem a to, jak engine předává vlastnosti.

## Komponenta vs. widget – kam co patří

| | Komponenta | Widget |
| --- | --- | --- |
| Co to je | univerzální primitivum (design-system) | doménový (projektově specifický) složený blok |
| Kde | `public/components/<Nazev>.html` | `public/widgets/<Nazev>.html` |
| Zapsaný v | `public/components.yaml` | `public/widgets.yaml` |
| V YAML obrazovky | `Typ id` | `Widget Typ id` |

Widgetem se prvek stane tím, že je zapsaný ve `widgets.yaml`. Engine pak **vynucuje** prefix `Widget`
v YAML obrazovek — když ho napíšeš špatně, načtení obrazovky skončí chybou.

Rozhodovací pravidlo: je to obecné a znovupoužitelné napříč projekty (tlačítko, nadpis, pole)? →
**komponenta**. Ví to něco o doméně konkrétního projektu (produkty klienta, jeho transakce)? → **widget**.

## Jak engine předává vlastnosti

Každý prvek dostane vlastnosti z YAML `attributes` (s vyřešenými `$bind`/`{{…}}`). Podle příznaků
v `<script>` engine navíc doplní chování:

```js
export default {
  field: true,       // engine dodá value + onChange podle field/variable
  action: true,      // engine dodá onClick z vlastnosti `action`
  gated: true,       // akční tlačítko blokované při validačních chybách (submit)
  validatable: true, // podporuje validators + forceShowError (jen spolu s field)
};
```

- **Zobrazovací prvek** (bez příznaku) dostane jen svoje vlastnosti a `<slot>` s vnořeným obsahem.
- **`field`** — hodnota se čte a zapisuje pod klíčem z `field`/`variable` v YAML; engine dodá
  `value` a `onChange`. Příklady: `CheckBoxField`, `SelectBoxField`, `ValueSlider`.
- **`action`** — engine dodá `onClick` odvozený z vlastnosti `action` v YAML (`goto`, `back`,
  `setData`). Příklady: `ButtonTextAction`, `ListItemAction`, `Image`.
- **`gated`** — jen spolu s `action`: klik je blokovaný, dokud má obrazovka validační chyby, a
  respektuje `$disabledIf`. Má ho jediný prvek, odesílací tlačítko.
- **`validatable`** — jen spolu s `field`: prvek dostane `validators` a `forceShowError` a sám si
  zobrazuje chybu.

Prvky, které potřebují sáhnout do běhu prototypu (navigace, zápis do dat, úprava respondenta),
si to vezmou z `engine` v `ctx` — viz [5-html-komponenty.md](5-html-komponenty.md).

## Kontrolní seznam pro nový prvek

1. Soubor `public/components/<Nazev>.html` (komponenta) nebo `public/widgets/<Nazev>.html` (widget).
2. Řádek s názvem do `public/components.yaml`, resp. `public/widgets.yaml`.
3. Reference v YAML obrazovky: `Nazev id`, u widgetu `Widget Nazev id`.
4. `npm run check:components` a ověřit v prohlížeči.

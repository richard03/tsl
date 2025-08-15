# Obrázky

Sem patří obrázky a ikony, které používají obrazovky a komponenty. Nahraj soubor do téhle složky a odkaž se na něj jeho názvem včetně přípony. 
**Build ani zásah do kódu potřeba nejsou** — soubor se načítá za běhu, stačí ho nahrát a obnovit stránku.

## Obrázek v obrazovce

Zatím na to není komponenta — `components.yaml` má jen `ScreenHeader`, `Text`, `Button`
a `InputField`. Až budeš chtít vkládat obrázky přímo z YAML, založ si `Image.html`; hotový vzor
i s roztažením přes celou šířku a klikáním je v
`projects/konsolidace/public/components/Image.html`. Zápis v obrazovce pak vypadá takhle:

```yaml
structure:
  content:
    - Image hero

attributes:
  hero:
    image: intro-3.png
```

Hodnotou je vždy název souboru v této složce **včetně přípony** — dosazuje se do cesty tak, jak je
(`resources/intro-3.png`), nic se k ní nedoplňuje. Stejnojmenné `logo.svg` a `logo.png` proto mohou
ve složce ležet vedle sebe a nijak si nekonkurují; zobrazí se ten, který napíšeš.

## Když píšeš vlastní komponentu

Cestu skládej vždy s `{{base}}`, ne absolutně od kořene:

```html
<img src="{{base}}resources/pencil-edit.svg" alt="" />
```

`base` je adresa, ze které prototyp běží. Bez něj se odkaz rozbije jakmile projekt nasadíte v jakékoli podsložce.

## Na co si dát pozor

- **Soubor musí být tady, ne v `dist/`.** Do `dist/` se obsah `public/` kopíruje až buildem. Dev server servíruje tuhle složku živě, takže lokálně je nový obrázek vidět hned, ale v už vytvořeném buildu bude až po dalším `npm run build` (nebo když soubor nahraješ rovnou na server).
- **Nepoužitý obrázek nevadí**. Odkazy vznikají až za běhu z YAML a šablon, takže žádná kontrola neohlásí, že soubor přebývá — ani že chybí. Chybějící obrázek se projeví jen tím, že se nezobrazí.

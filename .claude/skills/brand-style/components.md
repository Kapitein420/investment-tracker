# Component recipes — Geist brand style

Copy-paste patterns. All use the variables from `tokens.css`. Markup is plain
HTML so it works in a deck, an email, a static page, or a React component.
**The look is monochrome-first:** gray scale carries the UI; one accent (blue by
default) signals action/focus. Color hues are for *state*, never decoration.

The non-negotiables that make something look "on brand":
1. **Hairline borders, not heavy ones** — `1px solid var(--border)` (a translucent gray), or the `--shadow-sm` ring. Never `#ccc` 2px borders.
2. **6px radius** on controls/cards (`--radius`), 8–12px on large surfaces.
3. **Brand fonts** — IvyMode serif (`--font-display`) for display/section
   headings, Nunito Sans (`--font-sans`) for everything else.
4. **Ultra-soft, layered shadows** (`--shadow-md/-lg`) — barely visible, never a hard drop shadow.
5. **Generous whitespace, dense data.** High contrast text (`--foreground` on `--background`); secondary text in `--foreground-subtle`.
6. **Restraint.** Mostly black/white/gray. If everything is colored, it's wrong.

---

## Buttons

```html
<!-- Primary: solid foreground fill, inverted text (black btn / white text in light) -->
<button class="btn btn-primary">Deploy</button>
<!-- Secondary: hairline border, the default for most actions -->
<button class="btn btn-secondary">Cancel</button>
<!-- Ghost / tertiary -->
<button class="btn btn-ghost">Skip</button>
<!-- Destructive -->
<button class="btn btn-danger">Delete</button>
```

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: var(--height-sm); padding: 0 12px;
  font: 500 14px/1 var(--font-sans);
  border-radius: var(--radius); border: 1px solid transparent;
  cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, opacity .15s;
}
.btn-primary   { background: var(--gray-1000); color: var(--background-100); }
.btn-primary:hover   { background: var(--gray-900); }
.btn-secondary { background: var(--background-100); color: var(--foreground); border-color: var(--border); }
.btn-secondary:hover { background: var(--gray-100); border-color: var(--border-strong); }
.btn-ghost     { background: transparent; color: var(--foreground); }
.btn-ghost:hover     { background: var(--gray-alpha-200); }
.btn-danger    { background: var(--red-700); color: #fff; }
.btn-danger:hover    { background: var(--red-800); }
.btn:disabled  { opacity: .5; cursor: not-allowed; }
/* sizes: add .btn-lg { height: var(--height-md); padding: 0 16px; } */
```

---

## Card

The workhorse surface: white background, hairline ring, soft shadow, 12px radius.

```html
<div class="card">
  <div class="card-head">
    <h3 class="card-title">Production</h3>
    <span class="badge badge-success">Ready</span>
  </div>
  <p class="text-muted">Deployed 2h ago by noah · main@b50f733</p>
</div>
```

```css
.card {
  background: var(--background-100);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow: var(--shadow-sm);
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.card-title { font-size: 15px; font-weight: 600; }
.text-muted { color: var(--foreground-subtle); font-size: 13px; }
```

---

## Badge / status pill

Geist badges are quiet: a soft tint background + the matching strong text. Use
the semantic hue for the state. Keep them small (11–12px, uppercase optional).

```html
<span class="badge badge-gray">Draft</span>
<span class="badge badge-success">Ready</span>
<span class="badge badge-warning">Building</span>
<span class="badge badge-error">Error</span>
<span class="badge badge-accent">Preview</span>
```

```css
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  height: 22px; padding: 0 8px;
  font: 500 12px/1 var(--font-sans);
  border-radius: var(--radius-full);
  border: 1px solid transparent;
}
.badge-gray    { background: var(--gray-100);  color: var(--gray-900); border-color: var(--gray-alpha-300); }
.badge-success { background: var(--green-100); color: var(--green-900); }
.badge-warning { background: var(--amber-100); color: var(--amber-900); }
.badge-error   { background: var(--red-100);   color: var(--red-900); }
.badge-accent  { background: var(--blue-100);  color: var(--blue-900); }
/* Dot variant: prepend <span class="dot"></span> with background: currentColor; */
```

---

## Input / field

```html
<label class="field">
  <span class="field-label">Project name</span>
  <input class="input" type="text" placeholder="agent-hq" />
</label>
```

```css
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: 500; color: var(--foreground-muted); }
.input {
  height: var(--height-md); padding: 0 12px;
  font: 400 14px/1 var(--font-sans); color: var(--foreground);
  background: var(--background-100);
  border: 1px solid var(--border); border-radius: var(--radius);
  transition: border-color .15s, box-shadow .15s;
}
.input::placeholder { color: var(--gray-700); }
.input:focus { outline: none; border-color: var(--gray-alpha-600); box-shadow: 0 0 0 3px var(--blue-200); }
.input:focus { border-color: var(--blue-700); }
```

---

## Table (the Geist data row look)

Dense, hairline row dividers, hover highlight, monospaced for IDs/metrics.

```html
<table class="table">
  <thead><tr><th>Deployment</th><th>Status</th><th>Environment</th><th>Age</th></tr></thead>
  <tbody>
    <tr>
      <td class="mono">b50f733</td>
      <td><span class="badge badge-success">Ready</span></td>
      <td>Production</td>
      <td class="text-muted">2h</td>
    </tr>
  </tbody>
</table>
```

```css
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th {
  text-align: left; font-weight: 500; font-size: 12px;
  color: var(--foreground-subtle); text-transform: uppercase; letter-spacing: .04em;
  padding: 10px 16px; border-bottom: 1px solid var(--border);
}
.table td { padding: 12px 16px; border-bottom: 1px solid var(--border); }
.table tbody tr:hover { background: var(--gray-100); }
.mono { font-family: var(--font-mono); font-size: 13px; }
```

---

## Nav / sidebar

```css
.sidebar { width: 240px; background: var(--background-200); border-right: 1px solid var(--border); padding: 12px; }
.nav-item {
  display: flex; align-items: center; gap: 8px;
  height: 34px; padding: 0 10px; border-radius: var(--radius);
  font-size: 14px; font-weight: 500; color: var(--foreground-subtle);
}
.nav-item:hover { background: var(--gray-alpha-200); color: var(--foreground); }
.nav-item.active { background: var(--gray-alpha-200); color: var(--foreground); }
```

---

## Tabs

```css
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); }
.tab {
  padding: 10px 12px; font-size: 14px; font-weight: 500;
  color: var(--foreground-subtle); border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab:hover { color: var(--foreground); }
.tab.active { color: var(--foreground); border-bottom-color: var(--gray-1000); }
```

---

## Page scaffold

```html
<div class="page">
  <header class="page-header">
    <h1 class="page-title">Deployments</h1>
    <button class="btn btn-primary">New</button>
  </header>
  <!-- content -->
</div>
```

```css
.page { max-width: var(--page-width); margin: 0 auto; padding: 32px 24px; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
```

---

## Type scale

| Use | font | size / weight | tracking |
|---|---|---|---|
| Display / H1 | **IvyMode** serif | 32–64px · 600 | -0.01em |
| H2 / section heading | **IvyMode** serif | 24–40px · 600 | -0.01em |
| H3 / card title | Nunito Sans | 15–20px · 700 | -0.01em |
| Body | Nunito Sans | 14px · 400 | normal |
| Small / meta | Nunito Sans | 13px · 400 | normal |
| Label / caption (uppercase) | Nunito Sans | 12px · 600 | +0.04–0.16em |
| Mono (IDs, metrics, code) | `var(--font-mono)` | 13px · 400 | normal |

IvyMode is a **single weight (Semi Bold, 600)** — don't request 700/bold on it
(you'll get faux-bold). Keep small uppercase labels in Nunito Sans, never the
serif. The base reset already routes `h1`/`h2` to `--font-display`.

## Loading the brand fonts

`tokens.css` only declares the font *families*; the actual files load via
`fonts.css` (self-hosted woff2 in `fonts/`). The stack falls back to system
serif/sans if the files aren't reachable.

```html
<!-- Project / multi-file: load both, paths relative to the skill folder -->
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="tokens.css">
```

For a **single-file artifact** (deck, email), base64-embed the woff2 as
`@font-face` instead of linking — see `scripts/build-deck.cjs` /
`scripts/build-starter.cjs` for the exact pattern. Regenerate the woff2 from the
source OTF/TTF with `scripts/convert-fonts.cjs`.

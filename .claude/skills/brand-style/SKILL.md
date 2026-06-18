---
name: brand-style
description: The house visual style — Vercel/Geist design system (monochrome-first, hairline borders, 6px radius, ultra-soft shadows, Geist font) extracted token-for-token from the production brand export. USE whenever building or restyling any visual artifact for this team — HTML decks/presentations, web pages, mockups, dashboards, emails, components, diagrams, or one-off UI — or when the user says "in our style", "on brand", "use our design", "brand style", "make it look like our app", "/brand-style". Apply it by default for anything user-facing unless the user asks for a different look.
---

# Brand style — Geist design system

This is the team's real visual identity, reverse-engineered from a production
export of the brand app (a Vercel/Geist-based product). Every color, radius,
shadow, and font here is a verbatim token — not an approximation. When you build
anything visual for this team, build it in this style by default.

## Files in this skill

- **`tokens.css`** — the complete system as CSS custom properties: full color
  scales (gray + blue/red/amber/green/teal/purple/pink, steps 100–1000, light
  **and** dark themes), transparent grays, semantic aliases, radii, shadows,
  the brand font stack, and a base reset. **Always start here** — inline it (or
  `<link>`/`@import` it) and reference the variables. Never hardcode hexes.
- **`fonts.css`** + **`fonts/`** — the real DILS brand typefaces, self-hosted as
  woff2: **IvyMode** (serif → display/headings, `--font-display`) and
  **Nunito Sans** (sans → body/UI, `--font-sans`). Load `fonts.css` alongside
  `tokens.css`. For a single-file artifact, base64-embed the woff2 instead.
- **`components.md`** — copy-paste recipes (buttons, cards, badges, inputs,
  tables, nav, tabs, page scaffold, type scale). Read it before hand-rolling a
  component so you match the canonical markup.
- **`examples/starter.html`** — a self-contained page that already pulls the
  tokens in and shows the components rendered. Clone it as a starting point.

## The style in one breath

**Monochrome-first.** The gray scale carries the entire UI. Exactly one accent
(blue-700 by default) signals action, links, and focus. The colored hues
(red/amber/green/teal/purple/pink) are **semantic** — they mean error / warning
/ success / info, never decoration. If a layout looks colorful, it's off-brand.

## Non-negotiables (the things that make it read as "ours")

1. **Hairline borders.** `1px solid var(--border)` (a translucent gray) or the
   `--shadow-sm` ring. Never thick or hard-gray borders.
2. **6px radius** on controls and cards (`--radius`); 8–12px on big surfaces.
   Pills/avatars use `--radius-full`.
3. **Brand type pairing** — **IvyMode** serif (`--font-display`) for big titles
   and section headings; **Nunito Sans** (`--font-sans`) for body, UI and small
   uppercase labels; a system monospace (`--font-mono`) for IDs/metrics/code.
   The base reset already routes `h1`/`h2` to the display serif. Don't set
   uppercase labels in the serif — keep those in Nunito Sans.
4. **Ultra-soft, layered shadows** (`--shadow-sm/-md/-lg`) — barely perceptible.
   No hard drop shadows, no glows.
5. **High contrast, calm hierarchy.** `--foreground` (near-black) on
   `--background` (white); secondary text in `--foreground-subtle`. Lots of
   whitespace around dense, precise data.
6. **Restraint over flourish.** Flat fills, no gradients (except as a subtle
   functional touch), no heavy iconography. Primary button = solid near-black
   fill with inverted text; most buttons are bordered/secondary.

## How to apply it (workflow)

1. Pull `tokens.css` into the artifact (inline `<style>` for a single-file deck
   or email; `<link>` for a project page).
2. Build structure with the recipes in `components.md`; reach for semantic
   aliases (`--foreground`, `--border`, `--accent`, `--success`…) over raw scale
   steps where one exists.
3. Reserve color for meaning. Default everything to gray; add a hue only to
   convey state or a single point of emphasis.
4. For dark mode, add `data-theme="dark"` (or `class="dark"`) to a wrapper — the
   tokens flip automatically; you don't restyle anything.
5. Load the Geist font for the real thing (see the end of `components.md`); the
   stack falls back gracefully to system fonts if you skip it.

## Quick reference — most-used tokens

| Need | Token |
|---|---|
| Page background | `var(--background)` |
| Card / panel background | `var(--background-100)` |
| Subtle section background | `var(--background-200)` |
| Primary text | `var(--foreground)` |
| Secondary text | `var(--foreground-subtle)` |
| Hairline border | `var(--border)` |
| Primary button fill | `var(--gray-1000)` (text `var(--background-100)`) |
| Accent / link / focus | `var(--accent)` = blue-700 |
| Success / warning / error | `var(--success)` / `var(--warning)` / `var(--error)` |
| Soft state tints | `--green-100` / `--amber-100` / `--red-100` / `--blue-100` |
| Card shadow | `var(--shadow-sm)` (hover: `--shadow-md`) |
| Menu / popover | `var(--shadow-menu)` · Modal: `var(--shadow-modal)` |
| Radius | `var(--radius)` (6px) |
| Display heading (IvyMode serif) | `var(--font-display)` |
| Body / UI (Nunito Sans) | `var(--font-sans)` |
| Mono (IDs, metrics) | `var(--font-mono)` |

## Source of truth

Colors, radii and shadows are extracted from `agent-hq – Deployments –
Vercel.html` + its CSS bundle (the **Geist** system). The **typefaces are the
real DILS brand fonts** — IvyMode + Nunito Sans — supplied directly and self-
hosted here, not from the Vercel export. If you ever need a token that isn't
here, it follows the same `--<hue>-<step>` pattern; pull the exact value from
the export rather than eyeballing it.

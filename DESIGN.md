# Handoff: 3D Head Avatar Paper Archive

## Overview
An interactive, horizontally-scrolling archive page for **3D Head Avatar** research papers. The page presents papers as a vintage file-index ("Speed Index") inspired by mid-century correspondence-storage systems: years are vertical sections arranged left-to-right, and each year contains a stack of color-tabbed file cards — one per paper. Hovering any card pops a detail panel on the right with a figure placeholder, abstract, authors, citations, code-release status, and arXiv/Project/Code/BibTeX links.

The purpose is to serve as a browsable, high-density, aesthetically distinctive landing page for a curated list of 3D Head Avatar papers.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look, layout, and interaction. They are **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React / Next.js / Vue / SvelteKit / Astro / etc.) using its established patterns, component library, and tooling. If no environment exists yet, Next.js (App Router) with Tailwind is a clean fit for a static paper-archive site, but any modern framework works.

Papers should eventually be driven by a JSON/Markdown/CMS source rather than the inline JS array used in the mockup.

## Fidelity
**High-fidelity.** Colors, typography, spacing, layout, interaction states, and animation timings are all final and should be matched pixel-faithfully. The only placeholder element is the paper-figure thumbnail (striped diagonal pattern) — that slot should accept real per-paper thumbnails (PNG/WebP) when available.

## Screens / Views

The design is a single full-viewport screen with four zones:

### 1. Top Ledger Bar
- **Layout**: full-width row, grid `auto 1fr auto auto`, 18px top / 12px bottom padding, 32px horizontal padding, 1px solid ink bottom border.
- **Left**: `Ch. 3 /` — Instrument Serif 16px, 85% opacity.
- **Center**: title `3D HEAD AVATAR — CORRESPONDENCE` — Instrument Serif 22px, uppercase, 0.22em letter-spacing.
- **Right (middle)**: count chip `NN / NN filed` — JetBrains Mono 11px uppercase.
- **Far right**: `/ YY` page marker — Instrument Serif 16px.

### 2. Conference Toggle Row
- Horizontally scrollable row of 9 toggle chips under the ledger, 1px dashed ink bottom border.
- Each chip: venue-colored background, cream text (`#fdf6dd`), 5×11px padding, 3px radius, tiny cream dot, mono 10.5px uppercase label, format `CVPR · 6`.
- Off-state: 28% opacity + saturate(0.4).
- Hover: translateY(-1px).

### 3. Horizontal Timeline (main stage)
- Absolutely positioned scroller, horizontal-only overflow, 28px top / 36px bottom / 64px left padding, 400px right padding so the last year is never hidden behind the detail panel.
- Mouse wheel scroll is **redirected to horizontal** (deltaY → scrollLeft) for one-handed trackpad-free browsing.
- Years flex-row with 48px gap.
- Each **year column**: min-width 360px, contains:
  - **Year head**: numeral (Instrument Serif 78px, line-height 0.9, tight tracking) + right-aligned sub (mono 10.5px uppercase: `filed · NN papers` + month range), 1.5px ink bottom rule.
  - **Stack**: flex column, 3px gap, of paper **Cards**.

#### Paper Card
- Height: 44px (comfortable) / 30px (compact).
- Structure: left venue **Tab** + right paper **Body**.
- **Tab**: 128/118/100px wide per density, venue-colored, cream text, mono 10.5px, notch clip-path `polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)`, inner shadow + 1px ink top/bottom borders.
  - Contents: `VENUE` (bold) + `'YY` (right-aligned tabular numerals).
- **Body**: paper background, 1px paper-edge border (left border removed — joins tab), grid `54px 1fr auto`, 12px right padding, 10px gap.
  - `idx` column: right-aligned zero-padded index (`001`), mono 10.5px, 1px right rule, 60% row height.
  - `title` column: inline `short` chip (mono 10.5px, ink bg, cream text, 2×6px padding) + full title (Inter Tight 13px, ellipsis overflow).
  - `meta` column: month abbreviation + `CODE` badge (1px ink border; `.off` variant at 25% opacity when code not released).
- **Hover** (`.hl`): translateX(-18px), body flips to ink background + paper text, tab gets inner 2px cream ring.
- **Non-hovered when anything is hovered** (`.dim`): 22% opacity, saturate(0.3). Transition 160ms cubic-bezier.

### 4. Detail Panel (right side of stage)
- Absolute position, right 24px / top 24px / bottom 24px, 320px wide, paper background, 1px ink border, 6px 6px 0 offset shadow.
- **`.tag` strip**: venue-colored, cream text, 6×12px, mono 10.5px uppercase. Left: `VENUE · YYYY`. Right: `MON YEAR`.
- **`.fig` block**: 16:9 aspect, diagonal stripe pattern `repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 6px, transparent 6px 12px)` on paper-edge color, bordered. `FIG.` label chip at top-left. Figure description text bottom-left, mono 9.5px.
- **`.content`** (scrollable):
  - `h2` title: Instrument Serif 20px, line-height 1.18, text-wrap pretty.
  - authors: Inter 11.5px, ink-soft.
  - `facts` grid: 4 rows × 2 cols (Short, Cites, Code, Posted), 9.5px dt labels / 10.5px mono dd values, top+bottom rules.
  - `abs`: Inter 12px, line-height 1.55.
  - `tags`: hashed pill list, 1px ink border, mono 9.5px lowercase.
  - `links`: stacked mono 11px buttons, 1px ink border, hover flips to ink bg + paper text. Four fixed links: `arXiv ↗`, `Project page ↗`, `Code ↗` (or `—` when not released), `Copy BibTeX ⎘`.
- **Empty state**: `.empty` class — tag turns ink-soft, fig and content hidden, centered `Hover a filed card to inspect` message in mono uppercase.

### 5. Plinth + Caption + Hint + Tweaks Button
- **Plinth**: 22px bottom strip, gradient bg + inner highlight, mimics the wooden base of the reference drawer.
- **Caption**: centered bottom ribbon `Figure 3-1. Speed Index — 3D Head Avatars`, yellow (#f5c842) on ink, Instrument Serif italic 12.5px, 1px ink border.
- **Hint**: bottom-left mono 10px `SCROLL ← → · HOVER A CARD · ⚙ OPEN TWEAKS`, 62% opacity.
- **Tweaks button / panel**: bottom-right. Panel is 230px wide paper card with 4 rows of segmented buttons (Palette, Background, Font, Density). Supports host edit-mode protocol (`__edit_mode_available`, `__activate_edit_mode`, `__deactivate_edit_mode`, `__edit_mode_set_keys`) and persists defaults through `/*EDITMODE-BEGIN*/.../*EDITMODE-END*/` markers.

## Interactions & Behavior

### Hover
- Entering a card sets `hover = paper`. Card gets `.hl` (slide left, invert). All **other** cards get `.dim` (fade). Detail panel receives the paper and swaps its accent tone to the venue color.
- Leaving the entire `.timeline` clears `hover`.

### Conference Toggle
- Clicking a toggle flips `enabled[venue]`. Filtered papers are hidden from all year stacks. Year-head count and month-range update; if a year has zero visible papers, show `— no papers in view —` placeholder.
- Ledger `NN / NN filed` count updates live.

### Horizontal Wheel Scroll
- If `|deltaY| > |deltaX|` on wheel events over the scroller, convert to `scrollLeft += deltaY` and prevent default. This is the main navigation gesture.

### Tweaks
- Four axes, applied via `body` data-attributes: `data-palette`, `data-bg`, `data-font`, `data-density`. CSS variables under each attribute swap the design tokens.
- Values:
  - `palette`: `vivid` (default) | `mono` | `pastel`
  - `bg`: `olive` (default) | `cream` | `dark`
  - `font`: `sans` (default) | `serif` | `mono`
  - `density`: `comfortable` (default) | `compact`

### Copy BibTeX
- Generates `@inproceedings{firstauthoryearshortname, title, author, booktitle, year}` and writes to clipboard.

### Animations
- Card x-slide: 160ms `cubic-bezier(.2,.7,.3,1)`.
- Toggle hover: 80ms translate + 120ms opacity.
- Detail panel swap: 150ms opacity.
- No entrance animations — the archive should feel static until the user interacts.

## State Management

Per-view state (React hooks in the prototype, equivalent in target framework):
- `hover: Paper | null` — currently hovered paper, drives both `.hl`/`.dim` and the detail panel.
- `enabled: Record<VenueKey, boolean>` — toggle state for each conference.
- `tweakState: { palette, bg, font, density }` — current tweak selection, also mirrored to `document.body` data-attrs.
- `tweakOpen: boolean` — tweak panel visibility.

Paper data is static (load-once). Swap the in-file array for a JSON fetch or MDX/CMS collection in production.

## Design Tokens

### Base (defaults — olive/vivid/sans/comfortable)
```
--bg:         #6a7840         olive drawer backdrop
--paper:      #f3ead0         card body / panel
--paper-edge: #d8ca9a         paper-grade borders / stripe placeholder
--ink:        #141208         primary text + ruled lines
--ink-soft:   #4a4330         secondary text
--rule:       #1a1609         header/footer rules
```

### Background variants
- **olive**: bg `#6a7840`, paper `#f3ead0`
- **cream**: bg `#e8dcb8`, paper `#faf3df`
- **dark**:  bg `#1a1c17`, paper `#d9cfae`, ink `#0f0c05`

### Conference palette — vivid (default)
```
CVPR           #c94a3d
ECCV           #3a7ab3
ICCV           #d4a32a
ICLR           #6a4fa8
NeurIPS        #2f7a5b
SIGGRAPH       #d26a2e
SIGGRAPH Asia  #8f3a6a
3DV            #546778
arXiv          #8a8470
```
(Mono variant collapses all to near-ink grays. Pastel variant brightens + lightens.)

### Typography
- **Display**: `Instrument Serif` — titles, year numerals, caption.
- **Body**: `Inter Tight` — paper titles, abstract, authors.
- **Mono**: `JetBrains Mono` — all UI chrome, meta, labels.
- Substitutes under `data-font`:
  - `sans`: Inter Tight for display + body
  - `serif`: Libre Caslon Text for body
  - `mono`: JetBrains Mono everywhere

### Spacing
- Card height: comfortable 44px · default 40px · compact 30px
- Card horizontal padding: 16 / 14 / 10
- Tab width: 128 / 118 / 100
- Year gap: 48px · Timeline right-padding: 400px
- Detail panel: 320px wide, 24px inset

### Radii, Shadows, Borders
- Card body: 1px paper-edge border
- Detail panel: 1px ink border + offset shadow `6px 6px 0 rgba(0,0,0,0.15)`
- Tab notch: clip-path polygon (see above)
- Toggle chips: 3px radius (only rounded element in the system — everything else is intentionally squared)

## Assets

- **Fonts**: Google Fonts — Instrument Serif, Inter Tight, Libre Caslon Text, JetBrains Mono.
- **No images** in the current prototype. Paper figure slot is a diagonal-stripe CSS placeholder; wire real `figure` images (recommended: 16:9 PNG/WebP under 200KB each) when available.
- **No icons** other than unicode arrows (↗, ⎘).

## Data Schema

Each paper in `data/papers.js`:
```ts
type Paper = {
  id: string;              // slug, unique
  title: string;           // full paper title
  short: string;           // method short name, e.g. "GaussianAvatars"
  authors: string[];       // surnames
  year: number;            // posting year (groups the timeline)
  month: number;           // 1-12 — posting month
  venue: 'CVPR' | 'ECCV' | 'ICCV' | 'ICLR' | 'NeurIPS'
       | 'SIGGRAPH' | 'SIGGRAPH Asia' | '3DV' | 'arXiv';
  venueYear: number;       // publication year (≥ year for preprints)
  tags: string[];          // freeform keywords
  citations: number;
  code: boolean;           // code-released flag
  arxiv: string;           // URL
  project: string;         // URL
  figure: string;          // one-line caption describing the figure image
  abstract: string;        // one-paragraph summary
};
```

Grouping rule: **by `year`, then by venue order** `[CVPR, ECCV, ICCV, ICLR, NeurIPS, SIGGRAPH, SIGGRAPH Asia, 3DV, arXiv]`, then by `month` descending within a venue.

## Files in this Bundle
- `index.html` — page shell, loads fonts + React + app script.
- `app.jsx` — full React component tree: `<App>`, `<Ledger>`, `<Toggles>`, `<YearColumn>`, `<Card>`, `<Detail>`, `<Tweaks>`.
- `styles/archive.css` — complete stylesheet with all tweak variants.
- `data/papers.js` — 30 representative 3D Head Avatar papers, ready to expand.

## Recreation Checklist
1. Scaffold the target framework page (e.g. `/papers` route).
2. Port `data/papers.js` to the framework's preferred format (JSON, MDX collection, CMS).
3. Rebuild the four zones top-down. The CSS is portable — Tailwind users can translate token-by-token; styled-components/CSS-modules users can lift `archive.css` directly.
4. Wire hover / toggle / wheel-scroll handlers.
5. Swap the figure placeholder for real `<Image>` components with lazy loading.
6. (Optional) Add deep-linking: `?paper=gaussianavatars` scrolls to and locks a card's hover state.
7. (Optional) Add filters panel — keyword search, tag filter — reusing the toggle row pattern.

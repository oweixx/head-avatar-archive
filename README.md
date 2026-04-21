# 3D Head Archive

Interactive, horizontally-scrolling archive of 3D head-avatar research papers, styled as a mid-century file-index ("Speed Index"). Papers are grouped by arXiv-post year, venue-tagged with colored tabs, and filter-toggleable by conference. Hover a card to preview; click to pin.

**Live:** `https://<your-gh-username>.github.io/<repo-name>/`

## Stack

- **Next.js 14** (App Router) + **TypeScript**, statically exported (`output: 'export'`) for GitHub Pages
- Single source of truth: `src/data/papers.json`
- No runtime server — `npm run build` produces an `out/` directory that Pages serves as-is

## Local development

```bash
npm install
npm run dev        # localhost:3000
npm run build      # next build → out/
```

## Data pipeline

Every script writes back to `src/data/papers.json` and has a matching GitHub Actions workflow under `.github/workflows/` that opens a PR on schedule, so the curated dataset grows without anyone touching `main` directly. All scripts accept `-- --dry` for preview.

| Script | Source | Cadence | Role |
|---|---|---|---|
| `npm run crawl` | arXiv API → Claude Haiku tagger | weekly (Mon 03:00 UTC) | Fetches new head-avatar preprints, LLM-tags them, writes `src/data/candidates.json`. Requires `ANTHROPIC_API_KEY`. |
| `npm run venues` | CVF / NeurIPS / ICLR / SIGGRAPH virtual sites | monthly (1st 04:30 UTC) | Title-matches arXiv-tagged papers against accepted-paper lists to resolve venue + year. |
| `npm run project-meta` | Paper's own project page | monthly (1st 05:30 UTC) | Extracts venue string + canonical `github.com/<owner>/<repo>` from project-page HTML. Most reliable source. |
| `npm run enrich` | Semantic Scholar + arXiv `comment` field | monthly (1st 04:00 UTC) | Fallback venue lookup; regex-extracts project / code URLs from abstracts. |
| `npm run figures` | Project-page `og:image` | monthly (1st 05:00 UTC) | Pulls the author-curated teaser thumbnail URL. |

Precedence when multiple scripts provide the same field: `project-meta` > `venues` > `enrich`. Already-tagged venues are preserved — enrichment only fills gaps.

## Adding a paper manually

Append an entry to `src/data/papers.json` matching the `Paper` type in `src/types/paper.ts`. Only `id`, `title`, `short`, `authors`, `year`, `month`, `venue`, `venueYear`, `tags`, `citations`, `code`, `arxiv`, `project`, `figure`, `abstract` are required; `figureUrl`, `codeUrl` get filled in on the next monthly run.

## Deployment

Wired for GitHub Pages via `.github/workflows/deploy.yml`.

1. push to `main`
2. repo → **Settings → Pages → Source: "GitHub Actions"**
3. (optional) repo → **Settings → Secrets and variables → Actions → `ANTHROPIC_API_KEY`** to enable the weekly arXiv crawl
4. (optional) `SEMANTIC_SCHOLAR_API_KEY` to raise the enrich workflow's rate limit

`basePath` is derived from the repo name automatically — works for both project pages (`user.github.io/repo`) and user pages (`<user>.github.io`).

## Project layout

```
src/
  app/               layout.tsx, page.tsx, globals.css
  components/        Ledger, Toggles, YearColumn, Card, Detail, Tweaks
  data/              papers.json (curated) + candidates.json (crawl output)
  types/             Paper, VenueKey, TweakState, conferences, helpers
scripts/             crawl / enrich / venues / project-meta / figures
.github/workflows/   deploy + one workflow per pipeline script
```

## Design reference

The files `index.html`, `app.jsx`, `styles/archive.css`, `data/papers.js` at the repo root are the original design handoff — the hand-authored React prototype that defined colors, typography, layout, and interaction timings. Kept for reference; the production implementation lives under `src/`.

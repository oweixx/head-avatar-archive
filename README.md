# 🧑‍🦲 3D Head Archive

A hand-curated, self-updating field guide to research on **3D head avatars** — reconstructing, animating, re-lighting, and generating digital heads. One horizontally-scrolling page, one file per paper.

The site is styled as a mid-century archival index. Years are vertical columns arranged left-to-right along a timeline; every paper is a filed card with a conference-colored tab. Hover a card to peek at its abstract, authors, teaser image, and links; click to pin it while you keep browsing. The chip row up top toggles venues on and off. The Tweaks panel (bottom-left ⚙) swaps the palette, background, font, or density — default is cream paper, pastel tabs, comfortable density.

## What's here

- **Only head / face / portrait avatars.** Full-body, hand-only, and generic scene 3DGS papers are filtered out at tagging time, so the signal stays dense.
- **Every card links out.** arXiv page, project website, code repo, and a one-click BibTeX copy.
- **Data lives in one file**, `src/data/papers.json`. Everything else on screen — the colors, the filters, the counts — is derived from it.

## How it stays alive

The archive doesn't age. A small set of schedulers keeps it current without anyone merging to `main` directly:

- **Weekly** — a crawler pulls new arXiv submissions matching the head-avatar query set, lets Claude Haiku tag the ones that actually belong, and opens a PR with the candidates.
- **Monthly** — three scrapers re-check venues (scanning CVF / NeurIPS / ICLR / SIGGRAPH virtual sites for title matches), walk each paper's project page for its stated conference + code repo, and refresh the author-curated teaser images.

New preprint goes up on a Tuesday → it shows up in the archive the following Monday. Gets accepted to CVPR → the venue tag turns CVPR-red within a month of the list being public.

## Running locally

```bash
npm install
npm run dev        # localhost:3000
npm run build      # static export → out/
```

## Deploy

Push to `main`. The included GitHub Actions workflow builds the static bundle and publishes to GitHub Pages. In repo settings: **Pages → Source: "GitHub Actions"**. Add `ANTHROPIC_API_KEY` to repo Secrets to enable the weekly crawl.

## More

- [`DESIGN.md`](./DESIGN.md) — original design spec: colors, typography, interaction timings, the full data schema.
- [`scripts/`](./scripts) — each pipeline stage (crawl / enrich / venues / project-meta / figures) is a single TS file, run independently.
- [`.github/workflows/`](./.github/workflows) — one workflow per pipeline stage, plus `deploy.yml`.

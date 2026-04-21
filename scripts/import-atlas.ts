/**
 * One-shot importer: pull curated head-avatar papers from the neighbouring
 * ../avatar-atlas clone and convert them into our Paper schema.
 *
 * Usage:
 *   npm run import:atlas          # writes src/data/papers.json
 *   npm run import:atlas -- --dry # preview without writing
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-expect-error — neighbouring repo, no package exports
import { PAPERS as ATLAS_PAPERS } from '../avatar-atlas/src/data/papers';
// @ts-expect-error — neighbouring repo, no package exports
import { CANDIDATES as ATLAS_CANDIDATES } from '../avatar-atlas/src/data/candidates';

import type { Paper, VenueKey } from '../src/types/paper';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

// avatar-atlas Paper shape (inline to avoid cross-repo imports)
interface AtlasPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  tier: 1 | 2;
  importance: 1 | 2 | 3 | 4 | 5;
  arxiv?: string;
  project?: string;
  code?: string;
  summary: string;
  contribution: string;
  representation: string[];
  input: string[];
  pipeline: string[];
  capability: string[];
  target: Array<'head' | 'body' | 'hand' | 'full'>;
  builds_on?: string[];
}

const VENUE_ENUM: VenueKey[] = [
  'CVPR', 'ECCV', 'ICCV', 'ICLR', 'NeurIPS',
  'SIGGRAPH', 'SIGGRAPH Asia', '3DV', 'arXiv',
];

/** Parse avatar-atlas venue strings like "CVPR 2024", "SIGGRAPH Asia 2022",
 *  "TOG 2023", "arXiv 2024", "arXiv 24-03" → our enum + year. */
function parseVenue(raw: string, fallbackYear: number): { venue: VenueKey; venueYear: number } {
  const lower = raw.toLowerCase();
  // pick venue enum by prefix
  let venue: VenueKey = 'arXiv';
  if (lower.includes('siggraph asia')) venue = 'SIGGRAPH Asia';
  else if (lower.startsWith('siggraph')) venue = 'SIGGRAPH';
  else if (lower.startsWith('cvpr')) venue = 'CVPR';
  else if (lower.startsWith('eccv')) venue = 'ECCV';
  else if (lower.startsWith('iccv')) venue = 'ICCV';
  else if (lower.startsWith('iclr')) venue = 'ICLR';
  else if (lower.startsWith('neurips') || lower.startsWith('nips')) venue = 'NeurIPS';
  else if (lower.startsWith('3dv')) venue = '3DV';
  // Unknown venues (TOG / TPAMI / preprint / etc.) → bucket under arXiv
  else venue = 'arXiv';

  // year (4-digit) or YY-MM pattern
  const yearMatch = raw.match(/(20\d{2})/);
  let venueYear = yearMatch ? parseInt(yearMatch[1], 10) : fallbackYear;
  const yymmMatch = raw.match(/\b(\d{2})-(\d{2})\b/);
  if (yymmMatch && !yearMatch) {
    venueYear = 2000 + parseInt(yymmMatch[1], 10);
  }
  return { venue, venueYear };
}

/** Prefer the "Name:" prefix from the paper title (preserves original capitalisation
 *  like "FHAvatar" or "EmbedTalk"). Fall back to a camel-cased id. */
function deriveShort(title: string, id: string): string {
  const colonIdx = title.indexOf(':');
  if (colonIdx > 0 && colonIdx <= 32) {
    const candidate = title.slice(0, colonIdx).trim();
    // guard against sentence-style "Learning: ..." — must look like a method name
    if (candidate.length >= 2 && /[A-Za-z]/.test(candidate[0])) return candidate;
  }
  const stripped = id.replace(/-\d{4}$/, '');
  return stripped
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join('');
}

/** Extract month from an arxiv URL (YYMM.NNNNN). Fallback to 12 (Dec). */
function monthFromArxiv(arxivUrl: string | undefined, fallbackYear: number, paperYear: number): number {
  if (!arxivUrl) return 12;
  const m = arxivUrl.match(/abs\/(\d{2})(\d{2})\./);
  if (!m) return 12;
  const yy = 2000 + parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (mm < 1 || mm > 12) return 12;
  // sanity: arxiv month only valid if year matches the paper's arxiv-post year
  if (Math.abs(yy - paperYear) <= 1) return mm;
  return 12;
}

function yearFromArxiv(arxivUrl: string | undefined, fallbackYear: number): number {
  if (!arxivUrl) return fallbackYear;
  const m = arxivUrl.match(/abs\/(\d{2})\d{2}\./);
  if (!m) return fallbackYear;
  return 2000 + parseInt(m[1], 10);
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : full;
}

function toOurPaper(a: AtlasPaper): Paper {
  const short = deriveShort(a.title, a.id);
  // atlas `year` is publication year of the venue; for our timeline we want
  // the arXiv-post year so the paper sits under its pre-print column.
  const postYear = yearFromArxiv(a.arxiv, a.year);
  const postMonth = monthFromArxiv(a.arxiv, a.year, postYear);
  const { venue, venueYear } = parseVenue(a.venue, a.year);

  // tags: 2-4 selected axes for compact display
  const tags = [
    ...a.representation.map((r) => r.toUpperCase()),
    ...a.capability.filter((c) => c !== 'static').map(cap => cap[0].toUpperCase() + cap.slice(1)),
    ...a.input.slice(0, 1).map((i) => i.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())),
  ].slice(0, 4);

  return {
    id: a.id,
    title: a.title,
    short: short || a.id,
    authors: a.authors.map(lastName),
    year: postYear,
    month: postMonth,
    venue,
    venueYear: Math.max(venueYear, postYear),
    tags,
    citations: 0,
    code: Boolean(a.code) || Boolean(a.project),
    arxiv: a.arxiv ?? '',
    project: a.project ?? a.code ?? '',
    codeUrl: a.code,
    figure: a.contribution,
    abstract: a.summary,
  };
}

function isHeadPaper(a: AtlasPaper): boolean {
  return a.target.includes('head');
}

function main() {
  const all: AtlasPaper[] = [...(ATLAS_PAPERS as AtlasPaper[]), ...(ATLAS_CANDIDATES as AtlasPaper[])];
  console.log(`[atlas] loaded ${ATLAS_PAPERS.length} curated + ${ATLAS_CANDIDATES.length} candidates = ${all.length}`);

  const heads = all.filter(isHeadPaper);
  console.log(`[atlas] target.includes('head'): ${heads.length}`);

  // dedupe by id
  const byId = new Map<string, Paper>();
  for (const a of heads) {
    if (byId.has(a.id)) continue;
    byId.set(a.id, toOurPaper(a));
  }

  const papers = [...byId.values()].sort((x, y) => {
    if (y.year !== x.year) return y.year - x.year;
    return y.month - x.month;
  });

  const outPath = path.join(ROOT, 'src', 'data', 'papers.json');
  if (DRY) {
    console.log(`[dry] would write ${papers.length} papers to ${outPath}`);
    console.table(
      papers.slice(0, 10).map((p) => ({
        id: p.id,
        short: p.short,
        year: p.year,
        venue: p.venue,
        title: p.title.slice(0, 60),
      })),
    );
    return;
  }

  fs.writeFileSync(outPath, JSON.stringify(papers, null, 2) + '\n');
  console.log(`[write] ${outPath}  (${papers.length} papers)`);
}

main();

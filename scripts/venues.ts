/**
 * Venue detection by scraping conference virtual-site paper lists.
 *
 * Goes through every paper currently tagged `venue: "arXiv"` and checks
 * whether its title appears in any of the recent CVPR / ECCV / ICCV /
 * NeurIPS / ICLR accepted-paper lists. On match, updates venue + venueYear
 * in place.
 *
 * Run: `npm run venues`           (updates src/data/papers.json)
 *      `npm run venues -- --dry`  (preview only)
 *
 * Unlike enrich.ts this only calls each conference page once (global cache)
 * so it's fast (~15 HTTP requests total) and doesn't trip rate limits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Paper, VenueKey } from '../src/types/paper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PAPERS_PATH = path.join(ROOT, 'src', 'data', 'papers.json');
const DRY = process.argv.includes('--dry');

/** Conference → {year, url, parser}. `mini` = the shared CVF / NeurIPS /
 *  ICLR virtual template; `kesen` = Ke-Sen Huang's hand-curated SIGGRAPH lists. */
interface Source {
  venue: VenueKey;
  year: number;
  url: string;
  parser: 'mini' | 'kesen';
}
const SOURCES: Source[] = [
  { venue: 'CVPR', year: 2024, url: 'https://cvpr.thecvf.com/virtual/2024/papers.html', parser: 'mini' },
  { venue: 'CVPR', year: 2025, url: 'https://cvpr.thecvf.com/virtual/2025/papers.html', parser: 'mini' },
  { venue: 'CVPR', year: 2026, url: 'https://cvpr.thecvf.com/virtual/2026/papers.html', parser: 'mini' },
  { venue: 'ECCV', year: 2024, url: 'https://eccv.ecva.net/virtual/2024/papers.html', parser: 'mini' },
  { venue: 'ICCV', year: 2025, url: 'https://iccv.thecvf.com/virtual/2025/papers.html', parser: 'mini' },
  { venue: 'NeurIPS', year: 2024, url: 'https://neurips.cc/virtual/2024/papers.html', parser: 'mini' },
  { venue: 'NeurIPS', year: 2025, url: 'https://neurips.cc/virtual/2025/papers.html', parser: 'mini' },
  { venue: 'ICLR', year: 2024, url: 'https://iclr.cc/virtual/2024/papers.html', parser: 'mini' },
  { venue: 'ICLR', year: 2025, url: 'https://iclr.cc/virtual/2025/papers.html', parser: 'mini' },
  { venue: 'ICLR', year: 2026, url: 'https://iclr.cc/virtual/2026/papers.html', parser: 'mini' },
  // Ke-Sen Huang's SIGGRAPH lists (no official virtual site for SIGGRAPH).
  { venue: 'SIGGRAPH', year: 2024, url: 'http://kesen.realtimerendering.com/sig2024.html', parser: 'kesen' },
  { venue: 'SIGGRAPH', year: 2025, url: 'http://kesen.realtimerendering.com/sig2025.html', parser: 'kesen' },
  { venue: 'SIGGRAPH Asia', year: 2023, url: 'https://www.realtimerendering.com/kesen/siga2023Papers.htm', parser: 'kesen' },
  { venue: 'SIGGRAPH Asia', year: 2024, url: 'https://www.realtimerendering.com/kesen/siga2024Papers.htm', parser: 'kesen' },
  { venue: 'SIGGRAPH Asia', year: 2025, url: 'https://www.realtimerendering.com/kesen/siga2025Papers.htm', parser: 'kesen' },
];

/** Lowercase, strip HTML entities + all non-alphanumerics, collapse whitespace. */
function norm(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        // Ke-Sen's server 406s the default UA; a browser-style UA works for
        // both it and the virtual-site CDNs.
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (head-avatar-archive)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!r.ok) {
      console.warn(`[${url}] HTTP ${r.status}`);
      return null;
    }
    return await r.text();
  } catch (err) {
    console.warn(`[${url}] ${(err as Error).message}`);
    return null;
  }
}

/** Extract titles from a mini-conf style page
 *  (`<li><a href="/virtual/YEAR/poster/NN">Title</a></li>`). */
function extractMini(html: string): string[] {
  const titles = new Set<string>();
  const re = /<li[^>]*>\s*<a[^>]+href="\/virtual\/\d+\/poster\/\d+"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const t = m[1].trim();
    if (t.length > 4) titles.add(t);
  }
  if (titles.size === 0) {
    const re2 = /<a[^>]+href="\/virtual\/\d+\/poster\/\d+"[^>]*>([^<]+)<\/a>/gi;
    while ((m = re2.exec(html))) {
      const t = m[1].trim();
      if (t.length > 4) titles.add(t);
    }
  }
  return [...titles];
}

/** Extract titles from Ke-Sen Huang's SIGGRAPH / SIGGRAPH Asia listing
 *  (`<dt><B>Title here</B></dt>`). */
function extractKesen(html: string): string[] {
  const titles = new Set<string>();
  const re = /<dt[^>]*>\s*<[Bb]>([^<]+)<\/[Bb]>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const t = m[1].trim();
    if (t.length > 4) titles.add(t);
  }
  return [...titles];
}

function extractTitles(html: string, parser: 'mini' | 'kesen'): string[] {
  return parser === 'kesen' ? extractKesen(html) : extractMini(html);
}

interface Lookup {
  venue: VenueKey;
  year: number;
  normTitles: Set<string>;
  count: number;
}

async function buildLookup(): Promise<Lookup[]> {
  const out: Lookup[] = [];
  for (const s of SOURCES) {
    const html = await fetchText(s.url);
    if (!html) {
      out.push({ venue: s.venue, year: s.year, normTitles: new Set(), count: 0 });
      continue;
    }
    const titles = extractTitles(html, s.parser);
    const normTitles = new Set(titles.map(norm));
    out.push({ venue: s.venue, year: s.year, normTitles, count: titles.length });
    console.log(`[scrape] ${s.venue} ${s.year}  ${titles.length} titles`);
  }
  return out;
}

function findVenue(
  paper: Paper,
  lookup: Lookup[],
): { venue: VenueKey; year: number } | null {
  const nt = norm(paper.title);
  if (nt.length < 10) return null;
  for (const L of lookup) {
    if (L.normTitles.has(nt)) {
      return { venue: L.venue, year: L.year };
    }
  }
  // Some venue pages include a subtitle suffix like " -- Oral" or
  // " (Highlight)". Try again against a truncated version.
  for (const L of lookup) {
    for (const candidate of L.normTitles) {
      if (candidate.length >= nt.length && candidate.startsWith(nt)) {
        return { venue: L.venue, year: L.year };
      }
      if (nt.length >= candidate.length && nt.startsWith(candidate) && candidate.length > 20) {
        return { venue: L.venue, year: L.year };
      }
    }
  }
  return null;
}

async function main() {
  const papers: Paper[] = JSON.parse(fs.readFileSync(PAPERS_PATH, 'utf8'));
  console.log(`[venues] loaded ${papers.length} papers`);

  const lookup = await buildLookup();
  const totalIndexed = lookup.reduce((a, b) => a + b.count, 0);
  console.log(`[venues] indexed ${totalIndexed} accepted-paper titles across ${lookup.length} venue-years`);

  let updated = 0;
  const before = papers.filter((p) => p.venue === 'arXiv').length;
  const examined: Paper[] = [];

  // Examine every paper (not just arXiv-only), in case atlas tagged something
  // with the wrong year or a papers recently got promoted to a conference.
  for (const p of papers) examined.push(p);

  for (const p of examined) {
    // Skip if already confidently tagged with a recent conference year that
    // matches one of our sources. Re-check arXiv-tagged ones exhaustively.
    if (p.venue !== 'arXiv') continue;

    const hit = findVenue(p, lookup);
    if (!hit) continue;

    console.log(`  ${p.short.padEnd(26)}  →  ${hit.venue} ${hit.year}  (${p.title.slice(0, 70)})`);
    p.venue = hit.venue;
    p.venueYear = hit.year;
    updated++;
  }

  const after = papers.filter((p) => p.venue === 'arXiv').length;
  console.log(`[venues] updated ${updated} papers · still arXiv: ${before} → ${after}`);

  if (DRY) {
    console.log('[dry] not writing.');
    return;
  }
  fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2) + '\n');
  console.log(`[write] ${PAPERS_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Project-page meta scraper.
 *
 * For every paper with a `project` URL, fetch the page and pull out two
 * pieces of metadata that the authors have already written for us:
 *
 *   - VENUE  — plain-text like "CVPR 2026", "SIGGRAPH Asia 2024" that
 *              authors splash under the title.
 *   - CODE   — the paper's github.com/<owner>/<repo> link, filtered against
 *              the known website-template repos (nerfies, academic-project-
 *              page-template, etc.) that authors keep as attribution.
 *
 * This is the most reliable single source we have, because it's what the
 * authors themselves publish. Runs after enrich / venues / figures to fill
 * in the last remaining gaps.
 *
 * Run: `npm run project-meta`
 *      `npm run project-meta -- --dry`
 *      `npm run project-meta -- --force` (overwrite existing venue/code)
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
const FORCE = process.argv.includes('--force');

/** Ordered longest-first so `SIGGRAPH Asia` wins over `SIGGRAPH`. */
const VENUE_PATTERNS: Array<{ re: RegExp; venue: VenueKey }> = [
  { re: /\bSIGGRAPH\s*Asia\s*(?:')?(\d{2,4})\b/gi, venue: 'SIGGRAPH Asia' },
  { re: /\bSIGGRAPH\s*(?:')?(\d{2,4})\b/gi, venue: 'SIGGRAPH' },
  { re: /\bNeurIPS\s*(?:')?(\d{2,4})\b/gi, venue: 'NeurIPS' },
  { re: /\bNIPS\s*(?:')?(\d{2,4})\b/gi, venue: 'NeurIPS' },
  { re: /\bCVPR\s*(?:')?(\d{2,4})\b/gi, venue: 'CVPR' },
  { re: /\bECCV\s*(?:')?(\d{2,4})\b/gi, venue: 'ECCV' },
  { re: /\bICCV\s*(?:')?(\d{2,4})\b/gi, venue: 'ICCV' },
  { re: /\bICLR\s*(?:')?(\d{2,4})\b/gi, venue: 'ICLR' },
  { re: /\b3DV\s*(?:')?(\d{2,4})\b/gi, venue: '3DV' },
];

/** Repos that appear on many project pages because the HTML template
 *  itself was forked from them. These are never the paper's own code. */
const TEMPLATE_REPOS = new Set(
  [
    'eliahuhorwitz/academic-project-page-template',
    'romanhauksson/academic-project-astro-template',
    'nerfies/nerfies.github.io',
    'google/nerfies',
    'google/nerfies.github.io',
    'stanford-crfm/project-page-template',
    'robot-learning-freiburg/project-page',
  ].map((s) => s.toLowerCase()),
);

/** Filenames / paths that indicate a follower-count icon or a download
 *  asset, not actual source code. */
function isTemplateRepo(owner: string, repo: string): boolean {
  const full = `${owner}/${repo}`.toLowerCase();
  if (TEMPLATE_REPOS.has(full)) return true;
  if (/template|starter|boilerplate/i.test(repo)) return true;
  // Pure personal github-pages sites (owner/owner.github.io) are just the
  // author's blog root, not the paper.
  if (`${owner}.github.io`.toLowerCase() === repo.toLowerCase()) return true;
  return false;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (head-avatar-archive)',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    // Remove HTML comments (often contain leftover venue text from the
    // page-template's example, e.g. "SIGGRAPH Asia 2022").
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface VenueHit {
  venue: VenueKey;
  year: number;
}

/** Normalise a 2-digit year suffix like "'26" → 2026. */
function resolveYear(raw: string): number {
  const n = parseInt(raw, 10);
  if (n >= 1900) return n;
  if (n < 50) return 2000 + n;
  return 1900 + n;
}

function findVenue(text: string): VenueHit | null {
  for (const { re, venue } of VENUE_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const year = resolveYear(m[1]);
      if (year >= 2015 && year <= 2030) return { venue, year };
    }
  }
  return null;
}

interface CodeHit {
  owner: string;
  repo: string;
  url: string;
}

/** Find the paper's own code repo. Only returns a hit if we have at least
 *  one STRONG confidence signal — either the owner matches the project-page
 *  subdomain, or the repo name overlaps the paper's short/title. Otherwise
 *  returns null so we don't link to an unrelated comparison/library repo. */
function findCode(
  html: string,
  projectUrl: string,
  short: string,
  title: string,
): CodeHit | null {
  const re = /https?:\/\/github\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)/gi;
  const seen: CodeHit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const owner = m[1];
    const repo = m[2].replace(/[),.;:'"]+$/, '').replace(/\.git$/, '');
    if (isTemplateRepo(owner, repo)) continue;
    const hit: CodeHit = { owner, repo, url: `https://github.com/${owner}/${repo}` };
    if (!seen.some((h) => h.url === hit.url)) seen.push(hit);
  }
  if (!seen.length) return null;

  const sub = projectUrl.match(/https?:\/\/([^/.]+)\.github\.io/i)?.[1]?.toLowerCase();

  // Build a "paper identity" token set from short name + title keywords.
  const shortTok = normToken(short);
  const titleTok = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  const score = (h: CodeHit): number => {
    let s = 0;
    const o = h.owner.toLowerCase();
    const r = h.repo.toLowerCase();
    const rTok = normToken(h.repo);
    if (sub && o === sub) s += 10;                          // owner == page subdomain
    if (shortTok && rTok.includes(shortTok)) s += 8;        // repo contains method short
    if (shortTok && rTok === shortTok) s += 3;              // exact match bonus
    for (const t of titleTok) if (r.includes(t)) s += 1;    // title-word overlap
    if (o === 'facebookresearch' || o === 'google' || o === 'microsoft') s -= 2;
    // Obvious wrong-domain repos
    if (/slider|template|website|page-template|safevalues|template-/i.test(r)) s -= 10;
    return s;
  };

  // Return highest-scoring, but ONLY if score ≥ 5 (one strong signal).
  const ranked = seen.map((h) => ({ h, s: score(h) })).sort((a, b) => b.s - a.s);
  const best = ranked[0];
  if (best.s >= 5) return best.h;
  return null;
}

/** Lowercase + strip non-alnum, for fuzzy comparison. */
function normToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const STOPWORDS = new Set([
  'with', 'from', 'using', 'via', 'for', 'into', 'fast',
  'high', 'fidelity', 'real', 'time', 'head', 'avatar', 'avatars',
  'face', 'facial', 'portrait', 'gaussian', 'splatting', 'neural',
  'radiance', 'field', 'fields', 'single', 'image', 'based', 'video',
  'novel', 'method', 'learning', 'aware', 'model', 'models',
]);

interface PageMeta {
  venue?: VenueHit;
  codeUrl?: string;
}

async function extractMeta(
  projectUrl: string,
  short: string,
  title: string,
): Promise<PageMeta | null> {
  const html = await fetchText(projectUrl);
  if (!html) return null;

  const text = stripTags(html);
  const venue = findVenue(text);
  const code = findCode(html, projectUrl, short, title);

  return { venue: venue ?? undefined, codeUrl: code?.url };
}

async function main() {
  const papers: Paper[] = JSON.parse(fs.readFileSync(PAPERS_PATH, 'utf8'));
  console.log(`[project-meta] loaded ${papers.length} papers`);

  let processed = 0;
  let venueUpdates = 0;
  let codeUpdates = 0;

  for (let i = 0; i < papers.length; i++) {
    const p = papers[i];
    if (!p.project) continue;

    const needsVenue = FORCE || p.venue === 'arXiv';
    const needsCode = FORCE || !p.codeUrl;
    if (!needsVenue && !needsCode) continue;

    processed++;
    console.log(
      `[${i + 1}/${papers.length}] ${p.short.padEnd(24)}  v=${needsVenue ? 'y' : '-'} c=${needsCode ? 'y' : '-'}  ${p.project}`,
    );

    const meta = await extractMeta(p.project, p.short, p.title);
    if (!meta) {
      await sleep(200);
      continue;
    }

    if (needsVenue && meta.venue) {
      const before = `${p.venue} ${p.venueYear}`;
      p.venue = meta.venue.venue;
      p.venueYear = meta.venue.year;
      venueUpdates++;
      console.log(`    venue: ${before}  →  ${p.venue} ${p.venueYear}`);
    }

    if (needsCode && meta.codeUrl) {
      p.codeUrl = meta.codeUrl;
      p.code = true;
      codeUpdates++;
      console.log(`    code → ${meta.codeUrl}`);
    }

    await sleep(300);

    if (!DRY && (venueUpdates + codeUpdates) % 10 === 0 && venueUpdates + codeUpdates > 0) {
      fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2) + '\n');
    }
  }

  console.log(
    `[project-meta] processed=${processed}  venue+=${venueUpdates}  code+=${codeUpdates}`,
  );
  if (DRY) {
    console.log('[dry] not writing.');
    return;
  }
  fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2) + '\n');
  console.log(`[write] ${PAPERS_PATH}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

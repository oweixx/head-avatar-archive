/**
 * Enrich existing papers with metadata from free APIs (no key required):
 *
 *   - Semantic Scholar  → authoritative venue when a preprint has been accepted
 *   - Papers with Code  → GitHub code-repo URL
 *   - arXiv API         → `arxiv:comment` field sometimes contains project URL,
 *                         useful when Semantic Scholar has no venue yet
 *
 * Run: `npm run enrich`               (in-place update of src/data/papers.json)
 *      `npm run enrich -- --dry`      (preview only)
 *      `npm run enrich -- --venue-only` / `--links-only`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import type { Paper, VenueKey } from '../src/types/paper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PAPERS_PATH = path.join(ROOT, 'src', 'data', 'papers.json');

const DRY = process.argv.includes('--dry');
const VENUE_ONLY = process.argv.includes('--venue-only');
const LINKS_ONLY = process.argv.includes('--links-only');
const MAX = (() => {
  const a = process.argv.find((x) => x.startsWith('--max='));
  return a ? parseInt(a.split('=')[1], 10) : Infinity;
})();

/** Map Semantic Scholar / DBLP-style venue strings onto our enum. */
function normaliseVenue(raw: string | undefined | null): VenueKey | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('siggraph') && s.includes('asia')) return 'SIGGRAPH Asia';
  if (s.includes('siggraph')) return 'SIGGRAPH';
  if (/\bcvpr\b/.test(s) || s.includes('computer vision and pattern recognition')) return 'CVPR';
  if (/\beccv\b/.test(s) || s.includes('european conference on computer vision')) return 'ECCV';
  if (/\biccv\b/.test(s) || s.includes('international conference on computer vision')) return 'ICCV';
  if (/\biclr\b/.test(s) || s.includes('international conference on learning representations')) return 'ICLR';
  if (/\bneurips\b/.test(s) || s.includes('neural information processing systems') || /\bnips\b/.test(s)) return 'NeurIPS';
  if (/\b3dv\b/.test(s) || s.includes('3d vision')) return '3DV';
  return null;
}

function arxivIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/abs\/([^/?#v]+)(v\d+)?/);
  return m ? m[1] : null;
}

interface S2Info {
  venue?: string;
  year?: number;
  projectUrl?: string;
}

async function safeJson<T>(resp: Response): Promise<T | null> {
  const ct = resp.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return null;
  try {
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

async function fetchSemanticScholar(arxivId: string): Promise<S2Info | null> {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const url = `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}?fields=venue,publicationVenue,year`;
  const resp = await fetchRetry(url, 5, apiKey ? { 'x-api-key': apiKey } : undefined);
  if (!resp) return null;
  if (resp.status === 404) return null;
  if (!resp.ok) {
    console.warn(`    [s2] ${arxivId} HTTP ${resp.status}`);
    return null;
  }
  const data = await safeJson<{
    venue?: string;
    publicationVenue?: { name?: string; type?: string };
    year?: number;
  }>(resp);
  if (!data) return null;
  return {
    venue: data.publicationVenue?.name ?? data.venue,
    year: data.year,
  };
}

/** Extract a canonical GitHub repo URL ("https://github.com/owner/repo") from
 *  free-text. Strips URL-like tails (queries, trailing punctuation, anchor links,
 *  file paths — we want the root repo). */
function extractGithubUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
  if (!m) return null;
  const [, owner, repo] = m;
  // trim common repo-name trailers
  const cleanRepo = repo.replace(/[).,;:'"]+$/, '').replace(/\.git$/, '');
  return `https://github.com/${owner}/${cleanRepo}`;
}

/** Parse the arxiv API entry for this ID and return the `arxiv:comment` field.
 *  Often has links like "Project page: https://..." or "Code: https://...". */
async function fetchArxivComment(arxivId: string): Promise<string | null> {
  const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
  const resp = await fetchRetry(url);
  if (!resp || !resp.ok) return null;
  const xml = await resp.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) => name === 'entry' || name === 'author' || name === 'link',
  });
  const feed = parser.parse(xml)?.feed;
  const entry = Array.isArray(feed?.entry) ? feed.entry[0] : feed?.entry;
  if (!entry) return null;
  const comment = entry['arxiv:comment'];
  if (typeof comment === 'string') return comment;
  if (comment && typeof comment === 'object' && '#text' in comment) return String(comment['#text']);
  return null;
}

function extractProjectUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  // Common patterns: "Project page: <url>", "https://...github.io/...", "https://....github.io"
  const match = text.match(/https?:\/\/[^\s)"']*\.github\.io[^\s)"']*/i);
  if (match) return cleanUrl(match[0]);
  const match2 = text.match(/Project\s+(?:page|website|site)\s*[:\-]?\s*(https?:\/\/\S+)/i);
  if (match2) return cleanUrl(match2[1]);
  const match3 = text.match(/https?:\/\/\S+\.(?:io|ai|org)\/\S+/i);
  if (match3) return cleanUrl(match3[0]);
  return null;
}

function cleanUrl(u: string): string {
  return u.replace(/[),.;:'"]+$/, '');
}

async function fetchRetry(
  url: string,
  attempts = 5,
  extraHeaders?: Record<string, string>,
): Promise<Response | null> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(2000 * Math.pow(2, i - 1));
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'head-avatar-archive/0.1 enrich (academic)',
          Accept: 'application/json, application/xml, text/xml',
          ...(extraHeaders ?? {}),
        },
      });
      if (r.status === 429 || r.status === 503) {
        lastErr = new Error(`HTTP ${r.status}`);
        continue;
      }
      return r;
    } catch (err) {
      lastErr = err;
    }
  }
  return null; // caller handles nulls; avoid noisy warning per miss
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isArxivVenue(p: Paper): boolean {
  return p.venue === 'arXiv';
}

async function main() {
  const papers: Paper[] = JSON.parse(fs.readFileSync(PAPERS_PATH, 'utf8'));
  console.log(`[enrich] loaded ${papers.length} papers`);

  let processed = 0;
  let venueUpdates = 0;
  let codeUpdates = 0;
  let projectUpdates = 0;

  for (let i = 0; i < papers.length; i++) {
    if (processed >= MAX) break;
    const p = papers[i];
    const arxivId = arxivIdFromUrl(p.arxiv);
    if (!arxivId) continue;

    const needsVenue = !LINKS_ONLY && isArxivVenue(p);
    const needsCode = !VENUE_ONLY && !p.codeUrl;
    const needsProject = !VENUE_ONLY && !p.project;
    if (!needsVenue && !needsCode && !needsProject) continue;

    processed++;
    console.log(`[${i + 1}/${papers.length}] ${arxivId}  venue=${needsVenue} code=${needsCode} proj=${needsProject}  (${p.short})`);

    // ── Semantic Scholar: venue + canonical year ──────────────
    if (needsVenue) {
      const s2 = await fetchSemanticScholar(arxivId);
      const mapped = normaliseVenue(s2?.venue);
      if (mapped) {
        p.venue = mapped;
        if (s2?.year) p.venueYear = s2.year;
        venueUpdates++;
        console.log(`    venue → ${mapped} ${p.venueYear}`);
      }
      await sleep(process.env.SEMANTIC_SCHOLAR_API_KEY ? 350 : 3500);
      // S2 without key is 1 req/s *nominal* but aggressively 429s bursts.
      // 3.5s interval keeps us comfortably below the rate limiter.
    }

    // ── arXiv `comment` + abstract → project page & code URL ─
    // (Papers with Code API was shut down and redirects to HF;
    //  we extract github.com URLs directly from arXiv metadata instead.)
    let comment: string | null = null;
    if (needsCode || needsProject) {
      comment = await fetchArxivComment(arxivId);
      await sleep(600);
    }

    if (needsCode) {
      const codeUrl = extractGithubUrl(comment) ?? extractGithubUrl(p.abstract);
      if (codeUrl) {
        p.codeUrl = codeUrl;
        p.code = true;
        codeUpdates++;
        console.log(`    code → ${codeUrl}`);
      }
    }

    if (needsProject) {
      const proj = extractProjectUrl(comment) ?? extractProjectUrl(p.abstract);
      if (proj) {
        p.project = proj;
        projectUpdates++;
        console.log(`    project → ${proj}`);
      }
    }

    // write intermediate progress every 10 updates
    if (processed % 10 === 0 && !DRY) {
      fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2) + '\n');
    }
  }

  console.log(
    `[done] processed=${processed}  venue+=${venueUpdates}  code+=${codeUpdates}  project+=${projectUpdates}`,
  );

  if (DRY) {
    console.log('[dry] no file written.');
    return;
  }
  fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2) + '\n');
  console.log(`[write] ${PAPERS_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

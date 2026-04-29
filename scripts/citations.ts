/**
 * Citation graph builder.
 *
 * For every paper in the archive, asks Semantic Scholar for its references
 * (papers it cites) and citations (papers that cite it), then keeps ONLY
 * edges where both endpoints are in our 90-paper archive — so the graph
 * stays small and meaningful.
 *
 * Writes:
 *   - builds_on: string[]   (papers this one cites, internal-only)
 *   - cited_by:  string[]   (papers that cite this one, internal-only)
 *
 * Run: `npm run citations`           (writes back to src/data/papers.json)
 *      `npm run citations -- --dry`
 *
 * Requires `SEMANTIC_SCHOLAR_API_KEY` (env or .env.local). The script fails
 * fast if it's missing — this is the only pipeline step that genuinely
 * needs a key (per-paper quotas blow up the anonymous tier).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Paper } from '../src/types/paper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PAPERS_PATH = path.join(ROOT, 'src', 'data', 'papers.json');

// Load .env.local manually (no dotenv dep)
loadEnvLocal();

const DRY = process.argv.includes('--dry');
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY;

if (!API_KEY) {
  console.error('[fatal] SEMANTIC_SCHOLAR_API_KEY not set.');
  console.error('  Export it, or put it in .env.local, then re-run.');
  process.exit(2);
}

function loadEnvLocal() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

interface S2PaperRef {
  externalIds?: { ArXiv?: string };
}
interface RefsResponse {
  data?: Array<{ citedPaper?: S2PaperRef }>;
  next?: number;
}
interface CitesResponse {
  data?: Array<{ citingPaper?: S2PaperRef }>;
  next?: number;
}

async function fetchJson<T>(url: string, attempts = 5): Promise<T | null> {
  let lastStatus: number | null = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(1500 * Math.pow(2, i - 1));
    try {
      const r = await fetch(url, {
        headers: {
          'x-api-key': API_KEY!,
          Accept: 'application/json',
          'User-Agent': 'head-avatar-archive/0.1 citation-graph',
        },
      });
      lastStatus = r.status;
      if (r.status === 429 || r.status === 503) continue;
      if (r.status === 404) return null;
      if (!r.ok) {
        console.warn(`    HTTP ${r.status} on ${url.slice(60, 120)}…`);
        return null;
      }
      const ct = r.headers.get('content-type') ?? '';
      if (!ct.includes('json')) return null;
      return (await r.json()) as T;
    } catch (err) {
      console.warn(`    fetch error: ${(err as Error).message}`);
    }
  }
  console.warn(`    giving up (${lastStatus})`);
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function arxivIdFromUrl(url: string | undefined): string | null {
  if (!url) return url ?? null;
  const m = url.match(/abs\/([^/?#v]+)/);
  return m ? m[1] : null;
}

/** Strip arxiv version suffix like "2502.20220v3" → "2502.20220". */
function normArxiv(id: string | undefined): string | null {
  if (!id) return null;
  return id.replace(/v\d+$/, '');
}

async function listAll<T>(
  baseUrl: string,
  pageSize: number,
  pickArxiv: (page: T) => Array<string | null | undefined>,
): Promise<Set<string>> {
  const found = new Set<string>();
  let offset = 0;
  while (true) {
    const url = `${baseUrl}&offset=${offset}&limit=${pageSize}`;
    const page = await fetchJson<T & { next?: number }>(url);
    if (!page) break;
    for (const a of pickArxiv(page)) {
      const n = normArxiv(a ?? undefined);
      if (n) found.add(n);
    }
    if (typeof page.next !== 'number') break;
    offset = page.next;
    await sleep(1100); // S2 advice: ≤1 RPS
    if (found.size > 4000) break; // safety
  }
  return found;
}

async function main() {
  const papers: Paper[] = JSON.parse(fs.readFileSync(PAPERS_PATH, 'utf8'));
  console.log(`[citations] loaded ${papers.length} papers`);

  // Map arXiv id → our paper id, so we can rewrite S2 hits to internal ids.
  const byArxiv = new Map<string, string>();
  for (const p of papers) {
    const a = arxivIdFromUrl(p.arxiv);
    if (a) byArxiv.set(a, p.id);
  }

  let edgesAdded = 0;

  for (let i = 0; i < papers.length; i++) {
    const p = papers[i];
    const arxivId = arxivIdFromUrl(p.arxiv);
    if (!arxivId) continue;

    console.log(`[${i + 1}/${papers.length}] ${p.short.padEnd(24)}  arxiv:${arxivId}`);

    // ── references (papers this one cites) ──────────────────────
    const refsUrl =
      `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}/references` +
      `?fields=externalIds`;
    const refIds = await listAll<RefsResponse>(refsUrl, 100, (page) =>
      (page.data ?? []).map((r) => r.citedPaper?.externalIds?.ArXiv),
    );
    const builds_on: string[] = [];
    for (const a of refIds) {
      const id = byArxiv.get(a);
      if (id && id !== p.id) builds_on.push(id);
    }
    if (builds_on.length) {
      p.builds_on = uniq(builds_on);
      edgesAdded += builds_on.length;
      console.log(`    builds_on: ${builds_on.length}  (${builds_on.slice(0, 4).join(', ')}${builds_on.length > 4 ? '…' : ''})`);
    }

    await sleep(1100);

    // ── citations (papers that cite this one) ───────────────────
    const citesUrl =
      `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}/citations` +
      `?fields=externalIds`;
    const citeIds = await listAll<CitesResponse>(citesUrl, 1000, (page) =>
      (page.data ?? []).map((r) => r.citingPaper?.externalIds?.ArXiv),
    );
    const cited_by: string[] = [];
    for (const a of citeIds) {
      const id = byArxiv.get(a);
      if (id && id !== p.id) cited_by.push(id);
    }
    if (cited_by.length) {
      p.cited_by = uniq(cited_by);
      edgesAdded += cited_by.length;
      console.log(`    cited_by:  ${cited_by.length}  (${cited_by.slice(0, 4).join(', ')}${cited_by.length > 4 ? '…' : ''})`);
    }

    await sleep(1100);

    // intermediate save every 5 papers
    if (!DRY && i % 5 === 4) {
      fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2) + '\n');
    }
  }

  console.log(`[citations] total directed edges added: ${edgesAdded}`);

  // Cross-check: every (a → b) in builds_on should have (b → a) in cited_by.
  // If any missing (e.g. one direction's API returned partial), backfill.
  const idToPaper = new Map<string, Paper>(papers.map((p) => [p.id, p]));
  let backfilled = 0;
  for (const p of papers) {
    for (const target of p.builds_on ?? []) {
      const t = idToPaper.get(target);
      if (!t) continue;
      t.cited_by = uniq([...(t.cited_by ?? []), p.id]);
    }
    for (const source of p.cited_by ?? []) {
      const s = idToPaper.get(source);
      if (!s) continue;
      const before = (s.builds_on ?? []).length;
      s.builds_on = uniq([...(s.builds_on ?? []), p.id]);
      if ((s.builds_on ?? []).length > before) backfilled++;
    }
  }
  if (backfilled) console.log(`[citations] backfilled ${backfilled} reverse edges`);

  if (DRY) {
    console.log('[dry] not writing.');
    return;
  }
  fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2) + '\n');
  console.log(`[write] ${PAPERS_PATH}`);
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

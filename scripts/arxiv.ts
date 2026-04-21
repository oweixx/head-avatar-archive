import { XMLParser } from 'fast-xml-parser';
import type { ArxivCandidate } from './schema';

const API = 'http://export.arxiv.org/api/query';

/** Query families narrowed to **3D Head Avatar** research. */
export const QUERY_FAMILIES: string[] = [
  // -- core head / face avatar terms --
  'ti:"head avatar" AND cat:cs.CV',
  'abs:"3D head avatar"',
  'abs:"head avatar" AND cat:cs.CV',
  'abs:"facial avatar" AND cat:cs.CV',
  'abs:"face avatar" AND cat:cs.CV',
  'abs:"codec avatar" AND cat:cs.CV',
  'abs:"neural head" AND cat:cs.CV',
  'abs:"portrait" AND (abs:"gaussian" OR abs:"nerf" OR abs:"3d")',

  // -- gaussian splatting · head / face --
  'abs:"gaussian head"',
  'abs:"gaussian avatar" AND (abs:head OR abs:face OR abs:portrait)',
  'abs:"animatable gaussian" AND (abs:head OR abs:face)',
  'abs:"relightable gaussian" AND (abs:head OR abs:face OR abs:portrait)',
  'abs:"4D gaussian" AND (abs:face OR abs:head OR abs:portrait)',

  // -- NeRF · head / face --
  'abs:"face NeRF"',
  'abs:"head NeRF"',
  'abs:"neural radiance" AND abs:face AND cat:cs.CV',
  'abs:"neural radiance" AND abs:head AND cat:cs.CV',
  'abs:"animatable nerf" AND (abs:head OR abs:face)',

  // -- parametric priors · head / face --
  'abs:FLAME AND (abs:gaussian OR abs:nerf OR abs:diffusion) AND cat:cs.CV',
  'abs:"morphable" AND abs:head AND cat:cs.CV',
  'abs:"3DMM" AND cat:cs.CV',

  // -- capabilities on heads --
  'abs:"relightable" AND (abs:head OR abs:face OR abs:portrait) AND cat:cs.CV',
  'abs:"reenactment" AND (abs:head OR abs:face OR abs:portrait) AND cat:cs.CV',
  'abs:"expression" AND abs:avatar AND cat:cs.CV',
  'abs:"animatable" AND (abs:head OR abs:face OR abs:portrait) AND cat:cs.CV',

  // -- diffusion / generative · head / face --
  'abs:"diffusion" AND (abs:"head avatar" OR abs:"face avatar" OR abs:portrait) AND cat:cs.CV',
  'abs:"text-to-avatar" AND (abs:head OR abs:face)',
  'abs:"one-shot" AND (abs:"head avatar" OR abs:"face avatar" OR abs:portrait)',
  'abs:"single image" AND abs:"head avatar"',

  // -- talking head / video portrait --
  'abs:"talking head" AND (abs:gaussian OR abs:nerf OR abs:diffusion) AND cat:cs.CV',
  'abs:"talking face" AND cat:cs.CV',
  'abs:"video portrait" AND cat:cs.CV',
  'abs:"lip sync" AND (abs:gaussian OR abs:nerf OR abs:3d)',

  // -- capture · monocular head --
  'abs:"monocular" AND (abs:"head avatar" OR abs:"face avatar")',
  'abs:"4D face"',
  'abs:"4D head"',
];

export interface FetchOptions {
  fromDate: string; // YYYYMMDD
  toDate?: string; // YYYYMMDD
  maxPerQuery?: number;
}

export async function fetchArxivForQuery(
  query: string,
  opts: FetchOptions,
): Promise<ArxivCandidate[]> {
  const to = opts.toDate ?? todayYmd();
  const ranged = `(${query}) AND submittedDate:[${opts.fromDate}0000 TO ${to}2359]`;
  const params = new URLSearchParams({
    search_query: ranged,
    start: '0',
    max_results: String(opts.maxPerQuery ?? 100),
    sortBy: 'submittedDate',
    sortOrder: 'descending',
  });
  const url = `${API}?${params.toString()}`;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(5000 * Math.pow(2, attempt - 1));
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'head-avatar-archive/0.1 (research crawl)' },
      });
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`arxiv HTTP ${res.status}`);
      const xml = await res.text();
      return parseFeed(xml);
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error('arxiv: unknown failure');
}

export async function fetchAllFamilies(opts: FetchOptions): Promise<ArxivCandidate[]> {
  const map = new Map<string, ArxivCandidate>();
  for (let i = 0; i < QUERY_FAMILIES.length; i++) {
    const q = QUERY_FAMILIES[i];
    try {
      const rows = await fetchArxivForQuery(q, opts);
      let added = 0;
      for (const r of rows) {
        if (!map.has(r.id)) {
          map.set(r.id, r);
          added++;
        }
      }
      console.log(
        `[arxiv] (${i + 1}/${QUERY_FAMILIES.length}) ${rows.length} hits, ${added} new · ${q}`,
      );
    } catch (err) {
      console.error(`[arxiv] query "${q}" failed:`, (err as Error).message);
    }
    if (i < QUERY_FAMILIES.length - 1) await sleep(6000);
  }
  return [...map.values()].sort((a, b) => b.published.localeCompare(a.published));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseFeed(xml: string): ArxivCandidate[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) =>
      name === 'entry' || name === 'author' || name === 'category' || name === 'link',
  });
  const feed = parser.parse(xml)?.feed;
  if (!feed || !feed.entry) return [];
  return feed.entry.map((e: unknown) => toCandidate(e as Record<string, unknown>));
}

function toCandidate(e: Record<string, unknown>): ArxivCandidate {
  const idUrl = (e.id as string) ?? '';
  const m = idUrl.match(/abs\/([^v]+)(v\d+)?$/);
  const id = m?.[1] ?? idUrl;
  const version = m?.[2] ?? 'v1';
  const authors = ((e.author as Array<{ name?: string }>) ?? [])
    .map((a) => (a?.name ?? '').trim())
    .filter(Boolean);
  const links = (e.link as Array<{ href?: string; title?: string; type?: string }>) ?? [];
  const pdf = links.find((l) => l.title === 'pdf' || l.type === 'application/pdf')?.href;
  const cats =
    ((e.category as Array<{ term?: string }>) ?? [])
      .map((c) => c.term)
      .filter((x): x is string => !!x) ?? [];
  const primaryTerm =
    ((e['arxiv:primary_category'] as { term?: string }) ?? {}).term ?? cats[0] ?? 'cs.CV';
  return {
    id,
    version,
    url: idUrl.replace(/v\d+$/, ''),
    title: String(e.title ?? '').trim().replace(/\s+/g, ' '),
    authors,
    abstract: String(e.summary ?? '').trim().replace(/\s+/g, ' '),
    published: String(e.published ?? ''),
    updated: String(e.updated ?? ''),
    primaryCategory: primaryTerm,
    categories: cats,
    pdfUrl: pdf,
  };
}

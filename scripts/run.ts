import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAllFamilies } from './arxiv';
import { tagPaper } from './tag';
import type { ArxivCandidate, Paper, TaggedFields } from './schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

interface CliArgs {
  dry: boolean;
  from: string;
  max: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    dry: false,
    from: defaultFromDate(),
    max: 120,
  };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry') args.dry = true;
    else if (a.startsWith('--from=')) args.from = a.split('=')[1];
    else if (a.startsWith('--max=')) args.max = parseInt(a.split('=')[1], 10);
  }
  return args;
}

function defaultFromDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 60);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
function pad(n: number) {
  return String(n).padStart(2, '0');
}

function loadPapers(): Paper[] {
  const papersPath = path.join(ROOT, 'src', 'data', 'papers.json');
  const candidatesPath = path.join(ROOT, 'src', 'data', 'candidates.json');
  const out: Paper[] = [];
  if (fs.existsSync(papersPath)) {
    out.push(...(JSON.parse(fs.readFileSync(papersPath, 'utf8')) as Paper[]));
  }
  if (fs.existsSync(candidatesPath)) {
    out.push(...(JSON.parse(fs.readFileSync(candidatesPath, 'utf8')) as Paper[]));
  }
  return out;
}

function existingArxivIds(papers: Paper[]): Set<string> {
  const s = new Set<string>();
  for (const p of papers) {
    if (!p.arxiv) continue;
    const m = p.arxiv.match(/abs\/([^/?#v]+)/);
    if (m) s.add(m[1]);
  }
  return s;
}

async function main() {
  const args = parseArgs();
  console.log(`[crawl] from=${args.from} dry=${args.dry} max=${args.max}`);

  const existing = loadPapers();
  console.log(`[crawl] existing papers (curated + candidates): ${existing.length}`);

  const raw = await fetchAllFamilies({ fromDate: args.from, maxPerQuery: 200 });
  const known = existingArxivIds(existing);
  const fresh = raw.filter((r) => !known.has(r.id));
  console.log(
    `[crawl] raw=${raw.length}  new=${fresh.length}  already-in-db=${raw.length - fresh.length}`,
  );

  const rawPath = path.join(ROOT, 'scripts', '.crawl-raw.json');
  fs.writeFileSync(rawPath, JSON.stringify(fresh, null, 2));
  console.log(`[crawl] wrote ${rawPath}`);

  if (args.dry) {
    const preview = fresh.slice(0, 20).map((p) => ({
      id: p.id,
      published: p.published.slice(0, 10),
      title: p.title.slice(0, 90),
    }));
    console.table(preview);
    console.log('[dry] exiting without tagging.');
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[fatal] ANTHROPIC_API_KEY not set.');
    process.exit(2);
  }

  const pool = fresh.slice(0, args.max);
  console.log(`[tag] tagging ${pool.length} candidates…`);
  const accepted: Paper[] = [];
  let rejected = 0;

  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    try {
      const t = await tagPaper(p);
      if (!t) {
        rejected++;
        continue;
      }
      if (!t.is_head_avatar_paper) {
        rejected++;
        console.log(`  · skip (non-head-avatar): ${p.id} — ${t.reject_reason ?? ''}`);
        continue;
      }
      accepted.push(toPaper(p, t));
      console.log(`  ✓ ${p.id}  ${t.short}  imp=${t.importance}`);
    } catch (err) {
      console.error(`  ✗ ${p.id}:`, (err as Error).message);
      rejected++;
    }
  }

  console.log(`[tag] accepted=${accepted.length}  rejected=${rejected}`);

  accepted.sort((a, b) => b.year - a.year || b.month - a.month);

  const outPath = path.join(ROOT, 'src', 'data', 'candidates.json');
  fs.writeFileSync(outPath, JSON.stringify(accepted, null, 2) + '\n');
  console.log(`[write] ${outPath} (${accepted.length} entries)`);
}

function toPaper(a: ArxivCandidate, t: TaggedFields): Paper {
  const pub = a.published ? new Date(a.published) : new Date();
  return {
    id: slug(t.short) || a.id,
    title: a.title,
    short: t.short,
    authors: a.authors.map((n) => lastName(n)),
    year: pub.getUTCFullYear(),
    month: pub.getUTCMonth() + 1,
    venue: 'arXiv',
    venueYear: pub.getUTCFullYear(),
    tags: t.tags,
    citations: 0,
    code: Boolean(t.code_hint),
    arxiv: `https://arxiv.org/abs/${a.id}`,
    project: t.project_url_hint ?? '',
    figure: t.contribution || t.summary.slice(0, 160),
    abstract: t.summary,
  };
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : full;
}

function slug(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

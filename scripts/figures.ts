/**
 * Figure/thumbnail scraper.
 *
 * For each paper that has a `project` URL but no `figureUrl`, fetch the
 * project page HTML and extract the Open Graph / Twitter card image — that
 * is the author-curated teaser image, specifically intended for link
 * previews. Store the absolute HTTPS URL directly (no repo bloat).
 *
 * Falls back to picking the first `<img>` whose src hints at "teaser",
 * "pipeline" or "overview" when neither meta tag is present.
 *
 * Run: `npm run figures`          (updates src/data/papers.json)
 *      `npm run figures -- --dry` (preview only)
 *      `npm run figures -- --force` (overwrite existing figureUrls)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Paper } from '../src/types/paper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PAPERS_PATH = path.join(ROOT, 'src', 'data', 'papers.json');

const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

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
    if (!r.ok) {
      console.warn(`    [${url}] HTTP ${r.status}`);
      return null;
    }
    return await r.text();
  } catch (err) {
    console.warn(`    [${url}] ${(err as Error).message}`);
    return null;
  }
}

/** Strip HTML entities + decode quoted attribute values. */
function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

/** Look for an og:image / twitter:image meta tag. Returns raw value (possibly relative). */
function findMetaImage(html: string): string | null {
  // Order matters: og:image wins over twitter:image. Both quote orderings supported.
  const patterns: RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return decode(m[1].trim());
  }
  return null;
}

/** Fallback: find an <img> whose filename reads as a paper teaser / overview
 *  figure. Only fires when the page has no og:image meta. Must match a
 *  teaser keyword AND not match any known template-placeholder name. */
function findTeaserImg(html: string): string | null {
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const src = decode(m[1]);
    if (!IMAGE_EXT.test(src)) continue;
    // Reject HTML-template placeholders and obvious chrome.
    if (/your_banner_image|placeholder|logo|icon|favicon|profile|author\.|headshot/i.test(src)) continue;
    if (/\/(affiliation|institution|sponsor)s?\//i.test(src)) continue;
    // Require one of the standard teaser-figure filenames (word boundary so
    // "method.jpg" matches but "methodology/foo.png" does too — acceptable).
    if (!/(?:^|[/_-])(teaser|overview|banner|pipeline|method|hero|main_fig|main-fig)(?:[._-]|$)/i.test(src)) continue;
    return src;
  }
  return null;
}

/** Resolve `src` (possibly relative) against the page URL, force HTTPS. */
function resolveAbs(base: string, src: string): string | null {
  try {
    const abs = new URL(src, base).href;
    if (abs.startsWith('http://')) return 'https://' + abs.slice('http://'.length);
    if (!abs.startsWith('https://')) return null;
    return abs;
  } catch {
    return null;
  }
}

async function headIsImage(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (head-avatar-archive)' },
      redirect: 'follow',
    });
    if (!r.ok) return false;
    const ct = r.headers.get('content-type') ?? '';
    return ct.startsWith('image/');
  } catch {
    return false;
  }
}

/** Placeholder / unrelated-asset filename patterns that neither og:image nor
 *  the fallback img scan should accept. */
const BAD_IMG = /your_banner_image|placeholder|ai_center|lab_logo|\/logo|\/logos\//i;

async function extractFigure(projectUrl: string): Promise<string | null> {
  const html = await fetchText(projectUrl);
  if (!html) return null;

  const candidates: string[] = [];
  const meta = findMetaImage(html);
  if (meta) candidates.push(meta);
  const teaser = findTeaserImg(html);
  if (teaser) candidates.push(teaser);

  for (const raw of candidates) {
    if (BAD_IMG.test(raw)) continue;
    const abs = resolveAbs(projectUrl, raw);
    if (!abs) continue;
    if (BAD_IMG.test(abs)) continue;
    if (IMAGE_EXT.test(abs)) return abs;
    const ok = await headIsImage(abs);
    if (ok) return abs;
  }
  return null;
}

async function main() {
  const papers: Paper[] = JSON.parse(fs.readFileSync(PAPERS_PATH, 'utf8'));
  console.log(`[figures] loaded ${papers.length} papers`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < papers.length; i++) {
    const p = papers[i];
    if (!p.project) continue;
    const existingIsBad = p.figureUrl && BAD_IMG.test(p.figureUrl);
    if (p.figureUrl && !FORCE && !existingIsBad) continue;
    if (existingIsBad) {
      console.log(`    (dropping stale placeholder: ${p.figureUrl})`);
      p.figureUrl = undefined;
    }

    processed++;
    console.log(`[${i + 1}/${papers.length}] ${p.short.padEnd(24)} ${p.project}`);
    const fig = await extractFigure(p.project);
    if (fig) {
      p.figureUrl = fig;
      updated++;
      console.log(`    → ${fig}`);
    } else {
      skipped++;
    }

    // mild pacing so we don't hammer any single host (most are GitHub Pages).
    await sleep(300);

    // incremental save
    if (!DRY && updated % 10 === 0 && updated > 0) {
      fs.writeFileSync(PAPERS_PATH, JSON.stringify(papers, null, 2) + '\n');
    }
  }

  console.log(`[figures] processed=${processed}  updated=${updated}  no-image=${skipped}`);
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

import Anthropic from '@anthropic-ai/sdk';
import type { ArxivCandidate, TaggedFields } from './schema';

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';

/**
 * System prompt narrowed to 3D **Head Avatar** research specifically.
 * Rejects full-body / hand / scene / non-avatar work.
 */
const SYSTEM = `You tag 3D-head-avatar-research papers for a curated archive.

Return STRICT JSON matching this exact schema:

{
  "is_head_avatar_paper": boolean,  // true iff the paper's CENTRAL contribution is 3D head / face / portrait avatar reconstruction, synthesis, relighting, or animation. Reject: full-body-only, hand-only, general 3DGS scene, 2D-only face editing, speech synthesis, NLP, robotics, etc.
  "reject_reason": string,          // empty if accepted; else short reason
  "short": string,                  // method short name, e.g. "GaussianAvatars" or "FlashAvatar". Kebab-case ok if no explicit name.
  "tags": string[],                 // 2-5 concise keywords: one of {"NeRF","3DGS","Mesh","Points","SDF","Hybrid"} + one of {"Monocular","Multi-view","Studio","Single-image","Text"} + optional capability {"Relightable","Animatable","Reenactment","Talking head","Generative","Editing"} + optional prior {"FLAME","3DMM"}.
  "contribution": string,           // one-line key novelty ("First X that does Y via Z")
  "summary": string,                // neutral paraphrased abstract, <= 400 chars
  "importance": 1|2|3|4|5,          // 1=minor, 3=solid venue quality, 5=field-defining SOTA
  "code_hint": boolean,             // true if the abstract mentions code/project page release
  "project_url_hint": string        // empty if unknown; else a URL if the abstract mentions one explicitly
}

Rules:
- Accept ONLY when the MAIN target is head / face / portrait. Reject generic body-avatar papers that only mention heads in passing.
- Tags array must have 2-5 items.
- Output ONLY the JSON object. No prose, no fences.`;

export async function tagPaper(paper: ArxivCandidate): Promise<TaggedFields | null> {
  const userBody = JSON.stringify({
    title: paper.title,
    authors: paper.authors,
    published: paper.published,
    abstract: paper.abstract,
    arxiv_id: paper.id,
    primary_category: paper.primaryCategory,
  });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    system: [
      {
        type: 'text',
        text: SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userBody }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const json = extractJson(text);
  if (!json) {
    console.error('[tag] no JSON from model for', paper.id);
    return null;
  }

  return {
    is_head_avatar_paper: Boolean(json.is_head_avatar_paper),
    reject_reason: typeof json.reject_reason === 'string' ? json.reject_reason : undefined,
    short: String(json.short ?? paper.id),
    tags: Array.isArray(json.tags) ? json.tags.map(String).slice(0, 5) : [],
    contribution: String(json.contribution ?? ''),
    summary: String(json.summary ?? '').slice(0, 400),
    importance: clampImportance(json.importance),
    code_hint: Boolean(json.code_hint),
    project_url_hint: typeof json.project_url_hint === 'string' ? json.project_url_hint : undefined,
  };
}

function clampImportance(v: unknown): TaggedFields['importance'] {
  const n = Number(v);
  if (n >= 1 && n <= 5 && Number.isInteger(n)) return n as TaggedFields['importance'];
  return 2;
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

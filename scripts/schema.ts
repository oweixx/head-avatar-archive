import type { Paper, VenueKey } from '../src/types/paper';

export interface ArxivCandidate {
  id: string; // arxiv id like "2502.20220"
  version: string; // "v1"
  url: string; // https://arxiv.org/abs/...
  title: string;
  authors: string[];
  abstract: string;
  published: string; // ISO
  updated: string; // ISO
  primaryCategory: string;
  categories: string[];
  pdfUrl?: string;
}

/** What the Claude tagger emits before we normalise it into a full Paper. */
export interface TaggedFields {
  is_head_avatar_paper: boolean;
  reject_reason?: string;
  short: string;
  tags: string[];
  contribution: string;
  summary: string; // paraphrased abstract, <= 400 chars
  importance: 1 | 2 | 3 | 4 | 5;
  code_hint: boolean;
  project_url_hint?: string;
}

export type { Paper, VenueKey };

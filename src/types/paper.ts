export type VenueKey =
  | 'CVPR'
  | 'ECCV'
  | 'ICCV'
  | 'ICLR'
  | 'NeurIPS'
  | 'SIGGRAPH'
  | 'SIGGRAPH Asia'
  | '3DV'
  | 'arXiv';

export type Paper = {
  id: string;
  title: string;
  short: string;
  authors: string[];
  year: number;
  month: number;
  venue: VenueKey;
  venueYear: number;
  tags: string[];
  citations: number;
  code: boolean;
  arxiv: string;
  project: string;
  /** one-line caption describing the representative figure */
  figure: string;
  /** optional thumbnail URL (PNG/WebP). Absolute URL or path under /public. */
  figureUrl?: string;
  /** optional code repo URL; falls back to `project` when missing */
  codeUrl?: string;
  abstract: string;
};

export type TweakState = {
  palette: 'vivid' | 'mono' | 'pastel';
  bg: 'olive' | 'cream' | 'dark';
  font: 'sans' | 'serif' | 'mono';
  density: 'comfortable' | 'compact';
};

export const CONFERENCES: { key: VenueKey; cssVar: string }[] = [
  { key: 'CVPR', cssVar: '--c-CVPR' },
  { key: 'ECCV', cssVar: '--c-ECCV' },
  { key: 'ICCV', cssVar: '--c-ICCV' },
  { key: 'ICLR', cssVar: '--c-ICLR' },
  { key: 'NeurIPS', cssVar: '--c-NeurIPS' },
  { key: 'SIGGRAPH', cssVar: '--c-SIGGRAPH' },
  { key: 'SIGGRAPH Asia', cssVar: '--c-SIGGRAPHAsia' },
  { key: '3DV', cssVar: '--c-3DV' },
  { key: 'arXiv', cssVar: '--c-arXiv' },
];

export const MONTHS = [
  '',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

export const venueVar = (v: VenueKey): string => {
  const m = CONFERENCES.find((c) => c.key === v);
  return m ? m.cssVar : '--c-arXiv';
};

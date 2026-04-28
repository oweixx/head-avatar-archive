'use client';

import type { CSSProperties } from 'react';
import { MONTHS, venueVar, type Paper } from '@/types/paper';

type Props = {
  paper: Paper;
  idx: number;
  onHover: (p: Paper) => void;
  onLeave: () => void;
  onClick: (p: Paper) => void;
  highlight: boolean;
  dim: boolean;
  pinned: boolean;
  /** This card's paper is in the active card's `builds_on` (an ancestor). */
  linkBuilds: boolean;
  /** This card's paper is in the active card's `cited_by` (a descendant). */
  linkCited: boolean;
};

export function Card({
  paper, idx, onHover, onLeave, onClick,
  highlight, dim, pinned, linkBuilds, linkCited,
}: Props) {
  const style = { ['--tone' as any]: `var(${venueVar(paper.venue)})` } as CSSProperties;
  const cls = [
    'card',
    highlight && 'hl',
    dim && 'dim',
    pinned && 'pinned',
    linkBuilds && 'link-builds',
    linkCited && 'link-cited',
  ]
    .filter(Boolean)
    .join(' ');
  const lineageGlyph = linkBuilds ? '↑' : linkCited ? '↓' : null;
  return (
    <div
      className={cls}
      data-paper-id={paper.id}
      onMouseEnter={() => onHover(paper)}
      onMouseLeave={onLeave}
      onClick={() => onClick(paper)}
      style={style}
    >
      <div className="tab">
        <div className="venue">{paper.venue}</div>
        <div className="vy">&apos;{String(paper.venueYear).slice(-2)}</div>
      </div>
      <div className="body">
        <div className="idx">
          {lineageGlyph ? (
            <span
              className="lineage-arrow"
              title={
                linkBuilds
                  ? 'Cited by the active paper (ancestor)'
                  : 'Cites the active paper (descendant)'
              }
            >
              {lineageGlyph}
            </span>
          ) : (
            String(idx).padStart(3, '0')
          )}
        </div>
        <div className="title">
          <span className="short">{paper.short}</span>
          {paper.title}
        </div>
        <div className="meta">
          {pinned && <span className="pin-dot" title="Pinned">●</span>}
          <span className="mo">{MONTHS[paper.month]}</span>
          <span className={`code ${paper.code ? '' : 'off'}`}>CODE</span>
        </div>
      </div>
    </div>
  );
}

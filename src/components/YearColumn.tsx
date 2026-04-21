'use client';

import { useMemo } from 'react';
import { MONTHS, type Paper, type VenueKey } from '@/types/paper';
import { Card } from './Card';

const CONF_ORDER: VenueKey[] = [
  'CVPR', 'ECCV', 'ICCV', 'ICLR', 'NeurIPS',
  'SIGGRAPH', 'SIGGRAPH Asia', '3DV', 'arXiv',
];

type Props = {
  year: number;
  papers: Paper[];
  onHover: (p: Paper) => void;
  onLeave: () => void;
  onClick: (p: Paper) => void;
  highlightId: string | undefined;
  pinnedId: string | undefined;
  anyHover: boolean;
  enabled: Record<VenueKey, boolean>;
};

export function YearColumn({
  year, papers, onHover, onLeave, onClick, highlightId, pinnedId, anyHover, enabled,
}: Props) {
  const visible = useMemo(() => {
    const sorted = [...papers].sort((a, b) => {
      const ai = CONF_ORDER.indexOf(a.venue);
      const bi = CONF_ORDER.indexOf(b.venue);
      if (ai !== bi) return ai - bi;
      return b.month - a.month;
    });
    return sorted.filter((p) => enabled[p.venue] !== false);
  }, [papers, enabled]);

  const months = visible.map((p) => p.month);
  const monRange = visible.length
    ? `${MONTHS[Math.min(...months)]}–${MONTHS[Math.max(...months)]}`
    : '—';

  return (
    <section className="year" data-screen-label={`Year ${year}`}>
      <div className="year-head">
        <div className="yr">{year}</div>
        <div className="yr-sub">
          filed · {String(visible.length).padStart(2, '0')} papers
          <br />
          {monRange}
        </div>
      </div>
      <div className="stack">
        {visible.map((p, i) => (
          <Card
            key={p.id}
            paper={p}
            idx={i + 1}
            onHover={onHover}
            onLeave={onLeave}
            onClick={onClick}
            highlight={highlightId === p.id}
            dim={anyHover && highlightId !== p.id}
            pinned={pinnedId === p.id}
          />
        ))}
        {!visible.length && <div className="empty-col">— no papers in view —</div>}
      </div>
    </section>
  );
}

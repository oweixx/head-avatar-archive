'use client';

import type { CSSProperties } from 'react';
import { CONFERENCES, type VenueKey } from '@/types/paper';

type Props = {
  enabled: Record<VenueKey, boolean>;
  counts: Partial<Record<VenueKey, number>>;
  onToggle: (v: VenueKey) => void;
};

export function Toggles({ enabled, counts, onToggle }: Props) {
  return (
    <div className="toggles">
      {CONFERENCES.map((c) => {
        const style = { ['--tone' as any]: `var(${c.cssVar})` } as CSSProperties;
        return (
          <div
            key={c.key}
            className="toggle"
            data-on={enabled[c.key] !== false}
            style={style}
            onClick={() => onToggle(c.key)}
            title={`${c.key} — ${counts[c.key] ?? 0} papers`}
          >
            <span className="dot" />
            {c.key}&nbsp;·&nbsp;{counts[c.key] ?? 0}
          </div>
        );
      })}
    </div>
  );
}

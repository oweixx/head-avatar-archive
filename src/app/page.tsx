'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAPERS } from '@/data/papers';
import { CONFERENCES, type Paper, type TweakState, type VenueKey } from '@/types/paper';
import { Ledger } from '@/components/Ledger';
import { Toggles } from '@/components/Toggles';
import { YearColumn } from '@/components/YearColumn';
import { Detail } from '@/components/Detail';
import { Tweaks } from '@/components/Tweaks';

const DEFAULT_TWEAKS: TweakState = {
  palette: 'pastel',
  bg: 'cream',
  font: 'sans',
  density: 'compact',
};

export default function HomePage() {
  const [hover, setHover] = useState<Paper | null>(null);
  const [pinned, setPinned] = useState<Paper | null>(null);
  const [enabled, setEnabled] = useState<Record<VenueKey, boolean>>(() =>
    Object.fromEntries(CONFERENCES.map((c) => [c.key, true])) as Record<VenueKey, boolean>
  );
  const [tweakOpen, setTweakOpen] = useState(false);
  const [tweakState, setTweakState] = useState<TweakState>(DEFAULT_TWEAKS);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    Object.entries(tweakState).forEach(([k, v]) => {
      document.body.setAttribute(`data-${k}`, String(v));
    });
  }, [tweakState]);

  const yearsMap = useMemo(() => {
    const m = new Map<number, Paper[]>();
    PAPERS.forEach((p) => {
      if (!m.has(p.year)) m.set(p.year, []);
      m.get(p.year)!.push(p);
    });
    return m;
  }, []);

  const years = useMemo(
    () => [...yearsMap.keys()].sort((a, b) => a - b),
    [yearsMap]
  );

  const counts = useMemo(() => {
    const c: Partial<Record<VenueKey, number>> = {};
    PAPERS.forEach((p) => {
      c[p.venue] = (c[p.venue] ?? 0) + 1;
    });
    return c;
  }, []);

  const shownCount = useMemo(
    () => PAPERS.filter((p) => enabled[p.venue] !== false).length,
    [enabled]
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // If the cursor is over a year stack that has vertical overflow,
      // let native vertical scroll happen (don't hijack).
      const tgt = e.target as HTMLElement | null;
      const stack = tgt?.closest?.('.stack') as HTMLElement | null;
      if (stack && stack.scrollHeight > stack.clientHeight + 1) {
        // shift = force horizontal across years
        if (!e.shiftKey) return;
      }
      // Otherwise redirect wheel to horizontal timeline scroll.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Hover alone is enough to reveal the panel — you don't have to click
  // first. Click still pins the paper so you can move the cursor away
  // without losing it.
  const onCardHover = useCallback((p: Paper) => {
    setHover(p);
    setDetailOpen(true);
  }, []);

  const onCardClick = useCallback((p: Paper) => {
    setPinned((cur) => (cur?.id === p.id ? null : p));
    setDetailOpen(true);
  }, []);

  const onClosePanel = useCallback(() => {
    setDetailOpen(false);
    setHover(null);
    setPinned(null);
  }, []);

  const displayPaper = hover ?? pinned;
  const pinnedId = pinned?.id;

  return (
    <div className="app">
      <div>
        <Ledger total={PAPERS.length} shown={shownCount} />
        <Toggles
          enabled={enabled}
          counts={counts}
          onToggle={(k) =>
            setEnabled((s) => ({ ...s, [k]: !(s[k] !== false) }))
          }
        />
      </div>
      <div className="stage">
        <div className="scroller" ref={scrollerRef}>
          <div className="timeline" onMouseLeave={() => setHover(null)}>
            {years.map((y) => (
              <YearColumn
                key={y}
                year={y}
                papers={yearsMap.get(y) ?? []}
                onHover={onCardHover}
                onClick={onCardClick}
                highlightId={displayPaper?.id}
                pinnedId={pinnedId}
                anyHover={!!displayPaper}
                enabled={enabled}
              />
            ))}
          </div>
        </div>
        <Detail
          paper={detailOpen ? displayPaper : null}
          open={detailOpen}
          pinned={!!pinned && (hover?.id ?? pinned.id) === pinned.id}
          onUnpin={() => setPinned(null)}
          onClose={onClosePanel}
        />
        <div className="caption">Figure 3-1.  Speed Index — 3D Head Archive</div>
      </div>
      <div className="plinth" />
      {!detailOpen && (
        <button
          className="detail-btn"
          onClick={() => setDetailOpen(true)}
          title={pinned ? `Show ${pinned.short}` : 'Open file panel'}
        >
          📄 File
        </button>
      )}
      <Tweaks
        open={tweakOpen}
        onToggle={() => setTweakOpen((o) => !o)}
        state={tweakState}
        setState={setTweakState}
      />
    </div>
  );
}

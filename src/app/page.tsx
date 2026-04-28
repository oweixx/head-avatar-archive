'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAPERS } from '@/data/papers';
import { CONFERENCES, type Paper, type TweakState, type VenueKey } from '@/types/paper';
import { Ledger } from '@/components/Ledger';
import { Toggles } from '@/components/Toggles';
import { YearColumn } from '@/components/YearColumn';
import { Detail } from '@/components/Detail';
import { Tweaks } from '@/components/Tweaks';
import { BgMosaic } from '@/components/BgMosaic';

const DEFAULT_TWEAKS: TweakState = {
  palette: 'vivid',
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
  // `manualOpen` is only set when the user clicks the 📄 File button with
  // nothing hovered/pinned — forces an empty panel for inspection. Otherwise
  // the panel's visibility is derived from `hover || pinned`, so moving the
  // cursor off a card closes it naturally.
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    Object.entries(tweakState).forEach(([k, v]) => {
      document.body.setAttribute(`data-${k}`, String(v));
    });
  }, [tweakState]);

  // Bucket by conference year when the paper has been accepted somewhere
  // (so a CVPR'26 preprint posted in Nov 2025 sits in the 2026 column),
  // and fall back to the arXiv-post year for venue==arXiv preprints.
  const bucketYear = useCallback(
    (p: Paper) => (p.venue === 'arXiv' ? p.year : p.venueYear),
    [],
  );

  const yearsMap = useMemo(() => {
    const m = new Map<number, Paper[]>();
    PAPERS.forEach((p) => {
      const y = bucketYear(p);
      if (!m.has(y)) m.set(y, []);
      m.get(y)!.push(p);
    });
    return m;
  }, [bucketYear]);

  const papersById = useMemo(
    () => new Map(PAPERS.map((p) => [p.id, p])),
    [],
  );

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

  // Hover = transient preview. Leaving the card clears it so the panel
  // closes (unless something is pinned).
  const onCardHover = useCallback((p: Paper) => {
    setHover(p);
  }, []);
  const onCardLeave = useCallback(() => {
    setHover(null);
  }, []);

  const onCardClick = useCallback((p: Paper) => {
    setPinned((cur) => (cur?.id === p.id ? null : p));
  }, []);

  const onClosePanel = useCallback(() => {
    setHover(null);
    setPinned(null);
    setManualOpen(false);
  }, []);

  // Jump from a lineage chip in the Detail panel to the actual card on the
  // timeline: pin it, then horizontally scroll the card into view.
  const onJumpTo = useCallback(
    (id: string) => {
      const target = papersById.get(id);
      if (!target) return;
      setHover(null);
      setPinned(target);
      setManualOpen(true);
      requestAnimationFrame(() => {
        const el = scrollerRef.current?.querySelector(
          `[data-paper-id="${id}"]`,
        ) as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    },
    [papersById],
  );

  const displayPaper = hover ?? pinned;
  const pinnedId = pinned?.id;
  const detailOpen = !!displayPaper || manualOpen;

  // Citation-graph highlights: when a card is active, light up its
  // archive-internal references / citations so the lineage is visible.
  const linkedBuilds = useMemo(
    () => new Set(displayPaper?.builds_on ?? []),
    [displayPaper],
  );
  const linkedCited = useMemo(
    () => new Set(displayPaper?.cited_by ?? []),
    [displayPaper],
  );

  return (
    <div className="app">
      <BgMosaic />
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
                onLeave={onCardLeave}
                onClick={onCardClick}
                highlightId={displayPaper?.id}
                pinnedId={pinnedId}
                anyHover={!!displayPaper}
                enabled={enabled}
                linkedBuilds={linkedBuilds}
                linkedCited={linkedCited}
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
          papersById={papersById}
          onJumpTo={onJumpTo}
        />
        <div className="caption">Figure 3-1.  Speed Index — 3D Head Archive</div>
      </div>
      <div className="plinth" />
      {!detailOpen && (
        <button
          className="detail-btn"
          onClick={() => setManualOpen(true)}
          title="Open file panel"
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

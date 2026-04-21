const { useState, useEffect, useMemo, useRef } = React;

const CONFERENCES = [
  { key: 'CVPR', var: '--c-CVPR' },
  { key: 'ECCV', var: '--c-ECCV' },
  { key: 'ICCV', var: '--c-ICCV' },
  { key: 'ICLR', var: '--c-ICLR' },
  { key: 'NeurIPS', var: '--c-NeurIPS' },
  { key: 'SIGGRAPH', var: '--c-SIGGRAPH' },
  { key: 'SIGGRAPH Asia', var: '--c-SIGGRAPHAsia' },
  { key: '3DV', var: '--c-3DV' },
  { key: 'arXiv', var: '--c-arXiv' },
];

const venueVar = (v) => {
  const m = CONFERENCES.find(c => c.key === v);
  return m ? m.var : '--c-arXiv';
};

const MONTHS = ['', 'JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

/* --------------------------- Ledger --------------------------- */
function Ledger({ total, shown }) {
  return (
    <div className="ledger">
      <div className="ch"><b>Ch. 3 /</b></div>
      <h1>3D Head Avatar — Correspondence</h1>
      <div className="count">{String(shown).padStart(2,'0')} / {String(total).padStart(2,'0')} filed</div>
      <div className="page">/ {new Date().getFullYear().toString().slice(-2)}</div>
    </div>
  );
}

/* --------------------------- Toggles --------------------------- */
function Toggles({ enabled, onToggle, counts }) {
  return (
    <div className="toggles">
      {CONFERENCES.map(c => (
        <div
          key={c.key}
          className="toggle"
          data-on={enabled[c.key] !== false}
          style={{ ['--tone']: `var(${c.var})` }}
          onClick={() => onToggle(c.key)}
          title={`${c.key} — ${counts[c.key] || 0} papers`}
        >
          <span className="dot" />{c.key}&nbsp;·&nbsp;{counts[c.key] || 0}
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Card --------------------------- */
function Card({ paper, idx, onHover, highlight, dim }) {
  const tone = `var(${venueVar(paper.venue)})`;
  return (
    <div
      className={`card ${highlight ? 'hl' : ''} ${dim ? 'dim' : ''}`}
      onMouseEnter={() => onHover(paper)}
      style={{ ['--tone']: tone }}
    >
      <div className="tab">
        <div className="venue">{paper.venue}</div>
        <div className="vy">'{String(paper.venueYear).slice(-2)}</div>
      </div>
      <div className="body">
        <div className="idx">{String(idx).padStart(3,'0')}</div>
        <div className="title">
          <span className="short">{paper.short}</span>
          {paper.title}
        </div>
        <div className="meta">
          <span className="mo">{MONTHS[paper.month]}</span>
          <span className={`code ${paper.code ? '' : 'off'}`}>CODE</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Year column --------------------------- */
function YearColumn({ year, papers, onHover, highlightId, anyHover, enabled }) {
  // primary key: year (group already). secondary: conference order, then month desc.
  const confOrder = ['CVPR','ECCV','ICCV','ICLR','NeurIPS','SIGGRAPH','SIGGRAPH Asia','3DV','arXiv'];
  const sorted = [...papers].sort((a,b) => {
    const ai = confOrder.indexOf(a.venue), bi = confOrder.indexOf(b.venue);
    if (ai !== bi) return ai - bi;
    return b.month - a.month;
  });
  const visible = sorted.filter(p => enabled[p.venue] !== false);
  return (
    <section className="year" data-screen-label={`Year ${year}`}>
      <div className="year-head">
        <div className="yr">{year}</div>
        <div className="yr-sub">
          filed · {String(visible.length).padStart(2,'0')} papers<br/>
          {visible.length ? `${MONTHS[Math.min(...visible.map(p=>p.month))]}–${MONTHS[Math.max(...visible.map(p=>p.month))]}` : '—'}
        </div>
      </div>
      <div className="stack">
        {visible.map((p, i) => (
          <Card
            key={p.id}
            paper={p}
            idx={i+1}
            onHover={onHover}
            highlight={highlightId === p.id}
            dim={anyHover && highlightId !== p.id}
          />
        ))}
        {!visible.length && (
          <div style={{
            padding: '14px 0',
            fontFamily: 'var(--ff-mono)',
            fontSize: 10.5,
            color: 'var(--ink-soft)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.7
          }}>
            — no papers in view —
          </div>
        )}
      </div>
    </section>
  );
}

/* --------------------------- Detail --------------------------- */
function Detail({ paper }) {
  if (!paper) {
    return (
      <aside className="detail empty">
        <div className="tag"><span>Index</span><span>Hover a file</span></div>
        <div className="empty-msg">Hover a<br/>filed card<br/>to inspect</div>
      </aside>
    );
  }
  const tone = `var(${venueVar(paper.venue)})`;
  return (
    <aside className="detail" style={{ ['--tone']: tone }}>
      <div className="tag">
        <span>{paper.venue} · {paper.venueYear}</span>
        <span>{MONTHS[paper.month]} {paper.year}</span>
      </div>
      <div className="fig">{paper.figure}</div>
      <div className="content">
        <h2>{paper.title}</h2>
        <div className="authors">{paper.authors.join(', ')}</div>
        <dl className="facts">
          <dt>Short</dt><dd>{paper.short}</dd>
          <dt>Cites</dt><dd>{paper.citations.toLocaleString()}</dd>
          <dt>Code</dt><dd>{paper.code ? 'Released' : '— not released'}</dd>
          <dt>Posted</dt><dd>{MONTHS[paper.month]} {paper.year}</dd>
        </dl>
        <div className="abs">{paper.abstract}</div>
        <div className="tags">{paper.tags.map(t => <span key={t}>#{t.toLowerCase()}</span>)}</div>
        <div className="links">
          <a href={paper.arxiv} target="_blank" rel="noreferrer">arXiv <span className="arr">↗</span></a>
          <a href={paper.project} target="_blank" rel="noreferrer">Project page <span className="arr">↗</span></a>
          <a className={paper.code ? '' : 'off'} href={paper.code ? paper.project : '#'} target="_blank" rel="noreferrer">
            Code <span className="arr">{paper.code ? '↗' : '—'}</span>
          </a>
          <a href="#" onClick={e => { e.preventDefault(); copyBibtex(paper); }}>Copy BibTeX <span className="arr">⎘</span></a>
        </div>
      </div>
    </aside>
  );
}

function copyBibtex(p) {
  const first = p.authors[0] || 'author';
  const key = `${first.toLowerCase()}${p.year}${p.short.toLowerCase().replace(/\s+/g,'')}`;
  const bib = `@inproceedings{${key},\n  title={${p.title}},\n  author={${p.authors.join(' and ')}},\n  booktitle={${p.venue}},\n  year={${p.venueYear}}\n}`;
  navigator.clipboard?.writeText(bib);
}

/* --------------------------- Tweaks --------------------------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "vivid",
  "bg": "olive",
  "font": "sans",
  "density": "comfortable"
}/*EDITMODE-END*/;

function Tweaks({ open, onClose, state, setState }) {
  const set = (k,v) => {
    const next = { ...state, [k]: v };
    setState(next);
    document.body.setAttribute(`data-${k}`, v);
    window.parent?.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };
  return (
    <>
      <div className={`tweaks ${open ? 'open' : ''}`}>
        <h3>Tweaks</h3>
        <div className="row">
          <label>Palette</label>
          <div className="opts">
            {['vivid','mono','pastel'].map(v => (
              <button key={v} className={state.palette === v ? 'on' : ''} onClick={() => set('palette', v)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>Background</label>
          <div className="opts">
            {['olive','cream','dark'].map(v => (
              <button key={v} className={state.bg === v ? 'on' : ''} onClick={() => set('bg', v)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>Font</label>
          <div className="opts">
            {['sans','serif','mono'].map(v => (
              <button key={v} className={state.font === v ? 'on' : ''} onClick={() => set('font', v)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>Density</label>
          <div className="opts two">
            {['comfortable','compact'].map(v => (
              <button key={v} className={state.density === v ? 'on' : ''} onClick={() => set('density', v)}>{v}</button>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: '1px solid var(--ink)',
            fontFamily: 'var(--ff-mono)', fontSize: 10, padding: '4px 8px', cursor: 'pointer'
          }}>close</button>
        </div>
      </div>
      {!open && <button className="tweaks-btn" onClick={() => onClose(false)}>⚙ Tweaks</button>}
    </>
  );
}

/* --------------------------- App --------------------------- */
function App() {
  const [hover, setHover] = useState(null);
  const [enabled, setEnabled] = useState(() =>
    Object.fromEntries(CONFERENCES.map(c => [c.key, true]))
  );
  const [tweakOpen, setTweakOpen] = useState(false);
  const [tweakState, setTweakState] = useState(TWEAK_DEFAULTS);

  // apply defaults on mount (in case body attrs differ)
  useEffect(() => {
    Object.entries(tweakState).forEach(([k,v]) => document.body.setAttribute(`data-${k}`, v));
  }, []);

  // edit-mode protocol
  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setTweakOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweakOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent?.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // group by year of posting (paper.year — arXiv/pub timestamp)
  const yearsMap = useMemo(() => {
    const m = new Map();
    window.PAPERS.forEach(p => {
      if (!m.has(p.year)) m.set(p.year, []);
      m.get(p.year).push(p);
    });
    return m;
  }, []);

  const years = [...yearsMap.keys()].sort((a,b) => a-b);

  const counts = useMemo(() => {
    const c = {};
    window.PAPERS.forEach(p => { c[p.venue] = (c[p.venue] || 0) + 1; });
    return c;
  }, []);

  const shownCount = useMemo(() =>
    window.PAPERS.filter(p => enabled[p.venue] !== false).length
  , [enabled]);

  const total = window.PAPERS.length;

  const scrollerRef = useRef(null);
  // horizontal scroll via wheel
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="app">
      <div>
        <Ledger total={total} shown={shownCount} />
        <Toggles
          enabled={enabled}
          counts={counts}
          onToggle={(k) => setEnabled(s => ({ ...s, [k]: !(s[k] !== false) }))}
        />
      </div>
      <div className="stage">
        <div className="scroller" ref={scrollerRef}>
          <div className="timeline"
            onMouseLeave={() => setHover(null)}>
            {years.map(y => (
              <YearColumn
                key={y}
                year={y}
                papers={yearsMap.get(y)}
                onHover={setHover}
                highlightId={hover?.id}
                anyHover={!!hover}
                enabled={enabled}
              />
            ))}
          </div>
        </div>
        <Detail paper={hover} />
        <div className="caption">Figure 3-1.  Speed Index — 3D Head Avatars</div>
      </div>
      <div className="plinth" />
      <div className="hint">Scroll ← → · Hover a card for details · <b>⚙</b> open Tweaks</div>
      <Tweaks
        open={tweakOpen}
        onClose={(v) => setTweakOpen(v === false ? true : false)}
        state={tweakState}
        setState={setTweakState}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

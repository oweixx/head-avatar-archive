'use client';

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { MONTHS, venueVar, type Paper } from '@/types/paper';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function withBase(u: string): string {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (!u.startsWith('/')) return u;
  return `${BASE}${u}`;
}

function copyBibtex(p: Paper) {
  const first = p.authors[0] ?? 'author';
  const key = `${first.toLowerCase()}${p.year}${p.short.toLowerCase().replace(/\s+/g, '')}`;
  const bib =
    `@inproceedings{${key},\n` +
    `  title={${p.title}},\n` +
    `  author={${p.authors.join(' and ')}},\n` +
    `  booktitle={${p.venue}},\n` +
    `  year={${p.venueYear}}\n}`;
  navigator.clipboard?.writeText(bib);
}

type Props = {
  paper: Paper | null;
  pinned: boolean;
  onUnpin: () => void;
};

export function Detail({ paper, pinned, onUnpin }: Props) {
  // drag state
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos({
        x: d.baseX + (e.clientX - d.startX),
        y: d.baseY + (e.clientY - d.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onHandleDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    document.body.style.cursor = 'grabbing';
  };

  const baseStyle: CSSProperties = {
    transform: `translate(${pos.x}px, ${pos.y}px)`,
  };

  if (!paper) {
    return (
      <aside className="detail empty" style={baseStyle}>
        <div className="tag drag-handle" onMouseDown={onHandleDown}>
          <span>Index</span>
          <span>Hover a file</span>
        </div>
        <div className="empty-msg">
          Hover a<br />filed card<br />to inspect
        </div>
      </aside>
    );
  }

  const tone = `var(${venueVar(paper.venue)})`;
  const style: CSSProperties = { ...baseStyle, ['--tone' as any]: tone };

  return (
    <aside className={`detail ${pinned ? 'pinned' : ''}`} style={style}>
      <div className="tag drag-handle" onMouseDown={onHandleDown}>
        <span>
          {paper.venue} · {paper.venueYear}
        </span>
        <span className="tag-right">
          {MONTHS[paper.month]} {paper.year}
          {pinned && (
            <button
              type="button"
              className="pin-close"
              onClick={(e) => {
                e.stopPropagation();
                onUnpin();
              }}
              title="Unpin"
              aria-label="Unpin"
            >
              ×
            </button>
          )}
        </span>
      </div>

      <div className="fig">
        {paper.figureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="fig-img"
            src={withBase(paper.figureUrl)}
            alt={paper.figure || paper.title}
          />
        ) : null}
        <span className="fig-caption">{paper.figure}</span>
      </div>

      <div className="content">
        <h2>{paper.title}</h2>
        <div className="authors">{paper.authors.join(', ')}</div>
        <dl className="facts">
          <dt>Short</dt>
          <dd>{paper.short}</dd>
          <dt>Cites</dt>
          <dd>{paper.citations.toLocaleString()}</dd>
          <dt>Code</dt>
          <dd>{paper.code ? 'Released' : '— not released'}</dd>
          <dt>Posted</dt>
          <dd>
            {MONTHS[paper.month]} {paper.year}
          </dd>
        </dl>
        <div className="abs">{paper.abstract}</div>
        <div className="tags">
          {paper.tags.map((t) => (
            <span key={t}>#{t.toLowerCase()}</span>
          ))}
        </div>
        <div className="links">
          <a href={paper.arxiv} target="_blank" rel="noreferrer">
            arXiv <span className="arr">↗</span>
          </a>
          <a href={paper.project} target="_blank" rel="noreferrer">
            Project page <span className="arr">↗</span>
          </a>
          <a
            className={paper.code ? '' : 'off'}
            href={paper.code ? (paper.codeUrl ?? paper.project) : '#'}
            target="_blank"
            rel="noreferrer"
          >
            Code <span className="arr">{paper.code ? '↗' : '—'}</span>
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              copyBibtex(paper);
            }}
          >
            Copy BibTeX <span className="arr">⎘</span>
          </a>
        </div>
      </div>
    </aside>
  );
}

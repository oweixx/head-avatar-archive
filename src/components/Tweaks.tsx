'use client';

import type { TweakState } from '@/types/paper';

type Props = {
  open: boolean;
  onToggle: () => void;
  state: TweakState;
  setState: (s: TweakState) => void;
};

const palettes: TweakState['palette'][] = ['vivid', 'mono', 'pastel'];
const bgs: TweakState['bg'][] = ['olive', 'cream', 'dark'];
const fonts: TweakState['font'][] = ['sans', 'serif', 'mono'];
const densities: TweakState['density'][] = ['comfortable', 'compact'];

export function Tweaks({ open, onToggle, state, setState }: Props) {
  const set = <K extends keyof TweakState>(k: K, v: TweakState[K]) => {
    const next = { ...state, [k]: v };
    setState(next);
    document.body.setAttribute(`data-${k}`, String(v));
  };

  return (
    <>
      <div className={`tweaks ${open ? 'open' : ''}`}>
        <h3>Tweaks</h3>
        <div className="row">
          <label>Palette</label>
          <div className="opts">
            {palettes.map((v) => (
              <button key={v} className={state.palette === v ? 'on' : ''} onClick={() => set('palette', v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>Background</label>
          <div className="opts">
            {bgs.map((v) => (
              <button key={v} className={state.bg === v ? 'on' : ''} onClick={() => set('bg', v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>Font</label>
          <div className="opts">
            {fonts.map((v) => (
              <button key={v} className={state.font === v ? 'on' : ''} onClick={() => set('font', v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>Density</label>
          <div className="opts two">
            {densities.map((v) => (
              <button key={v} className={state.density === v ? 'on' : ''} onClick={() => set('density', v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button
            onClick={onToggle}
            style={{
              background: 'transparent',
              border: '1px solid var(--ink)',
              fontFamily: 'var(--ff-mono)',
              fontSize: 10,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            close
          </button>
        </div>
      </div>
      {!open && (
        <button className="tweaks-btn" onClick={onToggle}>
          ⚙ Tweaks
        </button>
      )}
    </>
  );
}

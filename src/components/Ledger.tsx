'use client';

type Props = { total: number; shown: number };

export function Ledger({ total, shown }: Props) {
  const yy = new Date().getFullYear().toString().slice(-2);
  return (
    <div className="ledger">
      <div className="ch">
        <b>Ch. 3 /</b>
      </div>
      <h1>3D Head Archive</h1>
      <div className="count">
        {String(shown).padStart(2, '0')} / {String(total).padStart(2, '0')} filed
      </div>
      <div className="page">/ {yy}</div>
    </div>
  );
}

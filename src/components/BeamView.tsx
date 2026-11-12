import type { BeamInput, SupportType } from '../solver/beam';
import { usePulse } from './usePulse';

type Props = { input: BeamInput; xs?: number[]; defl?: number[]; animate?: boolean };

function SupportShape({ type, x, y, dir }: { type: SupportType; x: number; y: number; dir: number }) {
  const gray = '#6b7280';
  if (type === 'pin')
    return <polygon points={`${x},${y} ${x - 12},${y + 22} ${x + 12},${y + 22}`} fill={gray} />;
  if (type === 'roller')
    return (
      <g fill={gray}>
        <polygon points={`${x},${y} ${x - 12},${y + 18} ${x + 12},${y + 18}`} />
        <circle cx={x - 6} cy={y + 23} r={4} />
        <circle cx={x + 6} cy={y + 23} r={4} />
      </g>
    );
  return (
    <g stroke={gray} strokeWidth={2}>
      <line x1={x} y1={y - 26} x2={x} y2={y + 26} strokeWidth={4} />
      {[-2, -1, 0, 1, 2].map((k) => (
        <line key={k} x1={x} y1={y + k * 10} x2={x + dir * 9} y2={y + k * 10 + 9} />
      ))}
    </g>
  );
}

export default function BeamView({ input, xs, defl, animate }: Props) {
  const W = 700;
  const H = 270;
  const padX = 40;
  const y0 = 150;
  const L = input.L > 0 ? input.L : 1;
  const X = (x: number) => padX + (Math.min(Math.max(x, 0), L) / L) * (W - 2 * padX);
  const green = '#059669';

  const pulse = usePulse(!!animate);
  const maxD = defl ? Math.max(...defl.map(Math.abs)) : 0;
  const dScale = maxD > 1e-12 ? 30 / maxD : 0;
  const curve =
    xs && defl ? xs.map((x, i) => `${X(x)},${y0 - defl[i] * dScale * pulse}`).join(' ') : null;

  const maxW = Math.max(1e-9, ...input.lineLoads.flatMap((q) => [Math.abs(q.w1), Math.abs(q.w2)]));

  return (
    <svg width={W} height={H} style={{ border: '1px solid #888', background: '#fff', maxWidth: '100%' }}>
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={green} />
        </marker>
      </defs>

      {/* balok */}
      <line x1={X(0)} y1={y0} x2={X(L)} y2={y0} stroke="#1a56db" strokeWidth={6} />

      {/* bentuk lendutan (diperbesar, bisa beranimasi) */}
      {curve && <polyline points={curve} fill="none" stroke="#e02424" strokeWidth={2} strokeDasharray="6 4" />}

      {/* tumpuan */}
      {input.supports.map((s, k) => (
        <SupportShape key={k} type={s.type} x={X(s.x)} y={y0} dir={s.x <= 0 ? -1 : 1} />
      ))}

      {/* beban merata / segitiga / trapesium */}
      {input.lineLoads
        .filter((q) => q.x2 > q.x1)
        .map((q, k) => {
          const n = Math.max(2, Math.round(((q.x2 - q.x1) / L) * 20));
          const items = Array.from({ length: n + 1 }, (_, j) => {
            const t = j / n;
            const w = q.w1 + (q.w2 - q.w1) * t;
            const dir = w >= 0 ? 1 : -1;
            const h = 8 + (Math.abs(w) / maxW) * 45;
            return { px: X(q.x1 + (q.x2 - q.x1) * t), w, top: y0 - dir * h, end: y0 - dir * 8 };
          });
          const minTop = Math.min(...items.map((i) => i.top));
          return (
            <g key={k} stroke={green} strokeWidth={2}>
              <polyline points={items.map((i) => `${i.px},${i.top}`).join(' ')} fill="none" />
              {items.map(
                (i, j) =>
                  Math.abs(i.w) > 1e-9 && (
                    <line key={j} x1={i.px} y1={i.top} x2={i.px} y2={i.end} markerEnd="url(#ah)" />
                  ),
              )}
              <text x={X((q.x1 + q.x2) / 2)} y={minTop - 6} fontSize={12} stroke="none" fill="#111" textAnchor="middle">
                {q.w1 === q.w2 ? `${q.w1} kN/m` : `${q.w1} → ${q.w2} kN/m`}
              </text>
            </g>
          );
        })}

      {/* beban titik */}
      {input.pointLoads
        .filter((p) => p.P !== 0)
        .map((p, k) => (
          <g key={k} stroke={green} strokeWidth={3}>
            <line
              x1={X(p.x)}
              y1={y0 - (p.P > 0 ? 80 : -80)}
              x2={X(p.x)}
              y2={y0 - (p.P > 0 ? 8 : -8)}
              markerEnd="url(#ah)"
            />
            <text x={X(p.x) + 8} y={y0 - (p.P > 0 ? 72 : -84)} fontSize={12} stroke="none" fill="#111">
              {Math.abs(p.P)} kN
            </text>
          </g>
        ))}

      {/* momen terpusat */}
      {input.moments
        .filter((m) => m.M !== 0)
        .map((m, k) => (
          <g key={k} stroke={green} strokeWidth={2.5} fill="none">
            <path
              d={
                m.M > 0
                  ? `M ${X(m.x) - 14} ${y0 - 16} A 14 14 0 0 1 ${X(m.x) + 14} ${y0 - 16}`
                  : `M ${X(m.x) + 14} ${y0 - 16} A 14 14 0 0 0 ${X(m.x) - 14} ${y0 - 16}`
              }
              markerEnd="url(#ah)"
            />
            <text x={X(m.x)} y={y0 - 36} fontSize={12} stroke="none" fill="#111" textAnchor="middle">
              {Math.abs(m.M)} kNm {m.M > 0 ? '↻' : '↺'}
            </text>
          </g>
        ))}

      {/* sendi gerber */}
      {input.hinges
        .filter((h) => h > 0 && h < L)
        .map((h, k) => (
          <circle key={k} cx={X(h)} cy={y0} r={5} fill="#fff" stroke="#111" strokeWidth={2} />
        ))}

      <text x={W / 2} y={H - 12} fontSize={12} textAnchor="middle" fill="#111">
        L = {input.L} m
      </text>
    </svg>
  );
}

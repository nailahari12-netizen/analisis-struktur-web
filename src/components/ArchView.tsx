import type { ArchInput } from '../solver/arch';
import { usePulse } from './usePulse';

type Props = { input: ArchInput; nodes: { x: number; y: number }[]; u?: number[]; animate?: boolean };

const GREEN = '#059669';
const GRAY = '#6b7280';

function Support({ x, y, fixed }: { x: number; y: number; fixed: boolean }) {
  return fixed ? (
    <rect x={x - 16} y={y} width={32} height={10} fill={GRAY} />
  ) : (
    <polygon points={`${x},${y} ${x - 12},${y + 22} ${x + 12},${y + 22}`} fill={GRAY} />
  );
}

export default function ArchView({ input, nodes, u, animate }: Props) {
  const W = 700;
  const H = 340;
  const pad = 50;
  const { L, f } = input;
  const pulse = usePulse(!!animate);
  const sc = Math.min((W - 2 * pad) / L, (H - 2 * pad - 60) / f);
  const ox = (W - L * sc) / 2;
  const baseY = H - 50;
  const X = (x: number) => ox + x * sc;
  const Y = (y: number) => baseY - y * sc;
  const last = nodes.length - 1;
  const fixed = input.type === 'fixed';

  const yAt = (x: number) => {
    for (let i = 0; i < last; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      if (x >= a.x - 1e-9 && x <= b.x + 1e-9) {
        const t = b.x - a.x > 1e-12 ? (x - a.x) / (b.x - a.x) : 0;
        return a.y + (b.y - a.y) * t;
      }
    }
    return 0;
  };
  const nearest = (x: number) =>
    nodes.reduce((best, n) => (Math.abs(n.x - x) < Math.abs(best.x - x) ? n : best), nodes[0]);

  // deformasi diperbesar supaya terlihat (maks 30 px)
  let maxU = 0;
  if (u) nodes.forEach((_, i) => (maxU = Math.max(maxU, Math.hypot(u[3 * i], u[3 * i + 1]))));
  const defK = u && maxU > 1e-12 ? 30 / maxU : 0;

  const archPts = nodes.map((n) => `${X(n.x)},${Y(n.y)}`).join(' ');
  const defPts = u
    ? nodes
        .map((n, i) => `${X(n.x) + u[3 * i] * defK * pulse},${Y(n.y) - u[3 * i + 1] * defK * pulse}`)
        .join(' ')
    : null;

  const hasUdl = input.wH !== 0 && input.x2 > input.x1;
  const dirW = input.wH >= 0 ? 1 : -1;
  const nArr = 14;
  const arrows = hasUdl
    ? Array.from({ length: nArr + 1 }, (_, j) => {
        const x = input.x1 + ((input.x2 - input.x1) * j) / nArr;
        const yy = Y(yAt(Math.min(Math.max(x, 0), L)));
        return { px: X(x), top: yy - dirW * 40, end: yy - dirW * 6 };
      })
    : [];

  return (
    <svg width={W} height={H} style={{ border: '1px solid #888', background: '#fff', maxWidth: '100%' }}>
      <defs>
        <marker id="ah2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={GREEN} />
        </marker>
      </defs>

      <line x1={X(0) - 30} y1={Y(0) + 24} x2={X(L) + 30} y2={Y(0) + 24} stroke="#ccc" />

      <polyline points={archPts} fill="none" stroke="#1a56db" strokeWidth={6} strokeLinejoin="round" />
      {defPts && (
        <polyline points={defPts} fill="none" stroke="#e02424" strokeWidth={2} strokeDasharray="6 4" />
      )}

      <Support x={X(0)} y={Y(0)} fixed={fixed} />
      <Support x={X(L)} y={Y(0)} fixed={fixed} />

      {input.type === 'threeHinged' && nodes.length > 2 && (
        <circle
          cx={X(nodes[last / 2].x)}
          cy={Y(nodes[last / 2].y)}
          r={6}
          fill="#fff"
          stroke="#111"
          strokeWidth={2}
        />
      )}

      {hasUdl && (
        <g stroke={GREEN} strokeWidth={2}>
          <polyline points={arrows.map((a) => `${a.px},${a.top}`).join(' ')} fill="none" />
          {arrows.map((a, j) => (
            <line key={j} x1={a.px} y1={a.top} x2={a.px} y2={a.end} markerEnd="url(#ah2)" />
          ))}
          <text
            x={X((input.x1 + input.x2) / 2)}
            y={Math.min(...arrows.map((a) => a.top)) - 6}
            fontSize={12}
            stroke="none"
            fill="#111"
            textAnchor="middle"
          >
            {Math.abs(input.wH)} kN/m (per proyeksi horizontal)
          </text>
        </g>
      )}

      {input.pointLoads.map((p, j) => {
        const nd = nearest(p.x);
        const px = X(nd.x);
        const py = Y(nd.y);
        const dv = p.P >= 0 ? 1 : -1;
        const dh = p.H >= 0 ? 1 : -1;
        return (
          <g key={j} stroke={GREEN} strokeWidth={3}>
            {p.P !== 0 && (
              <>
                <line x1={px} y1={py - dv * 60} x2={px} y2={py - dv * 8} markerEnd="url(#ah2)" />
                <text x={px + 8} y={py - dv * 52} fontSize={12} stroke="none" fill="#111">
                  {Math.abs(p.P)} kN
                </text>
              </>
            )}
            {p.H !== 0 && (
              <>
                <line x1={px - dh * 55} y1={py} x2={px - dh * 8} y2={py} markerEnd="url(#ah2)" />
                <text x={px - dh * 55} y={py - 8} fontSize={12} stroke="none" fill="#111">
                  {Math.abs(p.H)} kN
                </text>
              </>
            )}
          </g>
        );
      })}

      <text x={W / 2} y={H - 8} fontSize={12} textAnchor="middle" fill="#111">
        L = {L} m, f = {f} m
      </text>
    </svg>
  );
}
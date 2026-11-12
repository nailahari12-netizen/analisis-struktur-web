import type { Node, Member, Support, NodalLoad } from '../solver/types';

type Props = {
  nodes: Node[];
  members: Member[];
  supports?: Support[];
  loads?: NodalLoad[];
  u?: number[];          // hasil perpindahan dari solver
  defScale?: number;     // pembesaran deformasi
  scale?: number;
};

export default function StructureView({
  nodes,
  members,
  supports = [],
  loads = [],
  u,
  defScale = 2000,
  scale = 80,
}: Props) {
  const pad = 40;
  const baseY = 150;
  const px = (x: number) => pad + x * scale;
  const py = (y: number) => baseY - y * scale;
  const idxOf = (id: number) => nodes.findIndex((n) => n.id === id);
  const find = (id: number) => nodes[idxOf(id)];

  // posisi node setelah deformasi (diperbesar supaya terlihat)
  const def = (n: Node) => {
    const i = idxOf(n.id);
    return {
      x: n.x + (u ? u[3 * i] * defScale : 0),
      y: n.y + (u ? u[3 * i + 1] * defScale : 0),
    };
  };

  return (
    <svg width={600} height={300} style={{ border: '1px solid #888', background: '#fff' }}>
      {/* batang asli */}
      {members.map((m) => {
        const a = find(m.nodeI);
        const b = find(m.nodeJ);
        return (
          <line key={m.id} x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)}
            stroke="#1a56db" strokeWidth={4} />
        );
      })}

      {/* batang terdeformasi */}
      {u &&
        members.map((m) => {
          const a = def(find(m.nodeI));
          const b = def(find(m.nodeJ));
          return (
            <line key={'d' + m.id} x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)}
              stroke="#e02424" strokeWidth={3} strokeDasharray="6 4" />
          );
        })}

      {/* tumpuan */}
      {supports.map((s) => {
        const n = find(s.node);
        const x = px(n.x), y = py(n.y);
        return (
          <polygon key={'s' + s.node}
            points={`${x},${y} ${x - 10},${y + 18} ${x + 10},${y + 18}`}
            fill={s.fixX ? '#374151' : '#9ca3af'} />
        );
      })}

      {/* beban (panah) */}
      {loads.map((l, k) => {
        const n = find(l.node);
        const x = px(n.x), y = py(n.y);
        if (l.fy === 0) return null;
        const dir = l.fy < 0 ? -1 : 1; // negatif = ke bawah
        return (
          <g key={'l' + k} stroke="#059669" strokeWidth={3} fill="#059669">
            <line x1={x} y1={y - dir * 50} x2={x} y2={y - dir * 8} />
            <polygon points={`${x},${y - dir * 2} ${x - 6},${y - dir * 14} ${x + 6},${y - dir * 14}`} />
            <text x={x + 8} y={y - dir * 40} fontSize={12} stroke="none">
              {Math.abs(l.fy) / 1000} kN
            </text>
          </g>
        );
      })}

      {/* node */}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={px(n.x)} cy={py(n.y)} r={5} fill="#1a56db" />
          <text x={px(n.x) + 8} y={py(n.y) - 8} fontSize={12} fill="#000">{n.id}</text>
        </g>
      ))}
    </svg>
  );
}
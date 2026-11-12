type Props = {
  title: string;
  unit: string;
  xs: number[];
  ys: number[];
  L: number;
  color: string;
  flip?: boolean; // true = nilai positif digambar ke bawah (konvensi BMD)
};

export default function DiagramChart({ title, unit, xs, ys, L, color, flip = false }: Props) {
  const W = 640;
  const H = 170;
  const padX = 40;
  const zeroY = H / 2;
  const amp = H / 2 - 28;
  const maxAbs = Math.max(...ys.map(Math.abs), 1e-12);

  const X = (x: number) => padX + (x / L) * (W - 2 * padX);
  const Y = (v: number) => zeroY + (flip ? 1 : -1) * (v / maxAbs) * amp;

  const pts = xs.map((x, i) => `${X(x)},${Y(ys[i])}`).join(' ');
  const poly = `${X(xs[0])},${zeroY} ${pts} ${X(xs[xs.length - 1])},${zeroY}`;

  let iMax = 0;
  let iMin = 0;
  ys.forEach((v, i) => {
    if (v > ys[iMax]) iMax = i;
    if (v < ys[iMin]) iMin = i;
  });
  const labelIdx = [iMax, iMin].filter((i, k, arr) => Math.abs(ys[i]) > 1e-6 && arr.indexOf(i) === k);

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ margin: '0 0 4px' }}>{title}</h3>
      <svg width={W} height={H} style={{ border: '1px solid #888', background: '#fff', maxWidth: '100%' }}>
        <polygon points={poly} fill={color} fillOpacity={0.25} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} />
        <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="#111" strokeWidth={1} />
        {labelIdx.map((i) => {
          const py = Y(ys[i]);
          return (
            <text
              key={i}
              x={X(xs[i])}
              y={py + (py < zeroY ? -6 : 14)}
              fontSize={12}
              textAnchor="middle"
              fill="#111"
            >
              {ys[i].toFixed(2)} {unit}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
import { useEffect, useState } from 'react';

// Mengembalikan faktor 0..1 yang naik turun (periode 2 detik) saat on = true
export function usePulse(on: boolean) {
  const [t, setT] = useState(1);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      setT(Math.abs(Math.sin(((now - t0) / 2000) * Math.PI)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setT(1);
    };
  }, [on]);
  return t;
}

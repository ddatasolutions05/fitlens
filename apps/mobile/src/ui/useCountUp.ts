// Eases a displayed number toward its real value so a plate reacts when a log
// lands. Under reduced motion the value lands on the next frame instead.
import { useEffect, useState } from 'react';

import { useTheme } from './theme';

const DURATION_MS = 450;

export function useCountUp(value: number | null): number | null {
  const { reducedMotion } = useTheme();
  const [shown, setShown] = useState<number | null>(value);
  useEffect(() => {
    const start = Date.now();
    let from: number | null = null;
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / DURATION_MS);
      const eased = 1 - (1 - t) * (1 - t);
      setShown((prev) => {
        if (value == null || reducedMotion || prev == null) return value;
        if (from == null) from = prev;
        return Math.round(from + (value - from) * eased);
      });
      if (t < 1 && value != null && !reducedMotion) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion]);
  return shown;
}

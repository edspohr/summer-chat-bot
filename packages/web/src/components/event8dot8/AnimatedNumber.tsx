import { useEffect, useRef, useState } from "react";

const DURATION_MS = 1200;

// Tweens from the previously shown value to `value` with an ease-out curve.
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const shownRef = useRef(value);

  useEffect(() => {
    fromRef.current = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number): void => {
      const k = Math.min(1, (t - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = fromRef.current + (value - fromRef.current) * eased;
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <>
      {shown.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </>
  );
}

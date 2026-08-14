import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);
  const mountCount = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(frameRef.current);
    const thisMount = ++mountCount.current;
    let start = 0;

    const animate = (now: number) => {
      if (mountCount.current !== thisMount) return; // stale after StrictMode cleanup
      if (!start) start = now;
      const progress = Math.min((now - start) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(target * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}
